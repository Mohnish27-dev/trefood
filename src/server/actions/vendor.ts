"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import * as db from "@/server/db/collections";
import { ACTOR, DEFAULTS, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/constants";
import { formatINR } from "@/lib/money";
import { requireVendor } from "@/server/auth/session";
import { getCampusById } from "@/server/services/catalog";
import { getOrder, transitionOrder } from "@/server/services/orders";
import { issueRefund } from "@/server/services/refunds";
import { raiseStockout } from "@/server/services/stockout";
import { recordStrike } from "@/server/services/students";
import { notifyOrderEvent } from "@/server/services/push";
import { writeAudit } from "@/server/services/audit";
import type { Order } from "@/types/order";

/**
 * Vendor Server Actions — thin adapters.
 *
 * Every one of them re-checks role AND resource ownership, because middleware
 * is not authorisation (PRD Part 4.9). The restaurant id comes from the
 * SESSION and is passed to `transitionOrder` as `requireRestaurantId`, so the
 * ownership check happens inside the update filter rather than in a
 * check-then-write pair that could be raced. A client-supplied restaurantId is
 * never trusted anywhere in this file.
 */

export type VendorActionState =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string };

const orderIdSchema = z.object({ orderId: z.string().min(1) });

/* ══════════════════════════════════════════════════════════════════════
   The board taps
   ══════════════════════════════════════════════════════════════════════ */

const acceptSchema = z.object({
  orderId: z.string().min(1),
  prepMinutes: z.number().int().min(DEFAULTS.prepMinutesMin).max(DEFAULTS.prepMinutesMax),
});

/**
 * Accept, with a prep time.
 *
 * The prep time is not decoration: the student's whole ETA is
 * `acceptedAt + prepMinutes + transitMinutes`, and it is the only honest
 * number available in a product with no rider GPS. A vendor who types 15 and
 * cooks for 40 has broken the one promise the app makes.
 *
 * ACCEPTED moves straight on to PREPARING, which the FSM marks automatic:
 * there is no real moment between the two, and a board column nobody can act
 * on is noise.
 */
export async function acceptOrder(input: unknown): Promise<VendorActionState> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid prep time." };
  }

  const { restaurantId, user } = await requireVendor();

  const accepted = await transitionOrder({
    orderId: parsed.data.orderId,
    to: ORDER_STATUS.ACCEPTED,
    actor: ACTOR.VENDOR,
    actorId: user._id,
    requireRestaurantId: restaurantId,
    prepMinutes: parsed.data.prepMinutes,
    reason: `Accepted with a ${parsed.data.prepMinutes} minute prep time`,
  });
  if (!accepted.ok) return { status: "error", message: accepted.message };

  const cooking = await transitionOrder({
    orderId: parsed.data.orderId,
    to: ORDER_STATUS.PREPARING,
    actor: ACTOR.VENDOR,
    actorId: user._id,
    requireRestaurantId: restaurantId,
    reason: "Automatic on accept",
  });
  if (!cooking.ok) return { status: "error", message: cooking.message };

  await notifyOrderEvent({
    order: cooking.order,
    title: "Order accepted",
    body: `${cooking.order.restaurantSnapshot.name} is cooking. About ${parsed.data.prepMinutes} minutes.`,
  });

  revalidatePath("/vendor/orders");
  return { status: "ok", message: `Accepted — ${parsed.data.prepMinutes} min` };
}

const rejectSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3, "Say why. The student sees this."),
});

/** F5 — rejection, with a written reason and a full refund. */
export async function rejectOrder(input: unknown): Promise<VendorActionState> {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const { restaurantId, user } = await requireVendor();

  const rejected = await transitionOrder({
    orderId: parsed.data.orderId,
    to: ORDER_STATUS.REJECTED_BY_VENDOR,
    actor: ACTOR.VENDOR,
    actorId: user._id,
    requireRestaurantId: restaurantId,
    reason: parsed.data.reason,
  });
  if (!rejected.ok) return { status: "error", message: rejected.message };

  // D1/D3 — vendor fault, so the student is made whole and the fee that the
  // gateway keeps is booked against this restaurant's next payout.
  const refund = await issueRefund({
    order: rejected.order,
    reason: `Rejected by vendor: ${parsed.data.reason}`,
    actorId: user._id,
  });
  if (!refund.ok) return { status: "error", message: `Order rejected, but the refund failed: ${refund.message}` };

  await notifyOrderEvent({
    order: rejected.order,
    title: "Order could not be accepted",
    body: `${rejected.order.restaurantSnapshot.name}: ${parsed.data.reason}. Your refund is on its way.`,
  });

  revalidatePath("/vendor/orders");
  return { status: "ok", message: "Rejected and refunded" };
}

