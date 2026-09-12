import "server-only";

import * as db from "@/server/db/collections";
import { ACTOR, DEFAULT_TIMEZONE, ORDER_STATUS } from "@/lib/constants";
import { campusDateString, campusDayRange } from "@/lib/campus-time";
import { newId } from "@/lib/ids";
import { ceilRupeeOfBps, type Paise } from "@/lib/money";
import type { Coupon } from "@/types/finance";
import { writeAudit } from "./audit";
import { getCampusById, getMenuItemsByIds, getRestaurantById } from "./catalog";

export interface CreateCouponParams {
  code: string;
  description?: string | null | undefined;
  restaurantId?: string | null | undefined;
  campusId?: string | null | undefined;
  type: "FLAT" | "PERCENT";
  valuePaise: Paise;
  valueBps?: number | undefined;
  maxDiscountPaise?: Paise | undefined;
  minOrderPaise?: Paise | undefined;
  perStudentLimit?: number | undefined;
  totalLimit?: number | null | undefined;
  /** Distinct customers allowed. 0 or omitted = no cap. */
  personLimit?: number | undefined;
  /** Restrict to these items of `restaurantId`. Empty or omitted = whole menu. */
  menuItemIds?: readonly string[] | undefined;
  validFrom?: Date | undefined;
  /** Omitted = the end of today, in the campus timezone. */
  validUntil?: Date | undefined;
  actorId: string;
}

/** One cart line, as priced by `previewCart`. */
export interface CouponCartLine {
  itemId: string;
  lineTotalPaise: Paise;
}

