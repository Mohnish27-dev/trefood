import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as db from "@/server/db/collections";
import { getMongoClient } from "@/server/db/client";
import { ACTOR, DEFAULTS, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { createOrder, getOrderForCustomer, listActiveOrdersForRestaurant, releasePendingOrders, transitionOrder } from "@/server/services/orders";
import { getVendorBoard } from "@/server/services/vendor";
import { setUpCanteenFixture, tearDownCanteenFixture, CANTEEN_ID } from "./canteen-fixture";
import { elapseOrderHold } from "./order-hold-fixture";
import type { User } from "@/types/user";

const ids: string[] = [];
const student: User = {
  _id: "test_cancellation_student", authId: null, name: "Cancellation test", email: "cancel@example.com",
  phone: "+919876543210", role: "STUDENT", campusId: "campus_nitp", restaurantId: null,
  ordersBlocked: false, ordersBlockedReason: null, strikes: 0, createdAt: new Date(), updatedAt: new Date(),
};

beforeAll(setUpCanteenFixture);
afterAll(async () => {
  await (await db.orders()).deleteMany({ _id: { $in: ids } });
  await (await db.auditLogs()).deleteMany({ orderId: { $in: ids } });
  await tearDownCanteenFixture();
  await (await getMongoClient()).close();
});

async function place() {
  const args = {
    customer: student, restaurantId: CANTEEN_ID, zoneId: "zone_main_gate",
    lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: ["opt_full"] }],
    idempotencyKey: randomUUID(),
  };
  const result = await createOrder(args);
  if (!result.ok) throw new Error(result.message);
  ids.push(result.order._id);
  return { order: result.order, args };
}
function cancel(orderId: string, customerId = student._id) {
  return transitionOrder({ orderId, to: ORDER_STATUS.CANCELLED_BY_STUDENT, actor: ACTOR.STUDENT,
    actorId: customerId, requireCustomerId: customerId, reason: "Changed my mind within 15 seconds" });
}

describe("15-second student cancellation window", () => {
  it("persists the exact window and hides held orders from vendor reads and actions", async () => {
    const { order, args } = await place();
    expect(order.status).toBe(ORDER_STATUS.PENDING_CONFIRMATION);
    expect(order.cancelUntil?.getTime()).toBe(order.timestamps.createdAt.getTime() + DEFAULTS.studentCancellationSeconds * 1_000);
    expect(order.timestamps.placedAt).toBeNull();
    expect((await getOrderForCustomer(order._id, student._id))?.status).toBe(ORDER_STATUS.PENDING_CONFIRMATION);
    expect((await listActiveOrdersForRestaurant(CANTEEN_ID)).some(o => o._id === order._id)).toBe(false);
    expect((await getVendorBoard({ restaurantId: CANTEEN_ID }))?.orders.some(o => o.orderId === order._id)).toBe(false);
    for (const to of [ORDER_STATUS.ACCEPTED, ORDER_STATUS.REJECTED_BY_VENDOR]) {
      expect((await transitionOrder({ orderId: order._id, to, actor: ACTOR.VENDOR,
        requireRestaurantId: CANTEEN_ID, prepMinutes: 20, reason: "Test" })).ok).toBe(false);
    }
    expect((await transitionOrder({ orderId: order._id, to: ORDER_STATUS.PLACED, actor: ACTOR.SYSTEM })).ok).toBe(false);
    const repeat = await createOrder(args);
    expect(repeat.ok && repeat.reused).toBe(true);
    expect(repeat.ok && repeat.order.cancelUntil).toEqual(order.cancelUntil);
  });

  it("only lets the owner cancel and never releases the cancelled order", async () => {
    const { order } = await place();
    expect((await cancel(order._id, "another-student")).ok).toBe(false);
    const attempts = await Promise.all([cancel(order._id), cancel(order._id)]);
    expect(attempts.filter(r => r.ok)).toHaveLength(1);
    await elapseOrderHold(order._id);
    const stored = await (await db.orders()).findOne({ _id: order._id });
    expect(stored?.status).toBe(ORDER_STATUS.CANCELLED_BY_STUDENT);
    expect(stored?.cancellation?.by).toBe("STUDENT");
    expect(stored?.payment.status).toBe(PAYMENT_STATUS.UNCOLLECTED);
    expect(stored?.timestamps.placedAt).toBeNull();
    expect((await listActiveOrdersForRestaurant(CANTEEN_ID)).some(o => o._id === order._id)).toBe(false);
    expect(await (await db.auditLogs()).countDocuments({ orderId: order._id, to: ORDER_STATUS.CANCELLED_BY_STUDENT })).toBe(1);
    expect(await (await db.auditLogs()).countDocuments({ orderId: order._id, to: ORDER_STATUS.PLACED })).toBe(0);
  });

  it("releases on vendor polling without a student tab and starts a fresh acknowledgement timer", async () => {
    const { order } = await place();
    await (await db.orders()).updateOne({ _id: order._id }, { $set: { cancelUntil: new Date(0) } });
    const beforeRelease = Date.now();
    const board = await getVendorBoard({ restaurantId: CANTEEN_ID });
    const visible = board?.orders.find(o => o.orderId === order._id);
    expect(visible?.status).toBe(ORDER_STATUS.PLACED);
    expect(new Date(visible?.placedAt ?? 0).getTime()).toBeGreaterThanOrEqual(beforeRelease);
    expect(new Date(visible?.ackDeadline ?? 0).getTime() - new Date(visible?.placedAt ?? 0).getTime()).toBe(240_000);
    expect((await cancel(order._id)).ok).toBe(false);
    expect((await transitionOrder({ orderId: order._id, to: ORDER_STATUS.ACCEPTED, actor: ACTOR.VENDOR,
      requireRestaurantId: CANTEEN_ID, prepMinutes: 20 })).ok).toBe(true);
  });

  it("rejects cancellation at the database deadline even if release has not run; releases once under races", async () => {
    const { order } = await place();
    // The database clock, not a forged browser time, defines the exact cutoff.
    await (await db.orders()).updateOne({ _id: order._id }, [{ $set: { cancelUntil: "$$NOW" } }]);
    const [cancelled] = await Promise.all([
      cancel(order._id), releasePendingOrders({ orderId: order._id }), releasePendingOrders({ orderId: order._id }),
    ]);
    expect(cancelled.ok).toBe(false);
    expect((await getOrderForCustomer(order._id, student._id))?.status).toBe(ORDER_STATUS.PLACED);
    expect(await (await db.auditLogs()).countDocuments({ orderId: order._id, to: ORDER_STATUS.PLACED })).toBe(1);
  });
});