/** Packed. This is where the gate code becomes visible to the vendor. */
export async function markReady(input: unknown): Promise<VendorActionState> {
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid order." };

  const { restaurantId, user } = await requireVendor();

  const result = await transitionOrder({
    orderId: parsed.data.orderId,
    to: ORDER_STATUS.READY,
    actor: ACTOR.VENDOR,
    actorId: user._id,
    requireRestaurantId: restaurantId,
    reason: "Packed; gate code released to the kitchen",
  });
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/vendor/orders");
  return { status: "ok", message: "Write the code on the packet" };
}

export async function dispatchRider(input: unknown): Promise<VendorActionState> {
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid order." };

  const { restaurantId, user } = await requireVendor();

  const result = await transitionOrder({
    orderId: parsed.data.orderId,
    to: ORDER_STATUS.OUT_FOR_DELIVERY,
    actor: ACTOR.VENDOR,
    actorId: user._id,
    requireRestaurantId: restaurantId,
    reason: "Rider left with the packet",
  });
  if (!result.ok) return { status: "error", message: result.message };

  await notifyOrderEvent({
    order: result.order,
    title: "On the way",
    body: `Your order has left ${result.order.restaurantSnapshot.name}.`,
  });

  revalidatePath("/vendor/orders");
  return { status: "ok", message: "Marked on the way" };
}

/**
 * ★ The most operationally critical tap in the product ★
 *
 * It is the single event that reveals the gate code to the student, sends the
 * push, and starts the 15-minute grace timer. Everything the student
 * experiences at the gate hangs off this one button, which is why the board
 * nags about it after twice the prep time (F18).
 */
export async function riderAtGate(input: unknown): Promise<VendorActionState> {
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid order." };

  const { restaurantId, user } = await requireVendor();

  const result = await transitionOrder({
    orderId: parsed.data.orderId,
    to: ORDER_STATUS.AT_GATE,
    actor: ACTOR.VENDOR,
    actorId: user._id,
    requireRestaurantId: restaurantId,
    reason: "Rider reached the gate",
  });
  if (!result.ok) return { status: "error", message: result.message };

  const order = result.order;
  const cash =
    order.payment.method === PAYMENT_METHOD.HYBRID_COD
      ? ` Keep ${formatINR(order.payment.cashDueOnDeliveryPaise)} in cash ready.`
      : "";

  await notifyOrderEvent({
    order,
    title: `Your order is at ${order.deliveryZoneSnapshot.name}`,
    body: `Match the 4-digit code on the packet, then tap Confirm Received.${cash}`,
    // The one notification worth surviving a glance at a lock screen.
    requireInteraction: true,
  });

  revalidatePath("/vendor/orders");
  return { status: "ok", message: "Student notified" };
}

/* ══════════════════════════════════════════════════════════════════════
   Gate outcomes the vendor reports
   ══════════════════════════════════════════════════════════════════════ */

/** COD fallback: the rider came back with the right cash, student never tapped. */
export async function confirmCashCollected(input: unknown): Promise<VendorActionState> {
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid order." };

  const { restaurantId, user } = await requireVendor();

  const order = await scopedOrder(parsed.data.orderId, restaurantId);
  if (!order) return { status: "error", message: "That order is not yours." };
  if (order.payment.method !== PAYMENT_METHOD.HYBRID_COD) {
    return { status: "error", message: "This is a prepaid order — there is no cash to collect." };
  }

  const result = await transitionOrder({
    orderId: order._id,
    to: ORDER_STATUS.DELIVERED,
    actor: ACTOR.VENDOR,
    actorId: user._id,
    requireRestaurantId: restaurantId,
    reason: "Rider returned with the correct cash",
  });
  if (!result.ok) return { status: "error", message: result.message };

  await (await db.orders()).updateOne(
    { _id: order._id },
    { $set: { "payment.cashCollected": true } },
  );

  revalidatePath("/vendor/orders");
  return { status: "ok", message: "Closed as delivered" };
}

