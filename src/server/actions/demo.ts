"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import {
  ACTOR,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  type Actor,
  type OrderStatus,
} from "@/lib/constants";
import { createOrder, getOrder, transitionOrder } from "@/server/services/orders";
import { paymentProvider } from "@/server/services/payments";
import { issueRefund } from "@/server/services/refunds";
import { raiseStockout } from "@/server/services/stockout";
import { recordStrike } from "@/server/services/students";
import { runAllSweeps } from "@/server/services/sweeps";
import { notifyOrderEvent } from "@/server/services/push";
import { getCampusById } from "@/server/services/catalog";

/**
 * The simulation panel's actions.
 *
 * The whole order loop has to be demonstrable in ninety seconds from a cold
 * browser, without a kitchen and without waiting four minutes for a timer.
 * These drive a real order through the REAL state machine — the same
 * `transitionOrder`, the same guards, the same audit entries. Nothing here is
 * a fixture or a mock; a tap in this panel is indistinguishable, in the
 * database, from a vendor tapping the same button on a tablet.
 *
 * What IS different is authorisation: these actions fire transitions as
 * whatever actor the FSM requires, without checking that the caller holds that
 * role. That is exactly the kind of thing that must never reach production, so
 * every export is fenced behind `assertDemoMode()`: development only, stub
 * auth only, and it throws loudly rather than degrading quietly.
 */

function assertDemoMode(): void {
  const env = serverEnv();
  if (env.NODE_ENV === "production" || env.AUTH_PROVIDER !== "stub") {
    throw new Error(
      "The demo panel drives orders without role checks and is refused outside a stub-auth development environment.",
    );
  }
}

export type DemoActionState =
  | { status: "ok"; message: string; orderId?: string }
  | { status: "error"; message: string };

/* ══════════════════════════════════════════════════════════════════════
   Creating an order
   ══════════════════════════════════════════════════════════════════════ */

const createSchema = z.object({
  restaurantId: z.string().min(1),
  zoneId: z.string().min(1),
  method: z.enum([PAYMENT_METHOD.ONLINE_100, PAYMENT_METHOD.HYBRID_COD]),
  customerId: z.string().min(1),
});

/**
 * Build a plausible cart from whatever the restaurant actually sells, and take
 * it through the same creation path checkout uses — server-side pricing,
 * idempotency key, payment intent, promotion to PLACED on capture.
 */
