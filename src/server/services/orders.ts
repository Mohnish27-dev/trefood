import "server-only";

import * as db from "@/server/db/collections";
import { newId, newOrderNumber } from "@/lib/ids";
import {
  ACTOR,
  CUSTOMER_VISIBLE_STATUSES,
  DEFAULTS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  VENDOR_ACTIVE_STATUSES,
  type Actor,
  type OrderStatus,
} from "@/lib/constants";
import type { Paise } from "@/lib/money";
import { assertTransition } from "./order-state";
import { computePricing, type PricingLineInput } from "./pricing";
import { generateGateCode } from "./gate-code";
import { writeAudit } from "./audit";
import { getCampusById, getMenuItemsByIds, getRestaurantById, isRestaurantServing } from "./catalog";
import { campusLocalMinutes, getEffectiveMinOrderPaise } from "./curfew";
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
  /** What the student hands the delivery partner at the gate, in cash. */
  cashDuePaise: Paise;
  /** Non-empty means checkout must stop and the cart must re-render with the change highlighted. */
  issues: CartIssue[];
  /** Below the restaurant's minimum order. */
  belowMinimum: boolean;
  minOrderPaise: Paise;
  isLateNightMinOrder?: boolean;
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
  discountPaise?: Paise;
  now?: Date;
}): Promise<CartPreview | null> {
  const restaurant = await getRestaurantById(params.restaurantId);
  if (!restaurant) return null;

  const campus = await getCampusById(restaurant.campusId);
  if (!campus) return null;

  const itemMap = await getMenuItemsByIds(params.lines.map((l) => l.itemId));

  const issues: CartIssue[] = [];
  const orderItems: OrderItem[] = [];
  const pricingLines: PricingLineInput[] = [];

  if (!restaurant.isOpen) {
    issues.push({
      itemId: restaurant._id,
      itemName: restaurant.name,
      code: "UNAVAILABLE",
      message: `${restaurant.name} is currently closed and not accepting orders.`,
    });
  }

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
    packagingFeePaise: 0,
    deliveryFeePaise: 0,
    discountPaise: params.discountPaise ?? 0,
    commissionBps,
  });

  orderItems.forEach((item, i) => {
    item.lineTotalPaise = result.lineTotalsPaise[i] ?? 0;
  });

  const now = params.now ?? new Date();
  const nowMinutes = campusLocalMinutes(now, campus.timezone);
  const minOrderInfo = getEffectiveMinOrderPaise(restaurant, nowMinutes);

  return {
    restaurant,
    campus,
    items: orderItems,
    pricing: result.pricing,
    cashDuePaise: result.cashDuePaise,
    issues,
    belowMinimum: result.pricing.subtotalPaise < minOrderInfo.minOrderPaise,
    minOrderPaise: minOrderInfo.minOrderPaise,
    isLateNightMinOrder: minOrderInfo.isLateNight,
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
  | {
      ok: false;
      code: "CART_INVALID" | "ORDERING_BLOCKED" | "BELOW_MINIMUM" | "RESTAURANT_CLOSED";
      message: string;
      issues?: CartIssue[];
    };

export async function createOrder(params: {
  customer: User;
  restaurantId: string;
  zoneId: string;
  lines: readonly CartLineInput[];
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
    discountPaise,
  });

  if (!preview) {
    return { ok: false, code: "CART_INVALID", message: "This cart can no longer be priced." };
  }

  const now = new Date();
  const nowMinutes = campusLocalMinutes(now, preview.campus.timezone);

  if (!preview.restaurant.isOpen || !isRestaurantServing(preview.restaurant, nowMinutes)) {
    return {
      ok: false,
      code: "RESTAURANT_CLOSED",
      message: `${preview.restaurant.name} is currently closed and not taking orders.`,
    };
  }

  // F13/F14 — never charge a price the student did not see, and never take an
  // order containing something the kitchen has run out of.
  if (preview.issues.length > 0) {
    return {
      ok: false,
      code: "CART_INVALID",
      message: "Your cart changed. Please review it before ordering.",
      issues: preview.issues,
    };
  }

  if (preview.belowMinimum) {
    const minRupees = preview.minOrderPaise / 100;
    const lateNightSuffix = preview.isLateNightMinOrder ? " after 12:00 AM" : "";
    return {
      ok: false,
      code: "BELOW_MINIMUM",
      message: `${preview.restaurant.name} has a minimum order of ₹${minRupees}${lateNightSuffix}.`,
    };
  }

  // F9 — an admin has stopped this account from ordering. The UI hides
  // checkout, but the server must refuse it too: the UI is not authorisation.
  // Note this is only ever set by a human. Strikes accrue on their own, but
  // they do not block, because cash is the only way to order and an automatic
  // block would be an automatic ban.
  if (params.customer.ordersBlocked) {
    return {
      ok: false,
      code: "ORDERING_BLOCKED",
      message:
        params.customer.ordersBlockedReason ??
        "Ordering is paused on your account. Please contact support.",
    };
  }

  const zone = preview.campus.zones.find((z) => z.id === params.zoneId);
  if (!zone) {
    return { ok: false, code: "CART_INVALID", message: "That delivery gate no longer exists." };
  }

  const orderNumber = await nextOrderNumber(preview.campus);
  const submittedAt = new Date();

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
      method: PAYMENT_METHOD.COD,
      status: PAYMENT_STATUS.DUE,
      cashDuePaise: preview.cashDuePaise,
      cashCollectedPaise: 0,
      collectedAt: null,
    },

    // Persist the hold so closing the browser cannot skip the cancellation window.
    status: ORDER_STATUS.PENDING_CONFIRMATION,
    cancelUntil: new Date(submittedAt.getTime() + DEFAULTS.studentCancellationSeconds * 1_000),

    // Generated at creation but never exposed until READY (vendor) / AT_GATE
    // (student). See gate-code.ts.
    gateCode: generateGateCode(),
    prepMinutes: null,
    idempotencyKey: params.idempotencyKey,

    timestamps: {
      createdAt: submittedAt,
      placedAt: null,
      acceptedAt: null,
      readyAt: null,
      dispatchedAt: null,
      atGateAt: null,
      deliveredAt: null,
      settledAt: null,
    },
    cancellation: null,
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
    to: ORDER_STATUS.PENDING_CONFIRMATION,
    actorId: params.customer._id,
    actorRole: ACTOR.STUDENT,
    reason: "Order held for 15 seconds before sending to restaurant",
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

  // Mongo evaluates the deadline at the actual write, so a slow request cannot
  // cancel after expiry or race a release into both outcomes.
  if (order.status === ORDER_STATUS.PENDING_CONFIRMATION) {
    if (!order.cancelUntil) {
      return { ok: false, code: "INVALID_DEADLINE", message: "This order has no cancellation deadline." };
    }
    scope.$expr = options.to === ORDER_STATUS.CANCELLED_BY_STUDENT
      ? { $gt: ["$cancelUntil", "$$NOW"] }
      : { $lte: ["$cancelUntil", "$$NOW"] };
    if (options.to === ORDER_STATUS.CANCELLED_BY_STUDENT && !options.requireCustomerId) {
      return { ok: false, code: "OWNERSHIP_REQUIRED", message: "Sign in to cancel your order." };
    }
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
      by: options.actor,
      at: now,
    };
  }

  // The cash moves at exactly one moment, and this is it. DELIVERED means the
  // packet changed hands, which under cash on delivery means the money did
  // too — the student cannot hold the food without having paid the rider for
  // it. `cashDuePaise` is read off the document rather than recomputed,
  // because a stockout (F6) may already have reduced it.
  if (options.to === ORDER_STATUS.DELIVERED) {
    set["payment.status"] = PAYMENT_STATUS.COLLECTED;
    set["payment.cashCollectedPaise"] = order.payment.cashDuePaise;
    set["payment.collectedAt"] = now;
  }

  // Every other ending means no food was handed over, so no money was either.
  // These orders carry no commission and never reach a statement.
  if (UNCOLLECTED_STATUSES.has(options.to)) {
    set["payment.status"] = PAYMENT_STATUS.UNCOLLECTED;
    set["payment.cashCollectedPaise"] = 0;
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

  if (options.to === ORDER_STATUS.CANCELLED_BY_STUDENT && order.couponId) {
    await (await db.coupons()).updateOne(
      { _id: order.couponId, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
    );
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
  [ORDER_STATUS.SETTLED]: "settledAt",
};

const CANCELLED_STATUSES = new Set<OrderStatus>([
  ORDER_STATUS.REJECTED_BY_VENDOR,
  ORDER_STATUS.EXPIRED_NO_ACK,
  ORDER_STATUS.CANCELLED_BY_ADMIN,
  ORDER_STATUS.CANCELLED_BY_STUDENT,
  ORDER_STATUS.NO_SHOW,
]);

/** Endings where the food never reached the student, so no cash ever moved. */
const UNCOLLECTED_STATUSES = CANCELLED_STATUSES;

/* ══════════════════════════════════════════════════════════════════════
   Reads
   ══════════════════════════════════════════════════════════════════════ */

/** Polls and cron release persisted holds; no browser timer or process-local job is required. */
export async function releasePendingOrders(scope: {
  restaurantId?: string;
  customerId?: string;
  orderId?: string;
} = {}): Promise<void> {
  const pending = await (await db.orders()).find({
    status: ORDER_STATUS.PENDING_CONFIRMATION,
    cancelUntil: { $lte: new Date() },
    ...(scope.restaurantId ? { restaurantId: scope.restaurantId } : {}),
    ...(scope.customerId ? { customerId: scope.customerId } : {}),
    ...(scope.orderId ? { _id: scope.orderId } : {}),
  }).limit(200).toArray();
  for (const order of pending) {
    await transitionOrder({
      orderId: order._id,
      to: ORDER_STATUS.PLACED,
      actor: ACTOR.SYSTEM,
      reason: "Cancellation window elapsed; sent to restaurant",
    });
  }
}

export function isHiddenFromVendor(order: Order): boolean {
  return order.status === ORDER_STATUS.PENDING_CONFIRMATION || order.status === ORDER_STATUS.CANCELLED_BY_STUDENT;
}

export async function getOrder(orderId: string): Promise<Order | null> {
  return (await db.orders()).findOne({ _id: orderId });
}

export async function getOrderForCustomer(orderId: string, customerId: string): Promise<Order | null> {
  await releasePendingOrders({ orderId, customerId });
  return (await db.orders()).findOne({ _id: orderId, customerId });
}

export async function listOrdersForCustomer(
  customerId: string,
  limit = 30,
  statuses: readonly OrderStatus[] = CUSTOMER_VISIBLE_STATUSES,
): Promise<Order[]> {
  await releasePendingOrders({ customerId });
  return (await db.orders())
    .find({
      customerId,
      status: { $in: [...statuses] },
    })
    .sort({ "timestamps.createdAt": -1 })
    .limit(limit)
    .toArray();
}

/** The vendor board query. Runs every 5 seconds, so it must hit `restaurant_status`. */
export async function listActiveOrdersForRestaurant(restaurantId: string): Promise<Order[]> {
  await releasePendingOrders({ restaurantId });
  return (await db.orders())
    .find({ restaurantId, status: { $in: [...VENDOR_ACTIVE_STATUSES] } })
    .sort({ "timestamps.placedAt": 1 })
    .toArray();
}

export async function listOrdersForCampus(campusId: string, limit = 100): Promise<Order[]> {
  return (await db.orders())
    .find({ campusId, status: { $in: [...CUSTOMER_VISIBLE_STATUSES] } })
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

