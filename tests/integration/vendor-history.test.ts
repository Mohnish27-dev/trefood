import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as db from "@/server/db/collections";
import { getMongoClient } from "@/server/db/client";
import { ORDER_STATUS } from "@/lib/constants";
import { createOrder } from "@/server/services/orders";
import { getVendorOrderHistory } from "@/server/services/vendor-history";
import { setUpCanteenFixture, tearDownCanteenFixture, CANTEEN_ID } from "./canteen-fixture";
import type { User } from "@/types/user";

const ids: string[] = [];
const student: User = {
  _id: "test_history_student", authId: null, name: "History Student", email: "history@example.com",
  phone: "+919876543210", role: "STUDENT", campusId: "campus_nitp", restaurantId: null,
  ordersBlocked: false, ordersBlockedReason: null, strikes: 0, createdAt: new Date(), updatedAt: new Date(),
};

beforeAll(async () => {
  await setUpCanteenFixture();
  const created = await createOrder({ customer: student, restaurantId: CANTEEN_ID, zoneId: "zone_main_gate",
    lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: ["opt_full"] }], idempotencyKey: randomUUID() });
  if (!created.ok) throw new Error(created.message);
  ids.push(created.order._id);
  const statuses = [ORDER_STATUS.ACCEPTED, ORDER_STATUS.REJECTED_BY_VENDOR, ORDER_STATUS.DELIVERED,
    ORDER_STATUS.SETTLED, ORDER_STATUS.CANCELLED_BY_STUDENT, ORDER_STATUS.PENDING_CONFIRMATION];
  const rows = Array.from({ length: 26 }, (_, index) => {
    const status = statuses[index % statuses.length] ?? ORDER_STATUS.DELIVERED;
    const id = `history-test-${randomUUID()}`;
    ids.push(id);
    return { ...created.order, _id: id, orderNumber: id, idempotencyKey: id, status,
      cancelUntil: new Date(Date.now() + 3_600_000),
      restaurantId: index === 25 ? "other-history-restaurant" : CANTEEN_ID,
      timestamps: { ...created.order.timestamps, createdAt: new Date(1_700_000_000_000 + index * 1_000),
        acceptedAt: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.DELIVERED, ORDER_STATUS.SETTLED].includes(status as "ACCEPTED" | "DELIVERED" | "SETTLED") ? new Date() : null },
    };
  });
  await (await db.orders()).insertMany(rows);
});
afterAll(async () => {
  await (await db.orders()).deleteMany({ _id: { $in: ids } });
  await (await db.auditLogs()).deleteMany({ orderId: { $in: ids } });
  await tearDownCanteenFixture();
  await (await getMongoClient()).close();
});

describe("vendor order history", () => {
  it("only returns this restaurant's received orders, newest first, without gate codes", async () => {
    const history = await getVendorOrderHistory({ restaurantId: CANTEEN_ID });
    expect(history.total).toBe(17);
    expect(history.orders).toHaveLength(17);
    expect(history.orders.every(order => order.status !== ORDER_STATUS.PENDING_CONFIRMATION && order.status !== ORDER_STATUS.CANCELLED_BY_STUDENT)).toBe(true);
    expect(history.orders.map(order => order.createdAt)).toEqual(history.orders.map(order => order.createdAt).sort().reverse());
    expect(history.orders[0]).not.toHaveProperty("gateCode");
    const other = await getVendorOrderHistory({ restaurantId: "other-history-restaurant" });
    expect(other.total).toBe(1);
    expect(history.orders.some(order => order.id === other.orders[0]?.id)).toBe(false);
  });

  it("filters accepted (including completed), rejected, and completed orders", async () => {
    const accepted = await getVendorOrderHistory({ restaurantId: CANTEEN_ID, filter: "accepted" });
    expect(accepted.total).toBe(13);
    expect(accepted.orders.every(order => order.acceptedAt !== null)).toBe(true);
    const rejected = await getVendorOrderHistory({ restaurantId: CANTEEN_ID, filter: "rejected" });
    expect(rejected.total).toBe(4);
    expect(rejected.orders.every(order => order.status === ORDER_STATUS.REJECTED_BY_VENDOR)).toBe(true);
    const completed = await getVendorOrderHistory({ restaurantId: CANTEEN_ID, filter: "completed" });
    expect(completed.total).toBe(8);
  });

  it("paginates without overlapping rows and safely handles invalid filters/pages", async () => {
    const collection = await db.orders();
    const templateId = ids[0];
    if (!templateId) throw new Error("Fixture id missing");
    const template = await collection.findOne({ _id: templateId });
    if (!template) throw new Error("Fixture missing");
    const extra = Array.from({ length: 10 }, () => {
      const id = `history-test-${randomUUID()}`;
      ids.push(id);
      return { ...template, _id: id, orderNumber: id, idempotencyKey: id, status: ORDER_STATUS.DELIVERED };
    });
    await collection.insertMany(extra);
    const first = await getVendorOrderHistory({ restaurantId: CANTEEN_ID, filter: "unknown", page: -3 });
    const second = await getVendorOrderHistory({ restaurantId: CANTEEN_ID, page: 999 });
    expect(first.filter).toBe("all");
    expect(first.page).toBe(1);
    expect(first.orders).toHaveLength(20);
    expect(second.page).toBe(2);
    expect(second.orders).toHaveLength(7);
    expect(second.orders.some(order => first.orders.some(row => row.id === order.id))).toBe(false);
    const empty = await getVendorOrderHistory({ restaurantId: "missing", page: NaN });
    expect(empty.orders).toEqual([]);
    expect(empty.page).toBe(1);
  });
});
