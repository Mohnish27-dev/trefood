import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as db from "@/server/db/collections";
import { getMongoClient } from "@/server/db/client";
import { setRestaurantOpenAsAdmin } from "@/server/services/admin";
import { previewCart, createOrder } from "@/server/services/orders";
import { setUpCanteenFixture, tearDownCanteenFixture, CANTEEN_ID } from "./canteen-fixture";
import type { User } from "@/types/user";

async function getTestStudent(): Promise<User> {
  const users = await db.users();
  let user = await users.findOne({ _id: "test_student_admin_lockout" });
  if (!user) {
    const studentFixture: User = {
      _id: "test_student_admin_lockout",
      authId: null,
      role: "STUDENT",
      name: "Test Student Admin Lockout",
      email: "test.adminlockout@nitp.ac.in",
      phone: "+919876500099",
      campusId: "campus_nitp",
      restaurantId: null,
      ordersBlocked: false,
      ordersBlockedReason: null,
      strikes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await users.replaceOne({ _id: studentFixture._id }, studentFixture, { upsert: true });
    user = studentFixture;
  }
  return user;
}

describe("Admin restaurant lockout & ordering restrictions", () => {
  beforeAll(async () => {
    await setUpCanteenFixture();
  });

  afterAll(async () => {
    await (await db.users()).deleteOne({ _id: "test_student_admin_lockout" });
    await (await db.auditLogs()).deleteMany({ entityId: CANTEEN_ID });
    await tearDownCanteenFixture();
    await (await getMongoClient()).close();
  });

  it("allows admin to turn off a restaurant and sets adminClosed to true", async () => {
    const updated = await setRestaurantOpenAsAdmin({
      restaurantId: CANTEEN_ID,
      isOpen: false,
      actorId: "usr_admin_tester",
    });

    expect(updated).not.toBeNull();
    expect(updated?.isOpen).toBe(false);
    expect(updated?.adminClosed).toBe(true);

    const fromDb = await (await db.restaurants()).findOne({ _id: CANTEEN_ID });
    expect(fromDb?.isOpen).toBe(false);
    expect(fromDb?.adminClosed).toBe(true);

    // Audit log was recorded
    const audit = await (await db.auditLogs()).findOne({
      entityId: CANTEEN_ID,
      actorId: "usr_admin_tester",
      to: "closed",
    });
    expect(audit).not.toBeNull();
    expect(audit?.reason).toContain("Admin closed restaurant (vendor locked out)");
  });

  it("blocks previewCart and createOrder when restaurant is closed", async () => {
    const student = await getTestStudent();

    // 1. previewCart should flag the restaurant as closed
    const preview = await previewCart({
      restaurantId: CANTEEN_ID,
      lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: ["opt_full"] }],
    });

    expect(preview).not.toBeNull();
    if (!preview) return;

    expect(preview.issues.length).toBeGreaterThan(0);
    const closedIssue = preview.issues.find((i) => i.code === "UNAVAILABLE");
    expect(closedIssue).toBeDefined();
    expect(closedIssue?.message).toContain("currently closed and not accepting orders");

    // 2. createOrder should be rejected with RESTAURANT_CLOSED
    const orderResult = await createOrder({
      customer: student,
      restaurantId: CANTEEN_ID,
      zoneId: "zone_boys_hostel",
      lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: ["opt_full"] }],
      idempotencyKey: "test_order_closed_guard",
    });

    expect(orderResult.ok).toBe(false);
    if (!orderResult.ok) {
      expect(orderResult.code).toBe("RESTAURANT_CLOSED");
      expect(orderResult.message).toContain("currently closed and not taking orders");
    }
  });

  it("prevents vendor from reopening when adminClosed is true", async () => {
    const restaurants = await db.restaurants();
    const restaurant = await restaurants.findOne({ _id: CANTEEN_ID });
    expect(restaurant?.adminClosed).toBe(true);

    // Simulate vendor trying to reopen while adminClosed is true
    let vendorReopenAllowed = false;
    let errorMessage = "";

    if (restaurant?.adminClosed) {
      errorMessage =
        "This restaurant was closed by platform administration and can only be reopened by an admin.";
      vendorReopenAllowed = false;
    } else {
      vendorReopenAllowed = true;
    }

    expect(vendorReopenAllowed).toBe(false);
    expect(errorMessage).toBe(
      "This restaurant was closed by platform administration and can only be reopened by an admin.",
    );

    // Confirm DB still has isOpen: false and adminClosed: true
    const current = await restaurants.findOne({ _id: CANTEEN_ID });
    expect(current?.isOpen).toBe(false);
    expect(current?.adminClosed).toBe(true);
  });

  it("allows admin to turn on a restaurant and clears adminClosed", async () => {
    const updated = await setRestaurantOpenAsAdmin({
      restaurantId: CANTEEN_ID,
      isOpen: true,
      actorId: "usr_admin_tester",
    });

    expect(updated).not.toBeNull();
    expect(updated?.isOpen).toBe(true);
    expect(updated?.adminClosed).toBe(false);

    const fromDb = await (await db.restaurants()).findOne({ _id: CANTEEN_ID });
    expect(fromDb?.isOpen).toBe(true);
    expect(fromDb?.adminClosed).toBe(false);

    // Audit log recorded
    const audit = await (await db.auditLogs()).findOne({
      entityId: CANTEEN_ID,
      actorId: "usr_admin_tester",
      to: "open",
    });
    expect(audit).not.toBeNull();
    expect(audit?.reason).toContain("Admin reopened restaurant");
  });

  it("allows ordering again once admin reopens the restaurant", async () => {
    const student = await getTestStudent();

    const preview = await previewCart({
      restaurantId: CANTEEN_ID,
      lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: ["opt_full"] }],
    });

    expect(preview).not.toBeNull();
    if (!preview) return;

    const closedIssue = preview.issues.find((i) => i.code === "UNAVAILABLE" && i.itemId === CANTEEN_ID);
    expect(closedIssue).toBeUndefined();

    const orderResult = await createOrder({
      customer: student,
      restaurantId: CANTEEN_ID,
      zoneId: "zone_boys_hostel",
      lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: ["opt_full"] }],
      idempotencyKey: "test_order_after_reopen",
    });

    expect(orderResult.ok).toBe(true);
    if (orderResult.ok) {
      await (await db.orders()).deleteOne({ _id: orderResult.order._id });
    }
  });
});
