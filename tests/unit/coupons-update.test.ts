import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOneCoupon: vi.fn(),
  findOneAndUpdateCoupon: vi.fn(),
  deleteOneCoupon: vi.fn(),
  getRestaurantById: vi.fn(),
  getMenuItemsByIds: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/server/db/collections", () => ({
  coupons: async () => ({
    findOne: mocks.findOneCoupon,
    findOneAndUpdate: mocks.findOneAndUpdateCoupon,
    deleteOne: mocks.deleteOneCoupon,
  }),
}));

vi.mock("@/server/services/catalog", () => ({
  getRestaurantById: mocks.getRestaurantById,
  getMenuItemsByIds: mocks.getMenuItemsByIds,
}));

vi.mock("@/server/services/audit", () => ({
  writeAudit: mocks.audit,
}));

import { deleteCoupon, updateCoupon } from "@/server/services/coupons";
import { ACTOR } from "@/lib/constants";
import type { Coupon } from "@/types/finance";

describe("Coupon Update & Vendor Scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleCoupon: Coupon = {
    _id: "cpn_123",
    code: "TEST10",
    description: "10% off",
    restaurantId: "rest_alpha",
    campusId: "campus_1",
    type: "PERCENT",
    valuePaise: 0,
    valueBps: 1000,
    maxDiscountPaise: 5000,
    minOrderPaise: 10000,
    perStudentLimit: 1,
    totalLimit: null,
    usedCount: 0,
    personLimit: 0,
    redeemedCustomerIds: [],
    menuItemIds: [],
    channel: "DELIVERY",
    validFrom: new Date(),
    validUntil: new Date("2100-01-01"),
    isActive: true,
  };

  it("successfully updates coupon values", async () => {
    mocks.findOneCoupon.mockResolvedValueOnce(sampleCoupon);
    mocks.findOneAndUpdateCoupon.mockResolvedValueOnce({
      ...sampleCoupon,
      description: "Updated discount",
      minOrderPaise: 15000,
    });

    const res = await updateCoupon({
      couponId: "cpn_123",
      description: "Updated discount",
      minOrderPaise: 15000,
      actorId: "vendor_user_1",
      scope: { restaurantId: "rest_alpha", actorRole: ACTOR.VENDOR },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.coupon.description).toBe("Updated discount");
    }
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "vendor_user_1",
        actorRole: ACTOR.VENDOR,
        entity: "RESTAURANT",
        entityId: "rest_alpha",
      }),
    );
  });

  it("blocks editing code if coupon has already been redeemed", async () => {
    mocks.findOneCoupon.mockResolvedValueOnce({
      ...sampleCoupon,
      usedCount: 1,
    });

    const res = await updateCoupon({
      couponId: "cpn_123",
      code: "NEWCODE20",
      actorId: "vendor_user_1",
      scope: { restaurantId: "rest_alpha", actorRole: ACTOR.VENDOR },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain("Cannot change coupon code after it has been used");
    }
    expect(mocks.findOneAndUpdateCoupon).not.toHaveBeenCalled();
  });

  it("blocks updating if coupon belongs to another vendor", async () => {
    // Vendor for rest_beta tries to update rest_alpha's coupon
    mocks.findOneCoupon.mockResolvedValueOnce(null);

    const res = await updateCoupon({
      couponId: "cpn_123",
      description: "Malicious update",
      actorId: "vendor_user_2",
      scope: { restaurantId: "rest_beta", actorRole: ACTOR.VENDOR },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe("Coupon not found.");
    }
    expect(mocks.findOneAndUpdateCoupon).not.toHaveBeenCalled();
  });

  it("blocks deleting a coupon if it belongs to another vendor", async () => {
    mocks.findOneCoupon.mockResolvedValueOnce(null);

    const res = await deleteCoupon("cpn_123", "vendor_user_2", {
      restaurantId: "rest_beta",
      actorRole: ACTOR.VENDOR,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe("Coupon not found.");
    }
    expect(mocks.deleteOneCoupon).not.toHaveBeenCalled();
  });

  it("allows vendor to delete their own coupon", async () => {
    mocks.findOneCoupon.mockResolvedValueOnce(sampleCoupon);
    mocks.deleteOneCoupon.mockResolvedValueOnce({ deletedCount: 1 });

    const res = await deleteCoupon("cpn_123", "vendor_user_1", {
      restaurantId: "rest_alpha",
      actorRole: ACTOR.VENDOR,
    });

    expect(res.ok).toBe(true);
    expect(mocks.deleteOneCoupon).toHaveBeenCalledWith({ _id: "cpn_123" });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "vendor_user_1",
        actorRole: ACTOR.VENDOR,
        to: "DELETED",
      }),
    );
  });
});

