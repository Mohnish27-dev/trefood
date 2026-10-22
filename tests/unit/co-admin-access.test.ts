import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROLES, ROLE, STAFF_ROLES, isFullAdmin, isStaff, type Role } from "@/lib/constants";
import { landingForRole } from "@/lib/routes";

/**
 * Which guard each admin action opens with. The session module is replaced by
 * one that enforces the real role lists against a role the test picks, so a
 * co-admin is refused exactly where `requireAdmin()` is used.
 */
const mocks = vi.hoisted(() => ({
  role: "CO_ADMIN" as string,
  services: {
    setRestaurantOpenAsAdmin: vi.fn(),
    updatePayoutDetails: vi.fn(),
    setCommissionOverride: vi.fn(),
  },
  setOrdersBlocked: vi.fn(),
  runAllSweeps: vi.fn(),
}));

vi.mock("@/server/auth/session", async () => {
  const { ADMIN_ROLES, STAFF_ROLES } = await import("@/lib/constants");
  const guard = (allowed: readonly string[]) => async () => {
    if (!allowed.includes(mocks.role)) throw new Error("FORBIDDEN");
    return { user: { _id: "user_test" }, role: mocks.role };
  };
  return { requireAdmin: guard(ADMIN_ROLES), requireStaff: guard(STAFF_ROLES) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/services/admin", () => mocks.services);
vi.mock("@/server/services/catalog", () => ({}));
vi.mock("@/server/services/orders", () => ({}));
vi.mock("@/server/services/settlement", () => ({}));
vi.mock("@/server/services/students", () => ({ setOrdersBlocked: mocks.setOrdersBlocked }));
vi.mock("@/server/services/sweeps", () => ({ runAllSweeps: mocks.runAllSweeps }));

import {
  cancelOrderAsAdmin,
  saveCommissionOverride,
  savePayoutDetails,
  toggleRestaurantOpenAction,
  toggleStudentOrdering,
  runSweepsNow,
} from "@/server/actions/admin";

describe("co-admin role helpers", () => {
  it("is staff but not a full admin", () => {
    expect(isStaff(ROLE.CO_ADMIN)).toBe(true);
    expect(isFullAdmin(ROLE.CO_ADMIN)).toBe(false);
    expect(STAFF_ROLES).toContain(ROLE.CO_ADMIN);
    expect(ADMIN_ROLES).not.toContain(ROLE.CO_ADMIN);
  });

  it("keeps admins and super admins as full admins", () => {
    for (const role of [ROLE.ADMIN, ROLE.SUPER_ADMIN] as Role[]) {
      expect(isFullAdmin(role)).toBe(true);
      expect(isStaff(role)).toBe(true);
    }
    expect(isStaff(ROLE.STUDENT)).toBe(false);
    expect(isStaff(ROLE.VENDOR_OWNER)).toBe(false);
  });

  it("lands a co-admin on the radar", () => {
    expect(landingForRole(ROLE.CO_ADMIN)).toBe("/admin/orders");
  });
});

describe("co-admin action access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = ROLE.CO_ADMIN;
  });

  it("cannot change a vendor in any way, even switching it on or off", async () => {
    await expect(
      toggleRestaurantOpenAction({ restaurantId: "rest", isOpen: false }),
    ).rejects.toThrow("FORBIDDEN");
    expect(mocks.services.setRestaurantOpenAsAdmin).not.toHaveBeenCalled();
  });

  it("is refused bank details, commission, students, sweeps and cancellations", async () => {
    await expect(
      savePayoutDetails({
        restaurantId: "rest",
        accountName: "Canteen",
        accountNumber: "1234567890",
        ifsc: "SBIN0001234",
        upiId: null,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      saveCommissionOverride({ restaurantId: "rest", commissionBpsOverride: 500 }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      toggleStudentOrdering({ userId: "u", blocked: true, reason: "testing" }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(runSweepsNow()).rejects.toThrow("FORBIDDEN");
    await expect(
      cancelOrderAsAdmin({ orderId: "order", reason: "Power cut at the canteen" }),
    ).rejects.toThrow("FORBIDDEN");

    expect(mocks.services.updatePayoutDetails).not.toHaveBeenCalled();
    expect(mocks.services.setCommissionOverride).not.toHaveBeenCalled();
    expect(mocks.setOrdersBlocked).not.toHaveBeenCalled();
    expect(mocks.runAllSweeps).not.toHaveBeenCalled();
  });

  it("does not change what a full admin can do", async () => {
    mocks.role = ROLE.SUPER_ADMIN;
    mocks.services.updatePayoutDetails.mockResolvedValue({ _id: "rest" });
    await expect(
      savePayoutDetails({
        restaurantId: "rest",
        accountName: "Canteen",
        accountNumber: "1234567890",
        ifsc: "SBIN0001234",
        upiId: null,
      }),
    ).resolves.toMatchObject({ status: "ok" });
  });
});