export async function createCouponDirectly(
  params: CreateCouponParams,
): Promise<{ ok: true; coupon: Coupon } | { ok: false; message: string }> {
  const normalizedCode = params.code.trim().toUpperCase();
  if (!normalizedCode || normalizedCode.length < 3) {
    return { ok: false, message: "Coupon code must be at least 3 characters." };
  }

  const couponsColl = await db.coupons();
  const existing = await couponsColl.findOne({ code: normalizedCode });
  if (existing) {
    return { ok: false, message: `Coupon code "${normalizedCode}" already exists.` };
  }

  const restaurant = params.restaurantId ? await getRestaurantById(params.restaurantId) : null;
  const campusId = params.campusId ?? restaurant?.campusId ?? null;

  const menuItemIds = [...new Set(params.menuItemIds ?? [])];
  let menuItemNames: string[] = [];
  if (menuItemIds.length > 0) {
    if (!restaurant) {
      return { ok: false, message: "Item-specific coupons need a restaurant." };
    }
    const items = await getMenuItemsByIds(menuItemIds);
    const valid = menuItemIds.every((id) => items.get(id)?.restaurantId === restaurant._id);
    if (!valid) {
      return { ok: false, message: "One of the selected items is not on this restaurant's menu." };
    }
    menuItemNames = menuItemIds.map((id) => items.get(id)?.name ?? "");
  }

  // A coupon lives for the day it was created: it closes at campus-local
  // midnight so nobody can carry it into tomorrow. Campus-local, not server
  // UTC — see campus-time.ts.
  let validUntil = params.validUntil;
  if (!validUntil) {
    const campus = campusId ? await getCampusById(campusId) : null;
    const timezone = campus?.timezone ?? DEFAULT_TIMEZONE;
    const { end } = campusDayRange(campusDateString(new Date(), timezone), timezone);
    validUntil = new Date(end.getTime() - 1);
  }

  const coupon: Coupon = {
    _id: newId("cpn"),
    code: normalizedCode,
    description: params.description ?? null,
    restaurantId: params.restaurantId ?? null,
    campusId,
    type: params.type,
    valuePaise: params.type === "FLAT" ? params.valuePaise : 0,
    valueBps: params.type === "PERCENT" ? (params.valueBps ?? 0) : 0,
    maxDiscountPaise:
      params.type === "PERCENT"
        ? (params.maxDiscountPaise ?? params.valuePaise ?? 0)
        : params.valuePaise,
    minOrderPaise: params.minOrderPaise ?? 0,
    perStudentLimit: params.perStudentLimit ?? 1,
    totalLimit: params.totalLimit ?? null,
    usedCount: 0,
    personLimit: params.personLimit ?? 0,
    redeemedCustomerIds: [],
    menuItemIds,
    menuItemNames,
    validFrom: params.validFrom ?? new Date(),
    validUntil,
    isActive: true,
  };

  await couponsColl.insertOne(coupon);

  await writeAudit({
    entity: "RESTAURANT",
    entityId: params.restaurantId ?? coupon._id,
    from: null,
    to: `COUPON_CREATED:${coupon.code}`,
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Created coupon ${coupon.code} (${coupon.type === "FLAT" ? `₹${coupon.valuePaise / 100} off` : `${coupon.valueBps / 100}% off`})`,
  });

  return { ok: true, coupon };
}

export async function listAdminCouponsForRestaurant(restaurantId: string): Promise<Coupon[]> {
  const couponsColl = await db.coupons();
  return couponsColl.find({ restaurantId }).sort({ validUntil: -1 }).toArray();
}

export interface CouponEligibilityResult {
  coupon: Coupon;
  isEligible: boolean;
  reason?: string | undefined;
  calculatedDiscountPaise: Paise;
}

export function calculateCouponDiscount(coupon: Coupon, subtotalPaise: number): Paise {
  if (coupon.type === "FLAT") {
    return Math.min(coupon.valuePaise, subtotalPaise);
  }
  const pctDiscount = ceilRupeeOfBps(subtotalPaise, coupon.valueBps);
  return coupon.maxDiscountPaise > 0
    ? Math.min(pctDiscount, coupon.maxDiscountPaise)
    : pctDiscount;
}

/**
 * The part of the cart a coupon may discount. An item-specific coupon only
 * ever sees its own items' lines, so ₹50 off a sandwich cannot leak onto the
 * drink next to it. Returns null when the cart has none of those items.
 */
export function couponEligibleSubtotal(
  coupon: Coupon,
  lines: readonly CouponCartLine[],
): Paise | null {
  const itemIds = coupon.menuItemIds ?? [];
  if (itemIds.length === 0) {
    return lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
  }
  const matching = lines.filter((l) => itemIds.includes(l.itemId));
  if (matching.length === 0) return null;
  return matching.reduce((sum, l) => sum + l.lineTotalPaise, 0);
}

/**
 * True when every person slot is taken by someone else. A customer who already
 * holds a slot keeps it (their repeat use is governed by `perStudentLimit`).
 */
export function isPersonLimitReached(coupon: Coupon, studentId?: string | null): boolean {
  const limit = coupon.personLimit ?? 0;
  if (limit <= 0) return false;
  const holders = coupon.redeemedCustomerIds ?? [];
  if (studentId && holders.includes(studentId)) return false;
  return holders.length >= limit;
}

function itemRestrictionMessage(coupon: Coupon): string {
  const names = (coupon.menuItemNames ?? []).filter(Boolean);
  return names.length > 0
    ? `Valid only on ${names.join(", ")}`
    : "Valid only on selected items";
}

async function studentRedemptions(coupon: Coupon, studentId: string): Promise<number> {
  const ordersColl = await db.orders();
  return ordersColl.countDocuments({
    status: { $ne: ORDER_STATUS.CANCELLED_BY_STUDENT },
    customerId: studentId,
    couponCode: coupon.code,
  });
}

export async function listEligibleCouponsForCart(params: {
  restaurantId: string;
  campusId: string;
  subtotalPaise: number;
  lines: readonly CouponCartLine[];
  studentId?: string | null | undefined;
}): Promise<CouponEligibilityResult[]> {
  const couponsColl = await db.coupons();
  const now = new Date();

  const activeCoupons = await couponsColl
    .find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [
        { restaurantId: params.restaurantId },
        { campusId: params.campusId, restaurantId: null },
        { campusId: null, restaurantId: null },
      ],
    })
    .sort({ valuePaise: -1, valueBps: -1 })
    .toArray();

  const results: CouponEligibilityResult[] = [];

  for (const coupon of activeCoupons) {
    // Sold out — hide it rather than tease a coupon nobody else can use.
    if (coupon.totalLimit !== null && coupon.usedCount >= coupon.totalLimit) continue;
    if (isPersonLimitReached(coupon, params.studentId)) continue;

    const eligibleSubtotal = couponEligibleSubtotal(coupon, params.lines);
    if (eligibleSubtotal === null) {
      results.push({
        coupon,
        isEligible: false,
        reason: itemRestrictionMessage(coupon),
        calculatedDiscountPaise: 0,
      });
      continue;
    }

    if (params.subtotalPaise < coupon.minOrderPaise) {
      const shortageRupees = Math.ceil((coupon.minOrderPaise - params.subtotalPaise) / 100);
      results.push({
        coupon,
        isEligible: false,
        reason: `Add items worth ₹${shortageRupees} more to use this coupon`,
        calculatedDiscountPaise: 0,
      });
      continue;
    }

    if (params.studentId && coupon.perStudentLimit > 0) {
      if ((await studentRedemptions(coupon, params.studentId)) >= coupon.perStudentLimit) {
        results.push({
          coupon,
          isEligible: false,
          reason: `You have already used this coupon maximum (${coupon.perStudentLimit}) time(s)`,
          calculatedDiscountPaise: 0,
        });
        continue;
      }
    }

    results.push({
      coupon,
      isEligible: true,
      calculatedDiscountPaise: calculateCouponDiscount(coupon, eligibleSubtotal),
    });
  }

  return results;
}

export async function validateCouponForOrder(params: {
  code: string;
  restaurantId: string;
  campusId: string;
  subtotalPaise: number;
  lines: readonly CouponCartLine[];
  studentId?: string | null | undefined;
}): Promise<
  | { ok: true; coupon: Coupon; discountPaise: Paise }
  | { ok: false; message: string }
> {
  const normalizedCode = params.code.trim().toUpperCase();
  const couponsColl = await db.coupons();
  const coupon = await couponsColl.findOne({ code: normalizedCode });

  if (!coupon) {
    return { ok: false, message: `Coupon code "${normalizedCode}" does not exist.` };
  }

  if (!coupon.isActive) {
    return { ok: false, message: `Coupon "${normalizedCode}" is currently inactive.` };
  }

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    return { ok: false, message: `Coupon "${normalizedCode}" is not yet valid.` };
  }
  if (coupon.validUntil && now > coupon.validUntil) {
    return { ok: false, message: `Coupon "${normalizedCode}" has expired.` };
  }

  // Restaurant scoping check
  if (coupon.restaurantId && coupon.restaurantId !== params.restaurantId) {
    return {
      ok: false,
      message: `Coupon "${normalizedCode}" is only valid for its specific restaurant.`,
    };
  }

  // Campus scoping check
  if (coupon.campusId && coupon.campusId !== params.campusId) {
    return {
      ok: false,
      message: `Coupon "${normalizedCode}" is not valid for this campus.`,
    };
  }

  // Total redemptions check
  if (coupon.totalLimit !== null && coupon.usedCount >= coupon.totalLimit) {
    return {
      ok: false,
      message: `Coupon "${normalizedCode}" has reached its maximum total redemptions.`,
    };
  }

  if (isPersonLimitReached(coupon, params.studentId)) {
    return {
      ok: false,
      message: `Coupon "${normalizedCode}" has already been claimed by its first ${coupon.personLimit} customers.`,
    };
  }

  const eligibleSubtotal = couponEligibleSubtotal(coupon, params.lines);
  if (eligibleSubtotal === null) {
    return {
      ok: false,
      message: `Coupon "${normalizedCode}" is ${itemRestrictionMessage(coupon).toLowerCase()}.`,
    };
  }

  // Minimum order check
  if (params.subtotalPaise < coupon.minOrderPaise) {
    const minRupees = Math.ceil(coupon.minOrderPaise / 100);
    return {
      ok: false,
      message: `Coupon "${normalizedCode}" requires a minimum order of ₹${minRupees}.`,
    };
  }

  // Per student usage limit check
  if (params.studentId && coupon.perStudentLimit > 0) {
    if ((await studentRedemptions(coupon, params.studentId)) >= coupon.perStudentLimit) {
      return {
        ok: false,
        message: `You have already redeemed coupon "${normalizedCode}" the maximum number of times (${coupon.perStudentLimit}).`,
      };
    }
  }

  const discountPaise = calculateCouponDiscount(coupon, eligibleSubtotal);
  return { ok: true, coupon, discountPaise };
}

/**
 * Take one of the coupon's person slots for this customer, atomically.
 *
 * Validation reads the slot count; this is the write that makes it true. Two
 * students racing for the tenth slot both pass validation, but only one of
 * them matches this filter. Idempotent for a customer who already holds a
 * slot, so a double-tapped checkout does not burn two.
 */
export async function claimCouponSlot(couponId: string, customerId: string): Promise<boolean> {
  const now = new Date();
  const res = await (await db.coupons()).updateOne(
    {
      _id: couponId,
      isActive: true,
      validUntil: { $gte: now },
      $or: [
        { personLimit: { $not: { $gt: 0 } } },
        { redeemedCustomerIds: customerId },
        {
          $expr: {
            $lt: [{ $size: { $ifNull: ["$redeemedCustomerIds", []] } }, "$personLimit"],
          },
        },
      ],
    },
    { $addToSet: { redeemedCustomerIds: customerId } },
  );
  return res.matchedCount === 1;
}

/** Give a slot back once the customer has no live order left on this coupon. */
export async function releaseCouponSlot(couponId: string, customerId: string): Promise<void> {
  const stillUsing = await (await db.orders()).countDocuments({
    couponId,
    customerId,
    status: { $ne: ORDER_STATUS.CANCELLED_BY_STUDENT },
  });
  if (stillUsing > 0) return;
  await (await db.coupons()).updateOne(
    { _id: couponId },
    { $pull: { redeemedCustomerIds: customerId } },
  );
}

export async function toggleCouponStatus(
  couponId: string,
  isActive: boolean,
  actorId: string,
): Promise<{ ok: true; coupon: Coupon } | { ok: false; message: string }> {
  const couponsColl = await db.coupons();
  const updated = await couponsColl.findOneAndUpdate(
    { _id: couponId },
    { $set: { isActive } },
    { returnDocument: "after" },
  );

  if (!updated) {
    return { ok: false, message: "Coupon not found." };
  }

  await writeAudit({
    entity: "RESTAURANT",
    entityId: updated.restaurantId ?? updated._id,
    from: (!isActive).toString(),
    to: isActive.toString(),
    actorId,
    actorRole: ACTOR.ADMIN,
    reason: `${isActive ? "Activated" : "Deactivated"} coupon ${updated.code}`,
  });

  return { ok: true, coupon: updated };
}

export async function deleteCoupon(
  couponId: string,
  actorId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const couponsColl = await db.coupons();
  const coupon = await couponsColl.findOne({ _id: couponId });
  if (!coupon) {
    return { ok: false, message: "Coupon not found." };
  }

  await couponsColl.deleteOne({ _id: couponId });

  await writeAudit({
    entity: "RESTAURANT",
    entityId: coupon.restaurantId ?? coupon._id,
    from: coupon.code,
    to: "DELETED",
    actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Deleted coupon ${coupon.code}`,
  });

  return { ok: true };
}
