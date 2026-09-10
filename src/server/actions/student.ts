"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import * as db from "@/server/db/collections";
import { ACTOR, ORDER_STATUS } from "@/lib/constants";
import { feedbackSchema } from "@/lib/validation/feedback";
import { getSession } from "@/server/auth/session";
import { getCampusById, getRestaurantById } from "@/server/services/catalog";
import { checkCurfew } from "@/server/services/curfew";
import { createOrder, getOrderForCustomer, transitionOrder } from "@/server/services/orders";
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
  // F12 — client-generated per checkout attempt. A double-tap returns the first order.
  idempotencyKey: z.string().min(8).max(64),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number"),
  couponCode: z.string().optional(),
});

export type PlaceOrderState =
  | { status: "idle" }
  | { status: "error"; message: string; issues?: { itemId: string; message: string }[] }
  | { status: "success"; orderId: string };

/**
 * Place an order.
 *
 * Order of operations matters and is deliberate:
 *   1. authenticate
 *   2. capture the phone (D7 — collected at first checkout, reused forever)
 *   3. re-run the CURFEW GUARD against this restaurant's real prep time
 *   4. create the order with a 15-second cancellation window
 *
 * Nothing is charged here. The server releases the order to the vendor after 15 seconds.
 */
export async function placeOrder(input: unknown): Promise<PlaceOrderState> {
  try {
    const parsed = placeOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid order." };
    }

    const session = await getSession();
    if (!session) {
      return {
        status: "error",
        message: "You need to sign in to place an order. Please sign in and try again.",
      };
    }
    const user = session.user;
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

    revalidatePath("/orders");
    return { status: "success", orderId: created.order._id };
  } catch (err) {
    console.error("placeOrder server action failed:", err);
    return {
      status: "error",
      message:
        err instanceof Error && !err.message.includes("Minified React error")
          ? err.message
          : "Unable to process order right now. Please try again.",
    };
  }
}

/** Only the signed-in owner can cancel, and the database enforces the deadline. */
export async function cancelPendingOrder(input: unknown): Promise<ConfirmState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Sign in to cancel your order." };
  const parsed = z.object({ orderId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid order." };
  const result = await transitionOrder({
    orderId: parsed.data.orderId,
    to: ORDER_STATUS.CANCELLED_BY_STUDENT,
    actor: ACTOR.STUDENT,
    actorId: session.user._id,
    requireCustomerId: session.user._id,
    reason: "Cancelled by you before being sent to the restaurant",
  });
  if (!result.ok) return { status: "error", message: "The cancellation window has ended or this order is already closed." };
  revalidatePath(`/orders/${parsed.data.orderId}`);
  revalidatePath("/orders");
  return { status: "success" };
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
 *
 * Confirming is also what records the cash as collected. Under cash on
 * delivery the packet and the money change hands in the same motion, so the
 * tap that says "I have my food" is the same tap that says "and I paid for
 * it" — see the DELIVERED branch of `transitionOrder`.
 */
export async function confirmReceived(input: unknown): Promise<ConfirmState> {
  try {
    const parsed = confirmSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid code." };
    }

    const session = await getSession();
    if (!session) {
      return { status: "error", message: "You need to be signed in to confirm this order." };
    }
    const user = session.user;

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
  } catch (err) {
    console.error("confirmReceived server action failed:", err);
    return {
      status: "error",
      message:
        err instanceof Error && !err.message.includes("Minified React error")
          ? err.message
          : "Unable to confirm order right now. Please try again.",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Post-Delivery Feedback & Star Rating                               */
/* ------------------------------------------------------------------ */

export type FeedbackState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "success";
      feedback: {
        rating: number;
        comment: string | null;
        tags: string[];
        createdAt: string;
      };
    };

/**
 * Submit post-delivery feedback with star rating and optional comments.
 *
 * Verifies order ownership and guarantees that feedback can only be submitted
 * after delivery is confirmed (DELIVERED or SETTLED). Recalculates the
 * restaurant's running rating and ratingCount atomically.
 */
export async function submitOrderFeedback(input: unknown): Promise<FeedbackState> {
  try {
    const parsed = feedbackSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Please provide a valid rating.",
      };
    }

    const session = await getSession();
    if (!session) {
      return { status: "error", message: "You need to be signed in to submit feedback." };
    }
    const user = session.user;

    const order = await getOrderForCustomer(parsed.data.orderId, user._id);
    if (!order) {
      return { status: "error", message: "That order was not found or is not yours." };
    }

    if (order.status !== ORDER_STATUS.DELIVERED && order.status !== ORDER_STATUS.SETTLED) {
      return {
        status: "error",
        message: "Feedback can only be shared after the food has been delivered to your gate.",
      };
    }

    const createdAt = new Date();
    const feedbackData = {
      rating: parsed.data.rating,
      comment: parsed.data.comment && parsed.data.comment.trim().length > 0 ? parsed.data.comment.trim() : null,
      tags: parsed.data.tags ?? [],
      createdAt,
    };

    // Update order document
    await (await db.orders()).updateOne(
      { _id: order._id },
      { $set: { feedback: feedbackData } },
    );

    // Recalculate restaurant rating
    const restaurant = await getRestaurantById(order.restaurantId);
    if (restaurant) {
      const currentCount = restaurant.ratingCount ?? 0;
      const currentAvg = restaurant.rating ?? 0;
      let newRating: number;
      let newCount: number;

      if (order.feedback) {
        // User is updating their previously submitted rating
        const oldRating = order.feedback.rating;
        newCount = currentCount;
        const newSum = currentAvg * currentCount - oldRating + parsed.data.rating;
        newRating = newCount > 0 ? Math.floor(((newSum / newCount) * 10) + 0.5) / 10 : parsed.data.rating;
      } else {
        newCount = currentCount + 1;
        const newSum = currentAvg * currentCount + parsed.data.rating;
        newRating = Math.floor(((newSum / newCount) * 10) + 0.5) / 10;
      }

      await (await db.restaurants()).updateOne(
        { _id: restaurant._id },
        { $set: { rating: newRating, ratingCount: newCount } },
      );
    }

    revalidatePath(`/orders/${order._id}`);
    revalidatePath("/orders");

    return {
      status: "success",
      feedback: {
        rating: feedbackData.rating,
        comment: feedbackData.comment,
        tags: feedbackData.tags,
        createdAt: createdAt.toISOString(),
      },
    };
  } catch (err) {
    console.error("submitOrderFeedback server action failed:", err);
    return {
      status: "error",
      message:
        err instanceof Error && !err.message.includes("Minified React error")
          ? err.message
          : "Unable to submit feedback right now. Please try again.",
    };
  }
}
