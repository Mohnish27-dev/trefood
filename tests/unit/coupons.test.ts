import { describe, expect, it } from "vitest";
import { calculateCouponDiscount } from "@/server/services/coupons";
import type { Coupon } from "@/types/finance";

describe("Coupon Discount Calculations", () => {
  const baseFlatCoupon: Coupon = {
    _id: "cpn_test_flat",
    code: "SAVE50",
    description: "₹50 flat off",
    restaurantId: "rest_1",
    campusId: "campus_1",
    fundedBy: "PLATFORM",
    type: "FLAT",
    valuePaise: 5000, // ₹50
    valueBps: 0,
    maxDiscountPaise: 5000,
    minOrderPaise: 10000, // ₹100
    perStudentLimit: 1,
    totalLimit: null,
    usedCount: 0,
    validFrom: new Date("2026-01-01"),
    validUntil: new Date("2026-12-31"),
    isActive: true,
  };

  const basePercentCoupon: Coupon = {
    _id: "cpn_test_pct",
    code: "WELCOME20",
    description: "20% off up to ₹60",
    restaurantId: "rest_1",
    campusId: "campus_1",
    fundedBy: "PLATFORM",
    type: "PERCENT",
    valuePaise: 0,
    valueBps: 2000, // 20%
    maxDiscountPaise: 6000, // ₹60 cap
    minOrderPaise: 15000, // ₹150
    perStudentLimit: 1,
    totalLimit: 50,
    usedCount: 0,
    validFrom: new Date("2026-01-01"),
    validUntil: new Date("2026-12-31"),
    isActive: true,
  };

  it("calculates flat discount correctly", () => {
    // Order of ₹200 (20000 paise) -> ₹50 off (5000 paise)
    const discount = calculateCouponDiscount(baseFlatCoupon, 20000);
    expect(discount).toBe(5000);
  });

  it("caps flat discount at subtotal if subtotal is lower than coupon value", () => {
    // Order of ₹30 (3000 paise) with ₹50 coupon -> max discount is ₹30
    const discount = calculateCouponDiscount(baseFlatCoupon, 3000);
    expect(discount).toBe(3000);
  });

  it("calculates percentage discount correctly below cap", () => {
    // 20% of ₹200 (20000 paise) is ₹40 (4000 paise), cap is ₹60
    const discount = calculateCouponDiscount(basePercentCoupon, 20000);
    expect(discount).toBe(4000);
  });

  it("caps percentage discount at maxDiscountPaise", () => {
    // 20% of ₹500 (50000 paise) is ₹100 (10000 paise), cap is ₹60 (6000 paise)
    const discount = calculateCouponDiscount(basePercentCoupon, 50000);
    expect(discount).toBe(6000);
  });

  it("calculates percentage discount without cap if maxDiscountPaise is 0", () => {
    const uncappedCoupon: Coupon = {
      ...basePercentCoupon,
      maxDiscountPaise: 0,
    };
    // 20% of ₹500 (50000 paise) is ₹100 (10000 paise)
    const discount = calculateCouponDiscount(uncappedCoupon, 50000);
    expect(discount).toBe(10000);
  });
});
