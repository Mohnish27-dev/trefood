import { describe, expect, it } from "vitest";
import {
  calculateCouponDiscount,
  couponEligibleSubtotal,
  isPersonLimitReached,
} from "@/server/services/coupons";
import type { Coupon } from "@/types/finance";

describe("Coupon Discount Calculations", () => {
  const baseFlatCoupon: Coupon = {
    _id: "cpn_test_flat",
    code: "SAVE50",
    description: "₹50 flat off",
    restaurantId: "rest_1",
    campusId: "campus_1",
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

describe("Item-specific coupons", () => {
  const sandwichCoupon: Coupon = {
    _id: "cpn_test_items",
    code: "GRILL50",
    restaurantId: "rest_1",
    campusId: "campus_1",
    type: "PERCENT",
    valuePaise: 0,
    valueBps: 5000, // 50%
    maxDiscountPaise: 0,
    minOrderPaise: 0,
    perStudentLimit: 1,
    totalLimit: null,
    usedCount: 0,
    menuItemIds: ["item_sandwich"],
    menuItemNames: ["Veggie Grill Sandwich"],
    validFrom: new Date("2026-01-01"),
    validUntil: new Date("2026-12-31"),
    isActive: true,
  };

  it("discounts only the selected item's lines", () => {
    const lines = [
      { itemId: "item_sandwich", lineTotalPaise: 12000 },
      { itemId: "item_coffee", lineTotalPaise: 8000 },
    ];
    const eligible = couponEligibleSubtotal(sandwichCoupon, lines);
    expect(eligible).toBe(12000);
    expect(calculateCouponDiscount(sandwichCoupon, eligible ?? 0)).toBe(6000);
  });

  it("is not applicable when the cart has none of the selected items", () => {
    expect(couponEligibleSubtotal(sandwichCoupon, [{ itemId: "item_coffee", lineTotalPaise: 8000 }])).toBeNull();
  });

  it("caps a flat item coupon at the selected items' value", () => {
    const flat: Coupon = { ...sandwichCoupon, type: "FLAT", valuePaise: 20000, valueBps: 0 };
    const eligible = couponEligibleSubtotal(flat, [
      { itemId: "item_sandwich", lineTotalPaise: 12000 },
      { itemId: "item_coffee", lineTotalPaise: 50000 },
    ]);
    expect(calculateCouponDiscount(flat, eligible ?? 0)).toBe(12000);
  });

  it("uses the whole cart when no items are selected", () => {
    const whole: Coupon = { ...sandwichCoupon, menuItemIds: [] };
    expect(
      couponEligibleSubtotal(whole, [
        { itemId: "a", lineTotalPaise: 100 },
        { itemId: "b", lineTotalPaise: 250 },
      ]),
    ).toBe(350);
  });
});

describe("Person limit", () => {
  const base: Coupon = {
    _id: "cpn_test_people",
    code: "FIRST2",
    restaurantId: "rest_1",
    campusId: "campus_1",
    type: "FLAT",
    valuePaise: 1000,
    valueBps: 0,
    maxDiscountPaise: 1000,
    minOrderPaise: 0,
    perStudentLimit: 1,
    totalLimit: null,
    usedCount: 2,
    personLimit: 2,
    redeemedCustomerIds: ["u1", "u2"],
    validFrom: new Date("2026-01-01"),
    validUntil: new Date("2026-12-31"),
    isActive: true,
  };

  it("blocks a new customer once every slot is taken", () => {
    expect(isPersonLimitReached(base, "u3")).toBe(true);
    expect(isPersonLimitReached(base, null)).toBe(true);
  });

  it("lets a customer who already holds a slot through", () => {
    expect(isPersonLimitReached(base, "u1")).toBe(false);
  });

  it("allows new customers while slots remain", () => {
    expect(isPersonLimitReached({ ...base, redeemedCustomerIds: ["u1"] }, "u3")).toBe(false);
  });

  it("treats 0 or a missing limit as unlimited", () => {
    expect(isPersonLimitReached({ ...base, personLimit: 0 }, "u3")).toBe(false);
    const legacy: Coupon = { ...base };
    delete legacy.personLimit;
    expect(isPersonLimitReached(legacy, "u3")).toBe(false);
  });
});
