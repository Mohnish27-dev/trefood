"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import * as db from "@/server/db/collections";
import { ACTOR, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/constants";
import { serverEnv } from "@/lib/env";
import { requireSession } from "@/server/auth/session";
import { getCampusById, getRestaurantById } from "@/server/services/catalog";
import { checkCurfew } from "@/server/services/curfew";
import { createOrder, getOrderForCustomer, transitionOrder } from "@/server/services/orders";
import { paymentProvider } from "@/server/services/payments";
import { verifyGateCode } from "@/server/services/gate-code";
import { writeAudit } from "@/server/services/audit";

/**
 * Student Server Actions — thin adapters.
 *
 * Each one authenticates, parses, calls a service, and returns. No business
 * rule lives here (PROJECT_STRUCTURE.md section 1), and each re-checks role
 * AND resource ownership rather than trusting middleware (PRD Part 4.9).
 */

const lineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
  addOnOptionIds: z.array(z.string()).max(20),
});

const placeOrderSchema = z.object({
  restaurantId: z.string().min(1),
  zoneId: z.string().min(1),
  lines: z.array(lineSchema).min(1).max(50),
  method: z.enum([PAYMENT_METHOD.ONLINE_100, PAYMENT_METHOD.HYBRID_COD]),
  // F12 — client-generated per checkout attempt. A double-tap returns the first order.
  idempotencyKey: z.string().min(8).max(64),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number"),
  couponCode: z.string().optional(),
});

export type PlaceOrderState =
  | { status: "idle" }
  | { status: "error"; message: string; issues?: { itemId: string; message: string }[] }
  | {
      status: "success";
      orderId: string;
      paytm?: {
        orderId: string;
        txnToken: string;
        amountRupees: string;
        mid: string;
        isStaging: boolean;
      };
    };

/**
 * Place an order.
 *
 * Order of operations matters and is deliberate:
 *   1. authenticate
 *   2. capture the phone (D7 — collected at first checkout, reused forever)
 *   3. re-run the CURFEW GUARD against this restaurant's real prep time
 *   4. create the order as PAYMENT_PENDING, before the gateway opens
 *   5. open the payment intent
 *   6. promote to PLACED only on capture, through the FSM
 */