export async function createDemoOrder(input: unknown): Promise<DemoActionState> {
  assertDemoMode();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Pick a restaurant and a gate." };

  const customer = await (await db.users()).findOne({ _id: parsed.data.customerId });
  if (!customer) return { status: "error", message: "That demo account no longer exists." };

  const items = await (await db.menuItems())
    .find({ restaurantId: parsed.data.restaurantId, isAvailable: true })
    .sort({ isPopular: -1, sortOrder: 1 })
    .limit(2)
    .toArray();

  if (items.length === 0) {
    return { status: "error", message: "That restaurant has nothing available to order." };
  }

  const created = await createOrder({
    customer: { ...customer, phone: customer.phone ?? "+919876500001" },
    restaurantId: parsed.data.restaurantId,
    zoneId: parsed.data.zoneId,
    lines: items.map((item) => ({ itemId: item._id, quantity: 1, addOnOptionIds: [] })),
    method: parsed.data.method,
    idempotencyKey: `demo-${Date.now()}-${Math.trunc(Math.random() * 1e6)}`,
  });

  if (!created.ok) return { status: "error", message: created.message };

  const order = created.order;
  const expectedOnlinePaise =
    parsed.data.method === PAYMENT_METHOD.ONLINE_100
      ? order.pricing.grandTotalPaise
      : order.pricing.platformCommissionPaise + order.pricing.convenienceFeePaise;

  // The stub provider captures inline. Razorpay will not — there the webhook
  // fires this same transition, through the same FSM.
  const intent = await paymentProvider().createIntent({
    orderId: order._id,
    orderNumber: order.orderNumber,
    amountPaise: expectedOnlinePaise,
    customerName: customer.name,
    customerPhone: customer.phone ?? "",
  });

  await (await db.orders()).updateOne(
    { _id: order._id },
    {
      $set: {
        "payment.razorpayOrderId": intent.providerOrderId,
        ...(intent.autoCapturedPaymentId === null
          ? {}
          : {
              "payment.status": PAYMENT_STATUS.CAPTURED,
              "payment.razorpayPaymentId": intent.autoCapturedPaymentId,
              "payment.onlinePaidPaise": expectedOnlinePaise,
            }),
      },
    },
  );

  if (intent.autoCapturedPaymentId !== null) {
    const promoted = await transitionOrder({
      orderId: order._id,
      to: ORDER_STATUS.PLACED,
      actor: ACTOR.WEBHOOK,
      reason: `Payment captured (${paymentProvider().name})`,
    });
    if (!promoted.ok) return { status: "error", message: promoted.message };
  }

  revalidatePath("/demo");
  return {
    status: "ok",
    message: `${order.orderNumber} placed — it is on the vendor board now`,
    orderId: order._id,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Driving it forward
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Who fires each edge, taken straight from the transition table.
 *
 * Kept as data rather than a switch so it cannot drift from the FSM: if a
 * transition's legal actor changes in `order-state.ts`, this map is the one
 * place the panel needs updating, and an illegal pairing is rejected by
 * `assertTransition` rather than silently doing the wrong thing.
 */
const ACTOR_FOR: Partial<Record<OrderStatus, Actor>> = {
  [ORDER_STATUS.ACCEPTED]: ACTOR.VENDOR,
  [ORDER_STATUS.PREPARING]: ACTOR.VENDOR,
  [ORDER_STATUS.READY]: ACTOR.VENDOR,
  [ORDER_STATUS.OUT_FOR_DELIVERY]: ACTOR.VENDOR,
  [ORDER_STATUS.AT_GATE]: ACTOR.VENDOR,
  [ORDER_STATUS.DELIVERED]: ACTOR.STUDENT,
  [ORDER_STATUS.DELIVERED_TO_SECURITY]: ACTOR.VENDOR,
  [ORDER_STATUS.NO_SHOW]: ACTOR.VENDOR,
  [ORDER_STATUS.REJECTED_BY_VENDOR]: ACTOR.VENDOR,
  [ORDER_STATUS.EXPIRED_NO_ACK]: ACTOR.SYSTEM,
  [ORDER_STATUS.CANCELLED_BY_ADMIN]: ACTOR.ADMIN,
};

const driveSchema = z.object({
  orderId: z.string().min(1),
  to: z.string().min(1),
  prepMinutes: z.number().int().min(5).max(60).optional(),
  reason: z.string().optional(),
});

export async function driveDemoOrder(input: unknown): Promise<DemoActionState> {
  assertDemoMode();

  const parsed = driveSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid step." };

  const to = parsed.data.to as OrderStatus;
  const actor = ACTOR_FOR[to];
  if (!actor) return { status: "error", message: `Nothing in the machine fires ${to}.` };

  const order = await getOrder(parsed.data.orderId);
  if (!order) return { status: "error", message: "That order no longer exists." };

  const result = await transitionOrder({
    orderId: order._id,
    to,
    actor,
    reason: parsed.data.reason ?? `Demo panel: ${order.status} → ${to}`,
    ...(to === ORDER_STATUS.ACCEPTED
      ? { prepMinutes: parsed.data.prepMinutes ?? 20 }
      : {}),
  });

  if (!result.ok) return { status: "error", message: result.message };

  // The refunds are the point of half these transitions, so they fire here
  // exactly as they would from the real console.
  if (
    to === ORDER_STATUS.REJECTED_BY_VENDOR ||
    to === ORDER_STATUS.EXPIRED_NO_ACK ||
    to === ORDER_STATUS.CANCELLED_BY_ADMIN
  ) {
    await issueRefund({
      order: result.order,
      reason: `Demo: ${to}`,
      recoverGatewayFeeFromVendor: to !== ORDER_STATUS.CANCELLED_BY_ADMIN,
    });
  }

  if (to === ORDER_STATUS.NO_SHOW) {
    await recordStrike({
      userId: order.customerId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      reason: "NO_SHOW_COD",
      actor: ACTOR.VENDOR,
    });
  }

  if (to === ORDER_STATUS.AT_GATE) {
    await notifyOrderEvent({
      order: result.order,
      title: `Your order is at ${result.order.deliveryZoneSnapshot.name}`,
      body: "Match the four digits on the packet, then tap Confirm Received.",
      requireInteraction: true,
    });
  }

  revalidatePath("/demo");
  revalidatePath(`/orders/${order._id}`);
  return { status: "ok", message: `${order.orderNumber} → ${to}`, orderId: order._id };
}

/* ══════════════════════════════════════════════════════════════════════
   The edge cases
   ══════════════════════════════════════════════════════════════════════ */

/** F6 — 86 the first item on a cooking order and hand the choice to the student. */
export async function raiseDemoStockout(input: unknown): Promise<DemoActionState> {
  assertDemoMode();

  const parsed = z.object({ orderId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid order." };

  const order = await getOrder(parsed.data.orderId);
  if (!order) return { status: "error", message: "That order no longer exists." };

  const line = order.items[0];
  if (!line) return { status: "error", message: "That order has no items." };

  const result = await raiseStockout({ order, itemId: line.itemId });
  if (!result.ok) return { status: "error", message: result.message };

  await notifyOrderEvent({
    order: result.order,
    title: "One item ran out",
    body: `${line.name} is unavailable. Choose what to do — you have 5 minutes.`,
    requireInteraction: true,
  });

  revalidatePath("/demo");
  revalidatePath(`/orders/${order._id}`);
  return { status: "ok", message: `${line.name} 86-ed — the student now has to choose` };
}

/** F11 — the gate shut mid-flight, so the order moves to the 24x7 fallback. */
export async function rerouteDemoOrder(input: unknown): Promise<DemoActionState> {
  assertDemoMode();

  const parsed = z.object({ orderId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid order." };

  const order = await getOrder(parsed.data.orderId);
  if (!order) return { status: "error", message: "That order no longer exists." };

  const campus = await getCampusById(order.campusId);
  const fallback = campus?.zones.find((z) => z.isFallback && z.isActive && z.curfewMinutes === null);
  if (!fallback) return { status: "error", message: "This campus has no 24x7 fallback gate." };
  if (fallback.id === order.deliveryZoneSnapshot.zoneId) {
    return { status: "error", message: "This order already goes to the 24x7 gate." };
  }

  await (await db.orders()).updateOne(
    { _id: order._id },
    {
      $set: {
        deliveryZoneSnapshot: {
          zoneId: fallback.id,
          name: fallback.name,
          zoneType: fallback.zoneType,
          curfewMinutes: fallback.curfewMinutes,
          instructions: fallback.instructions,
        },
        reroutedFromZoneId: order.deliveryZoneSnapshot.zoneId,
        // The grace window restarts from zero: the student has further to walk.
        ...(order.status === ORDER_STATUS.AT_GATE ? { "timestamps.atGateAt": new Date() } : {}),
      },
    },
  );

  revalidatePath("/demo");
  revalidatePath(`/orders/${order._id}`);
  return { status: "ok", message: `Rerouted to ${fallback.name}` };
}

/**
 * Age an order so the next sweep acts on it.
 *
 * This is the one honest way to demonstrate a four-minute timer in a ninety
 * second demo: rather than faking the outcome, it moves the order's clock
 * backwards and lets the real sweep find it overdue. Everything downstream —
 * the transition, the refund, the audit entry — is genuine.
 */
export async function ageDemoOrder(input: unknown): Promise<DemoActionState> {
  assertDemoMode();

  const parsed = z
    .object({ orderId: z.string().min(1), minutes: z.number().int().min(1).max(240) })
    .safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid request." };

  const order = await getOrder(parsed.data.orderId);
  if (!order) return { status: "error", message: "That order no longer exists." };

  const shiftMs = parsed.data.minutes * 60_000;
  const shift = (value: Date | null): Date | null =>
    value === null ? null : new Date(value.getTime() - shiftMs);

  await (await db.orders()).updateOne(
    { _id: order._id },
    {
      $set: {
        "timestamps.createdAt": shift(order.timestamps.createdAt),
        "timestamps.placedAt": shift(order.timestamps.placedAt),
        "timestamps.acceptedAt": shift(order.timestamps.acceptedAt),
        "timestamps.atGateAt": shift(order.timestamps.atGateAt),
        ...(order.stockout
          ? { "stockout.expiresAt": new Date(order.stockout.expiresAt.getTime() - shiftMs) }
          : {}),
      },
    },
  );

  revalidatePath("/demo");
  return {
    status: "ok",
    message: `Clock moved back ${parsed.data.minutes} min — run the timers to see what fires`,
  };
}

export async function runDemoSweeps(): Promise<DemoActionState> {
  assertDemoMode();

  const reports = await runAllSweeps();
  const acted = reports.reduce((total, report) => total + report.acted, 0);
  const errors = reports.flatMap((report) => report.errors);

  revalidatePath("/demo");
  return {
    status: "ok",
    message:
      acted === 0
        ? "Nothing was overdue"
        : `${acted} order(s) actioned${errors.length > 0 ? `, ${errors.length} error(s)` : ""}`,
  };
}

/** Clear the demo's own orders so a pitch can start from a clean board. */
export async function resetDemoOrders(): Promise<DemoActionState> {
  assertDemoMode();

  const orders = await db.orders();
  const demoOrders = await orders
    .find({ idempotencyKey: { $regex: "^demo-" } })
    .project<{ _id: string }>({ _id: 1 })
    .toArray();

  const ids = demoOrders.map((order) => order._id);
  if (ids.length === 0) return { status: "ok", message: "Nothing to clear" };

  await orders.deleteMany({ _id: { $in: ids } });
  // The audit trail is append-only everywhere else in the system; these rows
  // belong to orders that no longer exist, so they go with them rather than
  // dangling in the log viewer.
  await (await db.auditLogs()).deleteMany({ orderId: { $in: ids } });

  revalidatePath("/demo");
  return { status: "ok", message: `Cleared ${ids.length} demo order(s)` };
}
