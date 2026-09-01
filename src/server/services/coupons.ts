import "server-only";

import * as db from "@/server/db/collections";
import { ACTOR } from "@/lib/constants";
import { newId } from "@/lib/ids";
import { ceilRupeeOfBps, type Paise } from "@/lib/money";
import type { Coupon } from "@/types/finance";
import { writeAudit } from "./audit";
import { getRestaurantById } from "./catalog";

export interface CreateCouponParams {
  code: string;
  description?: string | null | undefined;
  restaurantId?: string | null | undefined;
  campusId?: string | null | undefined;
  fundedBy?: "PLATFORM" | "VENDOR" | undefined;
  type: "FLAT" | "PERCENT";
  valuePaise: Paise;
  valueBps?: number | undefined;
  maxDiscountPaise?: Paise | undefined;
  minOrderPaise?: Paise | undefined;
  perStudentLimit?: number | undefined;
  totalLimit?: number | null | undefined;
  validFrom?: Date | undefined;
  validUntil: Date;
  actorId: string;
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

  let campusId = params.campusId ?? null;
  if (params.restaurantId && !campusId) {
    const restaurant = await getRestaurantById(params.restaurantId);
    if (restaurant) campusId = restaurant.campusId;
  }

  const coupon: Coupon = {
    _id: newId("cpn"),
    code: normalizedCode,
    description: params.description ?? null,
    restaurantId: params.restaurantId ?? null,
    campusId,
    fundedBy: params.fundedBy ?? "PLATFORM",
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
    validFrom: params.validFrom ?? new Date(),
    validUntil: params.validUntil,
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

export async function listEligibleCouponsForCart(params: {
  restaurantId: string;
  campusId: string;
  subtotalPaise: number;
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
    // Total usage limit check
    if (coupon.totalLimit !== null && coupon.usedCount >= coupon.totalLimit) {
      continue; // Sold out / limit reached
    }

    // Minimum order check
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

    // Per-student usage limit check
    if (params.studentId && coupon.perStudentLimit > 0) {
      const ordersColl = await db.orders();
      const userRedemptions = await ordersColl.countDocuments({
        customerId: params.studentId,
        couponCode: coupon.code,
      });
      if (userRedemptions >= coupon.perStudentLimit) {
        results.push({
          coupon,
          isEligible: false,
          reason: `You have already used this coupon maximum (${coupon.perStudentLimit}) time(s)`,
          calculatedDiscountPaise: 0,
        });
        continue;
      }
    }

    const calculatedDiscountPaise = calculateCouponDiscount(coupon, params.subtotalPaise);
    results.push({
      coupon,
      isEligible: true,
      calculatedDiscountPaise,
    });
  }

  return results;
}

export async function validateCouponForOrder(params: {
  code: string;
  restaurantId: string;
  campusId: string;
  subtotalPaise: number;
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
    const ordersColl = await db.orders();
    const userRedemptions = await ordersColl.countDocuments({
      customerId: params.studentId,
      couponCode: coupon.code,
    });
    if (userRedemptions >= coupon.perStudentLimit) {
      return {
        ok: false,
        message: `You have already redeemed coupon "${normalizedCode}" the maximum number of times (${coupon.perStudentLimit}).`,
      };
    }
  }

  const discountPaise = calculateCouponDiscount(coupon, params.subtotalPaise);
  return { ok: true, coupon, discountPaise };
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