/** F7 — prepaid, nobody came. The packet goes to the hostel guard. */
export async function leaveWithSecurity(input: unknown): Promise<VendorActionState> {
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid order." };

  const { restaurantId, user } = await requireVendor();

  const result = await transitionOrder({
    orderId: parsed.data.orderId,
    to: ORDER_STATUS.DELIVERED_TO_SECURITY,
    actor: ACTOR.VENDOR,
    actorId: user._id,
    requireRestaurantId: restaurantId,
    reason: "Student did not come to the gate; packet left with security",
  });
  if (!result.ok) return { status: "error", message: result.message };

  await notifyOrderEvent({
    order: result.order,
    title: "Left with gate security",
    body: `Your order is with security at ${result.order.deliveryZoneSnapshot.name}. Collect it there.`,
  });

  revalidatePath("/vendor/orders");
  return { status: "ok", message: "Recorded as left with security" };
}

const noShowSchema = z.object({
  orderId: z.string().min(1),
  /** F8 is accidental and takes two; F9 is deliberate and takes one. */
  refused: z.boolean(),
});

/**
 * F8 / F9 — the COD order that came back.
 *
 * No refund, ever: the food was cooked and carried, and the token stays with
 * the vendor as compensation. That is D1 working exactly as intended — refunds
 * are for vendor and platform fault, and this is neither.
 */
export async function reportNoShow(input: unknown): Promise<VendorActionState> {
  const parsed = noShowSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid request." };

  const { restaurantId, user } = await requireVendor();

  const order = await scopedOrder(parsed.data.orderId, restaurantId);
  if (!order) return { status: "error", message: "That order is not yours." };

  const result = await transitionOrder({
    orderId: order._id,
    to: ORDER_STATUS.NO_SHOW,
    actor: ACTOR.VENDOR,
    actorId: user._id,
    requireRestaurantId: restaurantId,
    reason: parsed.data.refused
      ? "Student refused to pay the cash at the gate"
      : "Student did not come to the gate",
  });
  if (!result.ok) return { status: "error", message: result.message };

  if (parsed.data.refused) {
    await (await db.orders()).updateOne(
      { _id: order._id },
      { $set: { "payment.cashCollected": false } },
    );
  }

  const strike = await recordStrike({
    userId: order.customerId,
    orderId: order._id,
    orderNumber: order.orderNumber,
    reason: parsed.data.refused ? "REFUSED_PAYMENT" : "NO_SHOW_COD",
    actor: ACTOR.VENDOR,
    actorId: user._id,
  });

  revalidatePath("/vendor/orders");
  return {
    status: "ok",
    message:
      strike?.codBlockedNow === true
        ? "Recorded. Cash on delivery is now disabled for this student."
        : "Recorded",
  };
}

/**
 * F11 layer 2 — the gate shut while the rider was in transit.
 *
 * The order is redirected to the campus 24x7 fallback gate and the grace timer
 * restarts from zero, because a student told to walk to a different gate needs
 * the full fifteen minutes again, not whatever was left of the old window.
 */
export async function rerouteToFallbackGate(input: unknown): Promise<VendorActionState> {
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid order." };

  const { restaurantId, user } = await requireVendor();

  const order = await scopedOrder(parsed.data.orderId, restaurantId);
  if (!order) return { status: "error", message: "That order is not yours." };

  const campus = await getCampusById(order.campusId);
  const fallback = campus?.zones.find((z) => z.isFallback && z.isActive && z.curfewMinutes === null);
  if (!fallback) {
    return { status: "error", message: "This campus has no 24x7 fallback gate configured." };
  }
  if (fallback.id === order.deliveryZoneSnapshot.zoneId) {
    return { status: "error", message: "This order is already going to the 24x7 gate." };
  }

  const previousZoneId = order.deliveryZoneSnapshot.zoneId;

  await (await db.orders()).updateOne(
    { _id: order._id, restaurantId },
    {
      $set: {
        deliveryZoneSnapshot: {
          zoneId: fallback.id,
          name: fallback.name,
          zoneType: fallback.zoneType,
          curfewMinutes: fallback.curfewMinutes,
          instructions: fallback.instructions,
        },
        reroutedFromZoneId: previousZoneId,
        // Restart the grace window from zero. The student has further to walk.
        "timestamps.atGateAt":
          order.status === ORDER_STATUS.AT_GATE ? new Date() : order.timestamps.atGateAt,
      },
    },
  );

  await writeAudit({
    entity: "ORDER",
    entityId: order._id,
    orderId: order._id,
    from: order.deliveryZoneSnapshot.name,
    to: fallback.name,
    actorId: user._id,
    actorRole: ACTOR.VENDOR,
    reason: "F11 reroute: original gate closed before the rider arrived",
  });

  await notifyOrderEvent({
    order,
    title: "Your gate changed",
    body: `${order.deliveryZoneSnapshot.name} has closed. Collect from ${fallback.name} instead.`,
    requireInteraction: true,
  });

  revalidatePath("/vendor/orders");
  return { status: "ok", message: `Rerouted to ${fallback.name}` };
}

