import { describe, expect, it } from "vitest";
import {
  calculateCouponDiscount,
  couponEligibleSubtotal,
  isDineInCoupon,
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

  it("includes item packaging fees in item-specific discount calculation", () => {
    const lines = [
      { itemId: "item_sandwich", lineTotalPaise: 12000, linePackingFeePaise: 1000 },
      { itemId: "item_coffee", lineTotalPaise: 8000, linePackingFeePaise: 500 },
    ];
    // Sandwich total including packing = 120 + 10 = ₹130 (13000 paise)
    const eligible = couponEligibleSubtotal(sandwichCoupon, lines);
    expect(eligible).toBe(13000);
    // 50% of 13000 = 6500 (₹65)
    expect(calculateCouponDiscount(sandwichCoupon, eligible ?? 0)).toBe(6500);
  });

  it("applies coupon on final order price including packaging and delivery fees (WRAP10 photo case)", () => {
    const wrap10: Coupon = {
      _id: "cpn_wrap10",
      code: "WRAP10",
      description: "10% OFF on all menu items",
      restaurantId: "rest_wrapchik",
      campusId: "campus_1",
      type: "PERCENT",
      valuePaise: 0,
      valueBps: 1000, // 10%
      maxDiscountPaise: 0,
      minOrderPaise: 39900, // ₹399
      perStudentLimit: 1,
      totalLimit: null,
      usedCount: 0,
      menuItemIds: [],
      validFrom: new Date("2026-01-01"),
      validUntil: new Date("2026-12-31"),
      isActive: true,
    };

    const lines = [
      { itemId: "pizza_veg", lineTotalPaise: 18900, linePackingFeePaise: 1000 },
      { itemId: "pizza_margherita", lineTotalPaise: 20900, linePackingFeePaise: 1000 },
    ];
    const itemSubtotalPaise = 39800; // ₹398
    const packagingFeePaise = 2000;  // ₹20
    const finalOrderTotalPaise = itemSubtotalPaise + packagingFeePaise; // ₹418 (41800 paise)

    // With item price alone, ₹398 is below min order ₹399
    expect(itemSubtotalPaise < wrap10.minOrderPaise).toBe(true);

    // With final order total including packaging, ₹418 meets min order ₹399
    expect(finalOrderTotalPaise >= wrap10.minOrderPaise).toBe(true);

    // Coupon applies on the final order total ₹418
    const eligible = couponEligibleSubtotal(wrap10, lines, finalOrderTotalPaise);
    expect(eligible).toBe(41800);

    // 10% discount on ₹418: 4180 paise rounds/ceils to whole rupee = 4200 paise (₹42)
    const discount = calculateCouponDiscount(wrap10, eligible ?? 0);
    expect(discount).toBe(4200);
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

describe("Coupon channel", () => {
  it("treats a coupon without a channel as delivery", () => {
    expect(isDineInCoupon({})).toBe(false);
    expect(isDineInCoupon({ channel: "DELIVERY" })).toBe(false);
  });

  it("recognises dine-in coupons", () => {
    expect(isDineInCoupon({ channel: "DINE_IN" })).toBe(true);
  });
});
