import "server-only";

import * as db from "@/server/db/collections";
import { newId, newOrderNumber } from "@/lib/ids";
import {
  ACTOR,
  DEFAULTS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  VENDOR_ACTIVE_STATUSES,
  type Actor,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/constants";
import type { Paise } from "@/lib/money";
import { assertTransition } from "./order-state";
import { computePricing, type PricingLineInput } from "./pricing";
import { generateGateCode } from "./gate-code";
import { writeAudit } from "./audit";
import { getCampusById, getMenuItemsByIds, getRestaurantById } from "./catalog";
import { validateCouponForOrder } from "./coupons";
import type { Campus, DeliveryZone } from "@/types/campus";
import type { MenuItem, Restaurant } from "@/types/restaurant";
import type { Order, OrderItem } from "@/types/order";
import type { User } from "@/types/user";
import type { Coupon } from "@/types/finance";

/**
 * Order creation and guarded state transitions.
 *
 * Two rules shape this whole file:
 *
 *   1. The SERVER recomputes every price. The client posts item ids and
 *      quantities; a client-supplied price is a security bug (PRD Part 4.2).
 *   2. Nothing outside `transitionOrder` may write `order.status`. Every
 *      transition is validated by the FSM and writes an audit entry, in one
 *      atomic update (PRD Part 4.7).
 */

/* ══════════════════════════════════════════════════════════════════════
   Cart pricing — the shared path
   ══════════════════════════════════════════════════════════════════════ */

export interface CartLineInput {
  itemId: string;
  quantity: number;
  /** Readonly: the service reads these, never mutates them, and callers
      routinely hand over a frozen literal. */
  addOnOptionIds: readonly string[];
}

/** F13/F14 — what changed between adding to the cart and trying to pay. */
export interface CartIssue {
  itemId: string;
  itemName: string;
  code: "UNAVAILABLE" | "PRICE_CHANGED" | "ADDON_UNAVAILABLE" | "NOT_FOUND";
  message: string;
}

export interface CartPreview {
  restaurant: Restaurant;
  campus: Campus;
  items: OrderItem[];
  pricing: ReturnType<typeof computePricing>["pricing"];
  onlinePaidPaise: Paise;
  cashDueOnDeliveryPaise: Paise;
  /** Non-empty means checkout must stop and the cart must re-render with the change highlighted. */
  issues: CartIssue[];
  /** Below the restaurant's minimum order. */
  belowMinimum: boolean;
  minOrderPaise: Paise;
}

/**
 * Price a cart, server-side, from item ids alone.
 *
 * Called by BOTH the cart preview screen and order creation, so the number the
 * student is shown and the number they are charged cannot drift. That is the
 * entire reason `computePricing` is a single pure function.
 */
export async function previewCart(params: {
  restaurantId: string;
  lines: readonly CartLineInput[];
  method: PaymentMethod;
  discountPaise?: Paise;
}): Promise<CartPreview | null> {
  const restaurant = await getRestaurantById(params.restaurantId);
  if (!restaurant) return null;

  const campus = await getCampusById(restaurant.campusId);
  if (!campus) return null;

  const itemMap = await getMenuItemsByIds(params.lines.map((l) => l.itemId));

  const issues: CartIssue[] = [];
  const orderItems: OrderItem[] = [];
  const pricingLines: PricingLineInput[] = [];

  for (const line of params.lines) {
    const item = itemMap.get(line.itemId);

    if (!item) {
      issues.push({
        itemId: line.itemId,
        itemName: "This item",
        code: "NOT_FOUND",
        message: "This item is no longer on the menu.",
      });
      continue;
    }

    // F14 — 86-ed between adding and paying. The item is dropped and the
    // student re-confirms; they are never charged for something not coming.
    if (!item.isAvailable) {
      issues.push({
        itemId: item._id,
        itemName: item.name,
        code: "UNAVAILABLE",
        message: `${item.name} just went out of stock.`,
      });
      continue;
    }

    const { addOns, unavailable } = resolveAddOns(item, line.addOnOptionIds);
    if (unavailable.length > 0) {
      issues.push({
        itemId: item._id,
        itemName: item.name,
        code: "ADDON_UNAVAILABLE",
        message: `${unavailable.join(", ")} on ${item.name} is no longer available.`,
      });
      continue;
    }

    pricingLines.push({
      quantity: line.quantity,
      unitPricePaise: item.pricePaise,
      addOnPricesPaise: addOns.map((a) => a.pricePaise),
    });

    orderItems.push({
      itemId: item._id,
      name: item.name,
      isVeg: item.isVeg,
      quantity: line.quantity,
      unitPricePaise: item.pricePaise,
      addOns,
      lineTotalPaise: 0, // filled in below, from the pricing result
    });
  }

  if (pricingLines.length === 0) return null;

  const commissionBps = restaurant.commissionBpsOverride ?? campus.settings.commissionBps;

  const result = computePricing({
    lines: pricingLines,
    packagingFeePaise: restaurant.packagingFeePaise,
    deliveryFeePaise: campus.settings.deliveryFeePaise,
    discountPaise: params.discountPaise ?? 0,
    commissionBps,
    gatewayFeeBps: campus.settings.gatewayFeeBps,
    codHandlingFeePaise: campus.settings.codHandlingFeePaise,
    method: params.method,
  });

  orderItems.forEach((item, i) => {
    item.lineTotalPaise = result.lineTotalsPaise[i] ?? 0;
  });

  return {
    restaurant,
    campus,
    items: orderItems,
    pricing: result.pricing,
    onlinePaidPaise: result.onlinePaidPaise,
    cashDueOnDeliveryPaise: result.cashDueOnDeliveryPaise,
    issues,
    belowMinimum: result.pricing.subtotalPaise < restaurant.minOrderPaise,
    minOrderPaise: restaurant.minOrderPaise,
  };
}

function resolveAddOns(
  item: MenuItem,
  optionIds: readonly string[],
): { addOns: { name: string; pricePaise: Paise }[]; unavailable: string[] } {
  const addOns: { name: string; pricePaise: Paise }[] = [];
  const unavailable: string[] = [];

  for (const group of item.addOnGroups) {
    for (const option of group.options) {
      if (!optionIds.includes(option.id)) continue;
      if (option.isAvailable) addOns.push({ name: option.name, pricePaise: option.pricePaise });
      else unavailable.push(option.name);
    }
  }

  return { addOns, unavailable };
}

/* ══════════════════════════════════════════════════════════════════════
   Order creation
   ══════════════════════════════════════════════════════════════════════ */

export type CreateOrderResult =
  | { ok: true; order: Order; reused: boolean }
  | { ok: false; code: "CART_INVALID" | "COD_BLOCKED" | "COD_DISABLED" | "BELOW_MINIMUM"; message: string; issues?: CartIssue[] };

export async function createOrder(params: {
  customer: User;
  restaurantId: string;
  zoneId: string;
  lines: readonly CartLineInput[];
  method: PaymentMethod;
  /** F12 — one per checkout attempt. A double-tap returns the SAME order. */
  idempotencyKey: string;
  discountPaise?: Paise | undefined;
  couponCode?: string | null | undefined;
}): Promise<CreateOrderResult> {
  const orders = await db.orders();

  // F12 — check before doing any work. The unique index below is the real
  // guarantee; this is the fast path that avoids a duplicate-key round trip.
  const existing = await orders.findOne({ idempotencyKey: params.idempotencyKey });
  if (existing) return { ok: true, order: existing, reused: true };

  let discountPaise = params.discountPaise ?? 0;
  let appliedCoupon: Coupon | null = null;

  if (params.couponCode) {
    const rawPreview = await previewCart({
      restaurantId: params.restaurantId,
      lines: params.lines,
      method: params.method,
    });
    if (rawPreview && rawPreview.issues.length === 0) {
      const couponValidation = await validateCouponForOrder({
        code: params.couponCode,
        restaurantId: params.restaurantId,
        campusId: rawPreview.campus._id,
        subtotalPaise: rawPreview.pricing.subtotalPaise,
        studentId: params.customer._id,
      });
      if (couponValidation.ok) {
        discountPaise = couponValidation.discountPaise;
        appliedCoupon = couponValidation.coupon;
      }
    }
  }

  const preview = await previewCart({
    restaurantId: params.restaurantId,
    lines: params.lines,
    method: params.method,
    discountPaise,
  });

  if (!preview) {
    return { ok: false, code: "CART_INVALID", message: "This cart can no longer be priced." };
  }

  // F13/F14 — never charge a price the student did not see, and never take an
  // order containing something the kitchen has run out of.
  if (preview.issues.length > 0) {
    return {
      ok: false,
      code: "CART_INVALID",
      message: "Your cart changed. Please review it before paying.",
      issues: preview.issues,
    };
  }

  if (preview.belowMinimum) {
    return {
      ok: false,
      code: "BELOW_MINIMUM",
      message: `${preview.restaurant.name} has a minimum order of ${preview.minOrderPaise / 100} rupees.`,
    };
  }

  if (params.method === PAYMENT_METHOD.HYBRID_COD) {
    // F9 — a student who refused cash cannot choose COD again. The UI hides it
    // entirely, but the server must refuse it too: the UI is not authorisation.
    if (params.customer.codBlocked) {
      return {
        ok: false,
        code: "COD_BLOCKED",
        message: "Cash on delivery is disabled on your account. You can still pay online.",
      };
    }
    if (!preview.campus.settings.codEnabled) {
      return {
        ok: false,
        code: "COD_DISABLED",
        message: "Cash on delivery is not available on this campus right now.",
      };
    }
  }

  const zone = preview.campus.zones.find((z) => z.id === params.zoneId);
  if (!zone) {
    return { ok: false, code: "CART_INVALID", message: "That delivery gate no longer exists." };
  }

  const orderNumber = await nextOrderNumber(preview.campus);
  const now = new Date();

  const order: Order = {
    _id: newId(),
    orderNumber,
    campusId: preview.campus._id,
    restaurantId: preview.restaurant._id,
    customerId: params.customer._id,

    // Snapshots, copied at creation and never joined at read time.
    customerSnapshot: {
      name: params.customer.name,
      phone: params.customer.phone ?? "",
    },
    restaurantSnapshot: {
      name: preview.restaurant.name,
      phone: preview.restaurant.phone,
    },
    deliveryZoneSnapshot: snapshotZone(zone),

    items: preview.items,
    pricing: preview.pricing,

    payment: {
      method: params.method,
      status: PAYMENT_STATUS.PENDING,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      onlinePaidPaise: 0, // set on capture, never optimistically
      cashDueOnDeliveryPaise: preview.cashDueOnDeliveryPaise,
      cashCollected: null,
    },

    // Created as PAYMENT_PENDING *before* the gateway opens, so an abandoned
    // payment still leaves a traceable record for the reconciliation cron (F1/F2).
    status: ORDER_STATUS.PAYMENT_PENDING,

    // Generated at creation but never exposed until READY (vendor) / AT_GATE
    // (student). See gate-code.ts.
    gateCode: generateGateCode(),
    prepMinutes: null,
    idempotencyKey: params.idempotencyKey,

    timestamps: {
      createdAt: now,
      placedAt: null,
      acceptedAt: null,
      readyAt: null,
      dispatchedAt: null,
      atGateAt: null,
      deliveredAt: null,
      settledAt: null,
    },
    cancellation: null,
    refund: null,
    stockout: null,
    reroutedFromZoneId: null,

    couponCode: appliedCoupon ? appliedCoupon.code : null,
    couponId: appliedCoupon ? appliedCoupon._id : null,
  };

  try {
    await orders.insertOne(order);

    if (appliedCoupon) {
      const couponsColl = await db.coupons();
      await couponsColl.updateOne(
        { _id: appliedCoupon._id },
        { $inc: { usedCount: 1 } },
      );
    }
  } catch (error: unknown) {
    // F12 — lost the race against a concurrent double-tap. The unique index on
    // idempotencyKey did its job; return the twin's winner, not an error.
    if (isDuplicateKey(error)) {
      const winner = await orders.findOne({ idempotencyKey: params.idempotencyKey });
      if (winner) return { ok: true, order: winner, reused: true };
    }
    throw error;
  }

  await writeAudit({
    entity: "ORDER",
    entityId: order._id,
    orderId: order._id,
    from: null,
    to: ORDER_STATUS.PAYMENT_PENDING,
    actorId: params.customer._id,
    actorRole: ACTOR.STUDENT,
    reason: `Order created, ${params.method}`,
  });

  return { ok: true, order, reused: false };
}

function snapshotZone(zone: DeliveryZone): Order["deliveryZoneSnapshot"] {
  return {
    zoneId: zone.id,
    name: zone.name,
    zoneType: zone.zoneType,
    curfewMinutes: zone.curfewMinutes,
    instructions: zone.instructions,
  };
}

/** Human-quotable and campus-scoped. One atomic increment, so no two orders collide. */
async function nextOrderNumber(campus: Campus): Promise<string> {
  const counters = await db.counters();
  const key = `orderNumber:${campus._id}`;
  const result = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" },
  );

  const sequence = result?.value ?? 1;
  const code = campus.slug.replace(/[^a-z0-9]/gi, "").slice(0, 4);
  return newOrderNumber(code, sequence);
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11_000;
}