/* ══════════════════════════════════════════════════════════════════════
   Menu — the 86 tap
   ══════════════════════════════════════════════════════════════════════ */

const availabilitySchema = z.object({
  itemId: z.string().min(1),
  isAvailable: z.boolean(),
});

/** Orders already in the kitchen that contain this item. F6 starts from these. */
export interface AffectedOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
}

export type EightySixResult = VendorActionState & { affectedOrders?: AffectedOrder[] };

/**
 * One tap marks an item out of stock for every FUTURE order, instantly.
 *
 * Availability is a boolean and never a count. True stock counting means
 * decrements, reservations and TTL release on abandoned carts — enormous
 * machinery for a canteen that cooks to order, and the failures doc rules it
 * out explicitly.
 *
 * The second half is F6: any order already accepted that contains this item
 * has to be resolved with its student, so those are returned for the UI to
 * open the substitution flow on.
 */
export async function setItemAvailability(input: unknown): Promise<EightySixResult> {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid item." };

  const { restaurantId, user } = await requireVendor();

  const items = await db.menuItems();
  const updated = await items.findOneAndUpdate(
    { _id: parsed.data.itemId, restaurantId },
    { $set: { isAvailable: parsed.data.isAvailable } },
    { returnDocument: "after" },
  );
  if (!updated) return { status: "error", message: "That item is not on your menu." };

  await writeAudit({
    entity: "RESTAURANT",
    entityId: restaurantId,
    from: parsed.data.isAvailable ? "unavailable" : "available",
    to: parsed.data.isAvailable ? "available" : "unavailable",
    actorId: user._id,
    actorRole: ACTOR.VENDOR,
    reason: `${updated.name} ${parsed.data.isAvailable ? "back on" : "86-ed"}`,
  });

  revalidatePath("/vendor/menu");

  if (parsed.data.isAvailable) return { status: "ok", message: `${updated.name} is back on` };

  const inFlight = await (await db.orders())
    .find({
      restaurantId,
      status: { $in: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING] },
      "items.itemId": parsed.data.itemId,
    })
    .toArray();

  return {
    status: "ok",
    message:
      inFlight.length === 0
        ? `${updated.name} is off the menu`
        : `${updated.name} is off the menu — ${inFlight.length} order(s) already cooking need a decision`,
    affectedOrders: inFlight.map((order) => ({
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerName: order.customerSnapshot.name,
    })),
  };
}

const stockoutSchema = z.object({
  orderId: z.string().min(1),
  itemId: z.string().min(1),
});

/** F6 — hand the decision to the student, with a five-minute timer. */
export async function raiseStockoutForOrder(input: unknown): Promise<VendorActionState> {
  const parsed = stockoutSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid request." };

  const { restaurantId, user } = await requireVendor();

  const order = await scopedOrder(parsed.data.orderId, restaurantId);
  if (!order) return { status: "error", message: "That order is not yours." };

  const result = await raiseStockout({ order, itemId: parsed.data.itemId });
  if (!result.ok) return { status: "error", message: result.message };

  await writeAudit({
    entity: "ORDER",
    entityId: order._id,
    orderId: order._id,
    from: order.status,
    to: order.status,
    actorId: user._id,
    actorRole: ACTOR.VENDOR,
    reason: `Stockout sent to the student for ${result.order.stockout?.itemName ?? "an item"}`,
  });

  await notifyOrderEvent({
    order: result.order,
    title: "One item ran out",
    body: `${result.order.stockout?.itemName ?? "An item"} is unavailable. Choose what to do — you have 5 minutes.`,
    requireInteraction: true,
  });

  revalidatePath("/vendor/orders");
  return { status: "ok", message: "The student has 5 minutes to choose" };
}