export async function placeOrder(input: unknown): Promise<PlaceOrderState> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid order." };
  }

  const { user } = await requireSession();
  const data = parsed.data;

  // D7 — phone captured at first checkout, then reused forever.
  if (user.phone !== data.phone) {
    await (await db.users()).updateOne(
      { _id: user._id },
      { $set: { phone: data.phone, updatedAt: new Date() } },
    );
  }

  const restaurant = await getRestaurantById(data.restaurantId);
  if (!restaurant) return { status: "error", message: "That restaurant is no longer available." };

  const campus = await getCampusById(restaurant.campusId);
  if (!campus) return { status: "error", message: "That campus is no longer available." };

  const zone = campus.zones.find((z) => z.id === data.zoneId);
  if (!zone) return { status: "error", message: "That delivery gate no longer exists." };

  // F11 layer 1, re-run server-side against the REAL prep time. The client
  // already showed this, but the client is not authorisation and the clock
  // moves between rendering and tapping.
  const verdict = checkCurfew({
    now: new Date(),
    timezone: campus.timezone,
    zone,
    prepMinutes: restaurant.prepMinutes,
    transitMinutes: campus.settings.transitMinutes,
    bufferMinutes: campus.settings.curfewBufferMinutes,
  });

  if (!verdict.available) {
    return { status: "error", message: verdict.message ?? "That gate cannot be reached in time." };
  }

  const created = await createOrder({
    customer: { ...user, phone: data.phone },
    restaurantId: data.restaurantId,
    zoneId: data.zoneId,
    lines: data.lines,
    method: data.method,
    idempotencyKey: data.idempotencyKey,
    couponCode: data.couponCode,
  });

  if (!created.ok) {
    return {
      status: "error",
      message: created.message,
      ...(created.issues
        ? { issues: created.issues.map((i) => ({ itemId: i.itemId, message: i.message })) }
        : {}),
    };
  }

  const order = created.order;

  // F12 — a replayed submit returns the original order rather than a twin.
  if (created.reused) return { status: "success", orderId: order._id };

  const expectedOnlinePaise =
    data.method === PAYMENT_METHOD.ONLINE_100
      ? order.pricing.grandTotalPaise
      : order.pricing.platformCommissionPaise + order.pricing.convenienceFeePaise;

  const intent = await paymentProvider().createIntent({
    orderId: order._id,
    orderNumber: order.orderNumber,
    amountPaise: expectedOnlinePaise,
    customerName: user.name,
    customerPhone: data.phone,
  });

  await (await db.orders()).updateOne(
    { _id: order._id },
    { $set: { "payment.providerOrderId": intent.providerOrderId } },
  );

  // The stub captures inline. PhonePe will not: there, the webhook (or the
  // reconciliation sweep) fires this same transition, guarded by the same FSM.
  if (intent.autoCapturedPaymentId !== null) {
    await (await db.orders()).updateOne(
      { _id: order._id },
      {
        $set: {
          "payment.status": PAYMENT_STATUS.CAPTURED,
          "payment.providerPaymentId": intent.autoCapturedPaymentId,
          "payment.onlinePaidPaise": expectedOnlinePaise,
        },
      },
    );

    const promoted = await transitionOrder({
      orderId: order._id,
      to: ORDER_STATUS.PLACED,
      actor: ACTOR.WEBHOOK,
      actorId: null,
      reason: `Payment captured (${paymentProvider().name})`,
    });

    if (!promoted.ok) return { status: "error", message: promoted.message };
  }

  revalidatePath("/orders");
  const isPaytm = paymentProvider().name === "paytm";
  return {
    status: "success",
    orderId: order._id,
    ...(isPaytm && intent.txnToken && intent.mid
      ? {
          paytm: {
            orderId: order.orderNumber,
            txnToken: intent.txnToken,
            amountRupees: `${Math.floor(expectedOnlinePaise / 100)}.${Math.abs(expectedOnlinePaise % 100).toString().padStart(2, "0")}`,
            mid: intent.mid,
            isStaging: serverEnv().PAYTM_ENVIRONMENT !== "production",
          },
        }
      : {}),
  };
}

/* ------------------------------------------------------------------ */
/* The gate handoff — D4                                               */
/* ------------------------------------------------------------------ */

const confirmSchema = z.object({
  orderId: z.string().min(1),
  /** What the student read off the packet. */
  enteredCode: z.string().regex(/^\d{4}$/, "The code is four digits"),
});

export type ConfirmState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/**
 * Confirm Received.
 *
 * The student is the ONLY actor who can close an order on the happy path.
 * They match the four digits written on the packet against the four shown on
 * screen, which is what makes this safe without a rider device: a student
 * cannot confirm an order that never arrived, because they would have no code
 * to match.
 */
export async function confirmReceived(input: unknown): Promise<ConfirmState> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid code." };
  }

  const { user } = await requireSession();

  // Ownership, not just role.
  const order = await getOrderForCustomer(parsed.data.orderId, user._id);
  if (!order) return { status: "error", message: "That order is not yours." };

  const confirmableStatuses = [
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.PREPARING,
    ORDER_STATUS.READY,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.AT_GATE,
  ];

  if (!confirmableStatuses.includes(order.status as (typeof confirmableStatuses)[number])) {
    return {
      status: "error",
      message: "This order cannot be confirmed right now.",
    };
  }

  if (!verifyGateCode(order.gateCode, parsed.data.enteredCode)) {
    await writeAudit({
      entity: "ORDER",
      entityId: order._id,
      orderId: order._id,
      from: order.status,
      to: order.status,
      actorId: user._id,
      actorRole: ACTOR.STUDENT,
      reason: "Gate code mismatch on confirm attempt",
    });
    return {
      status: "error",
      message: "That code does not match the packet. Check the four digits again.",
    };
  }

  const result = await transitionOrder({
    orderId: order._id,
    to: ORDER_STATUS.DELIVERED,
    actor: ACTOR.STUDENT,
    actorId: user._id,
    requireCustomerId: user._id,
    reason: "Student confirmed receipt at the gate",
  });

  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath(`/orders/${order._id}`);
  revalidatePath("/orders");
  return { status: "success" };
}