/* ══════════════════════════════════════════════════════════════════════
   Guarded transitions — the ONLY place order.status is written
   ══════════════════════════════════════════════════════════════════════ */

export interface TransitionOptions {
  orderId: string;
  to: OrderStatus;
  actor: Actor;
  actorId?: string | null;
  reason?: string | undefined;
  prepMinutes?: number | undefined;
  /** Vendor-scoped calls pass this; the update refuses to match another restaurant's order. */
  requireRestaurantId?: string | undefined;
  /** Student-scoped calls pass this. */
  requireCustomerId?: string | undefined;
}

export type TransitionResult =
  | { ok: true; order: Order }
  | { ok: false; code: string; message: string };

/**
 * Validate, apply and audit one transition.
 *
 * Ownership is enforced INSIDE the update filter, not by a prior read: a
 * check-then-write pair can be raced, and "every Server Action re-checks role
 * AND resource ownership" (PRD Part 4.9) means the database has to be the one
 * saying no.
 */
export async function transitionOrder(options: TransitionOptions): Promise<TransitionResult> {
  const orders = await db.orders();

  const scope: Record<string, unknown> = { _id: options.orderId };
  if (options.requireRestaurantId !== undefined) scope.restaurantId = options.requireRestaurantId;
  if (options.requireCustomerId !== undefined) scope.customerId = options.requireCustomerId;

  const order = await orders.findOne(scope);
  if (!order) {
    return { ok: false, code: "NOT_FOUND", message: "That order does not exist, or is not yours." };
  }

  let plan;
  try {
    plan = assertTransition(
      { status: order.status, gateCode: order.gateCode, prepMinutes: order.prepMinutes },
      {
        to: options.to,
        actor: options.actor,
        reason: options.reason,
        prepMinutes: options.prepMinutes,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Illegal transition.";
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "ILLEGAL_TRANSITION";
    return { ok: false, code, message };
  }

  const now = new Date();
  const set: Record<string, unknown> = { status: options.to };

  const stampField = TIMESTAMP_FOR[options.to];
  if (stampField) set[`timestamps.${stampField}`] = now;

  if (options.to === ORDER_STATUS.ACCEPTED && options.prepMinutes !== undefined) {
    set.prepMinutes = options.prepMinutes;
  }

  if (CANCELLED_STATUSES.has(options.to)) {
    set.cancellation = {
      reason: plan.reason ?? "No reason given",
      by: options.actor === ACTOR.VENDOR ? "VENDOR" : options.actor === ACTOR.ADMIN ? "ADMIN" : "SYSTEM",
      at: now,
    };
  }

  // The status guard in the filter makes this a compare-and-swap: two vendors
  // tapping Accept on the same tablet cannot both win.
  const updated = await orders.findOneAndUpdate(
    { ...scope, status: order.status },
    { $set: set },
    { returnDocument: "after" },
  );

  if (!updated) {
    return {
      ok: false,
      code: "CONCURRENT_UPDATE",
      message: "This order changed while you were looking at it. Refresh and try again.",
    };
  }

  await writeAudit({
    entity: "ORDER",
    entityId: order._id,
    orderId: order._id,
    from: plan.from,
    to: plan.to,
    actorId: options.actorId ?? null,
    actorRole: options.actor,
    reason: plan.reason,
  });

  return { ok: true, order: updated };
}

const TIMESTAMP_FOR: Partial<Record<OrderStatus, keyof Order["timestamps"]>> = {
  [ORDER_STATUS.PLACED]: "placedAt",
  [ORDER_STATUS.ACCEPTED]: "acceptedAt",
  [ORDER_STATUS.READY]: "readyAt",
  [ORDER_STATUS.OUT_FOR_DELIVERY]: "dispatchedAt",
  [ORDER_STATUS.AT_GATE]: "atGateAt",
  [ORDER_STATUS.DELIVERED]: "deliveredAt",
  [ORDER_STATUS.DELIVERED_TO_SECURITY]: "deliveredAt",
  [ORDER_STATUS.SETTLED]: "settledAt",
};

const CANCELLED_STATUSES = new Set<OrderStatus>([
  ORDER_STATUS.REJECTED_BY_VENDOR,
  ORDER_STATUS.EXPIRED_NO_ACK,
  ORDER_STATUS.CANCELLED_BY_ADMIN,
  ORDER_STATUS.NO_SHOW,
]);

/* ══════════════════════════════════════════════════════════════════════
   Reads
   ══════════════════════════════════════════════════════════════════════ */

export async function getOrder(orderId: string): Promise<Order | null> {
  return (await db.orders()).findOne({ _id: orderId });
}

export async function getOrderForCustomer(orderId: string, customerId: string): Promise<Order | null> {
  return (await db.orders()).findOne({ _id: orderId, customerId });
}

export async function listOrdersForCustomer(customerId: string, limit = 30): Promise<Order[]> {
  return (await db.orders())
    .find({ customerId })
    .sort({ "timestamps.createdAt": -1 })
    .limit(limit)
    .toArray();
}

/** The vendor board query. Runs every 5 seconds, so it must hit `restaurant_status`. */
export async function listActiveOrdersForRestaurant(restaurantId: string): Promise<Order[]> {
  return (await db.orders())
    .find({ restaurantId, status: { $in: [...VENDOR_ACTIVE_STATUSES] } })
    .sort({ "timestamps.placedAt": 1 })
    .toArray();
}

export async function listOrdersForCampus(campusId: string, limit = 100): Promise<Order[]> {
  return (await db.orders())
    .find({ campusId })
    .sort({ "timestamps.createdAt": -1 })
    .limit(limit)
    .toArray();
}

/* ══════════════════════════════════════════════════════════════════════
   Derived values the UI needs
   ══════════════════════════════════════════════════════════════════════ */

/**
 * ETA, computed from real events rather than guessed.
 *
 * `acceptedAt + prepMinutes + campusTransitMinutes` — this is the whole
 * replacement for a live map (DECISIONS section 2). Null before acceptance,
 * because before a vendor commits to a prep time there is genuinely nothing
 * honest to show.
 */
export function estimatedArrival(order: Order, transitMinutes: number): Date | null {
  const acceptedAt = order.timestamps.acceptedAt;
  if (!acceptedAt || order.prepMinutes === null) return null;
  return new Date(acceptedAt.getTime() + (order.prepMinutes + transitMinutes) * 60_000);
}

/** F4 — when the vendor's acknowledgement window runs out. */
export function ackDeadline(order: Order, campus: Campus): Date | null {
  const placedAt = order.timestamps.placedAt;
  if (!placedAt || order.status !== ORDER_STATUS.PLACED) return null;
  return new Date(placedAt.getTime() + campus.settings.vendorAutoExpireSeconds * 1_000);
}

/** A6 — when the 15-minute gate grace expires. */
export function gateDeadline(order: Order, campus: Campus): Date | null {
  const atGateAt = order.timestamps.atGateAt;
  if (!atGateAt || order.status !== ORDER_STATUS.AT_GATE) return null;
  return new Date(atGateAt.getTime() + campus.settings.gateGraceSeconds * 1_000);
}

/** Section 3 — the 30-minute dispute window after delivery. */
export function disputeWindowOpen(order: Order, now: Date = new Date()): boolean {
  const deliveredAt = order.timestamps.deliveredAt;
  if (!deliveredAt) return false;
  if (order.status !== ORDER_STATUS.DELIVERED && order.status !== ORDER_STATUS.DELIVERED_TO_SECURITY) {
    return false;
  }
  return now.getTime() - deliveredAt.getTime() < DEFAULTS.disputeWindowMinutes * 60_000;
}