/* ══════════════════════════════════════════════════════════════════════
   Settings
   ══════════════════════════════════════════════════════════════════════ */

/**
 * The surge release valve. One tap, and the restaurant stops taking orders.
 *
 * This is the fix for an exam-week flood, and it is worth teaching on day one:
 * twenty minutes closed beats a cascade of F4 expiries and three refunds.
 */
export async function setRestaurantOpen(input: unknown): Promise<VendorActionState> {
  const parsed = z.object({ isOpen: z.boolean() }).safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid request." };

  const { restaurantId, user } = await requireVendor();

  await (await db.restaurants()).updateOne(
    { _id: restaurantId },
    {
      $set: {
        isOpen: parsed.data.isOpen,
        // Reopening by hand clears the F4 auto-close, so the vendor is not
        // fighting the sweep that shut them.
        ...(parsed.data.isOpen ? { autoClosedAt: null, expiryCountToday: 0 } : {}),
        updatedAt: new Date(),
      },
    },
  );

  await writeAudit({
    entity: "RESTAURANT",
    entityId: restaurantId,
    from: parsed.data.isOpen ? "closed" : "open",
    to: parsed.data.isOpen ? "open" : "closed",
    actorId: user._id,
    actorRole: ACTOR.VENDOR,
    reason: parsed.data.isOpen ? "Vendor reopened" : "Vendor closed for now",
  });

  revalidatePath("/vendor/orders");
  revalidatePath("/vendor/settings");
  return { status: "ok", message: parsed.data.isOpen ? "Taking orders" : "Closed for now" };
}

const settingsSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number"),
  prepMinutes: z.number().int().min(DEFAULTS.prepMinutesMin).max(DEFAULTS.prepMinutesMax),
  opensMinutes: z.number().int().min(0).max(1_439),
  closesMinutes: z.number().int().min(0).max(1_439),
  packagingFeePaise: z.number().int().min(0).max(50_000),
  minOrderPaise: z.number().int().min(0).max(500_000),
  /** The single most structural setting in the product: which gates you serve. */
  servedZoneIds: z.array(z.string().min(1)).min(1, "Serve at least one gate"),
});

export async function updateVendorSettings(input: unknown): Promise<VendorActionState> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }

  const { restaurantId, user } = await requireVendor();

  const restaurant = await (await db.restaurants()).findOne({ _id: restaurantId });
  if (!restaurant) return { status: "error", message: "Restaurant not found." };

  // Never trust a zone id from the client: a vendor could otherwise declare
  // they serve a gate on another campus and appear in someone else's list.
  const campus = await getCampusById(restaurant.campusId);
  const validZoneIds = new Set((campus?.zones ?? []).map((z) => z.id));
  const servedZoneIds = parsed.data.servedZoneIds.filter((id) => validZoneIds.has(id));
  if (servedZoneIds.length === 0) {
    return { status: "error", message: "Pick at least one gate on your own campus." };
  }

  await (await db.restaurants()).updateOne(
    { _id: restaurantId },
    {
      $set: {
        phone: parsed.data.phone,
        prepMinutes: parsed.data.prepMinutes,
        opensMinutes: parsed.data.opensMinutes,
        closesMinutes: parsed.data.closesMinutes,
        packagingFeePaise: parsed.data.packagingFeePaise,
        minOrderPaise: parsed.data.minOrderPaise,
        servedZoneIds,
        updatedAt: new Date(),
      },
    },
  );

  await writeAudit({
    entity: "RESTAURANT",
    entityId: restaurantId,
    from: "settings",
    to: `${servedZoneIds.length} zone(s), ${parsed.data.prepMinutes} min prep`,
    actorId: user._id,
    actorRole: ACTOR.VENDOR,
    reason: "Vendor updated hours, fees or served gates",
  });

  revalidatePath("/vendor/settings");
  revalidatePath("/vendor/orders");
  return { status: "ok", message: "Saved" };
}

/* ------------------------------------------------------------------ */

/** Ownership-scoped read. Never `getOrder` by id alone in this file. */
async function scopedOrder(orderId: string, restaurantId: string): Promise<Order | null> {
  const order = await getOrder(orderId);
  return order && order.restaurantId === restaurantId ? order : null;
}
