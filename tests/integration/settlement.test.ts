import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as db from "@/server/db/collections";
import { getMongoClient } from "@/server/db/client";
import { createOrder, transitionOrder } from "@/server/services/orders";
import { writeLedgerEntry } from "@/server/services/ledger";
import {
  listStatements,
  runSettlement,
  COLLECTION_FLOOR_PAISE,
} from "@/server/services/settlement";
import { campusDayRange } from "@/lib/campus-time";
import { ACTOR, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";
import type { Campus } from "@/types/campus";
import type { Order } from "@/types/order";
import type { User } from "@/types/user";
import { setUpCanteenFixture, tearDownCanteenFixture } from "./canteen-fixture";

/**
 * The nightly commission run, against a real database.
 *
 * MONEY_AND_SETTLEMENT.md section 6 makes four promises, and every one of them
 * is a way to bill a vendor the wrong amount if it breaks:
 *
 *   1. only DELIVERED orders carry commission — nothing else collected cash
 *   2. re-running a day is a no-op (F15), not a second invoice
 *   3. a negative net carries forward; money already handed over is not returned
 *   4. a due below the floor rolls forward rather than being chased
 *
 * Dates are far in the future so this never collides with a real run, and
 * every document it writes is deleted afterwards.
 *
 * Needs the campus from the seed (`npm run seed`); the restaurant it orders
 * from is created and removed by canteen-fixture, so the test no longer depends
 * on any seeded vendor.
 */

const R = rupeesToPaise;
const RESTAURANT_ID = "rest_nit_canteen";

/** Deliberately absurd, so a stray row is obviously from this test. */
const DAY_ONE = "2099-01-01";
const DAY_TWO = "2099-01-02";

let campus: Campus;
let student: User;
const createdOrderIds: string[] = [];
const createdLedgerIds: string[] = [];

beforeAll(async () => {
  const found = await (await db.campuses()).findOne({ slug: "nit-patna" });
  if (!found) throw new Error("Seed missing. Run `npm run seed` first.");
  campus = found;

  const users = await db.users();
  let user = await users.findOne({ _id: "test_student_settlement_fixture" });
  if (!user) {
    const fixture: User = {
      _id: "test_student_settlement_fixture",
      authId: null,
      role: "STUDENT",
      name: "Settlement Test Student",
      email: "settlement.student@nitp.ac.in",
      phone: "+919876500001",
      campusId: campus._id,
      restaurantId: null,
      strikes: 0,
      ordersBlocked: false,
      ordersBlockedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await users.replaceOne({ _id: fixture._id }, fixture, { upsert: true });
    user = fixture;
  }
  student = user;

  await setUpCanteenFixture();
  await (await db.orders()).deleteMany({ restaurantId: RESTAURANT_ID });
  await (await db.commissionStatements()).deleteMany({
    statementDate: { $in: [DAY_ONE, DAY_TWO] },
  });
});

afterAll(async () => {
  // Statement audit entries point at the statement by _id (their orderId is
  // null), so grab those ids BEFORE deleting the statements — otherwise the
  // audit rows are orphaned and leak into the next run.
  const statements = await db.commissionStatements();
  const statementIds = (
    await statements
      .find({ statementDate: { $in: [DAY_ONE, DAY_TWO] } })
      .project<{ _id: string }>({ _id: 1 })
      .toArray()
  ).map((s) => s._id);
  if (statementIds.length > 0) {
    await (
      await db.auditLogs()
    ).deleteMany({ entity: "STATEMENT", entityId: { $in: statementIds } });
  }
  await statements.deleteMany({ statementDate: { $in: [DAY_ONE, DAY_TWO] } });
  if (createdOrderIds.length > 0) {
    await (await db.orders()).deleteMany({ _id: { $in: createdOrderIds } });
    await (await db.auditLogs()).deleteMany({ orderId: { $in: createdOrderIds } });
    await (await db.ledgerEntries()).deleteMany({ orderId: { $in: createdOrderIds } });
  }
  if (createdLedgerIds.length > 0) {
    await (await db.ledgerEntries()).deleteMany({ _id: { $in: createdLedgerIds } });
  }
  await (await db.users()).deleteOne({ _id: "test_student_settlement_fixture" });
  await tearDownCanteenFixture();
  await (await getMongoClient()).close();
});

/** Places an order, walks it to DELIVERED, and lands it inside a campus day. */
async function deliveredOrderOn(statementDate: string): Promise<Order> {
  const created = await createOrder({
    customer: student,
    restaurantId: RESTAURANT_ID,
    zoneId: "zone_boys_hostel",
    lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: [] }],
    idempotencyKey: `statement-test-${statementDate}-${Date.now()}-${Math.random()}`,
  });
  if (!created.ok) throw new Error(created.message);
  createdOrderIds.push(created.order._id);

  const orders = await db.orders();

  const steps = [
    { to: ORDER_STATUS.ACCEPTED, actor: ACTOR.VENDOR, prepMinutes: 20 },
    { to: ORDER_STATUS.PREPARING, actor: ACTOR.VENDOR },
    { to: ORDER_STATUS.READY, actor: ACTOR.VENDOR },
    { to: ORDER_STATUS.OUT_FOR_DELIVERY, actor: ACTOR.VENDOR },
    { to: ORDER_STATUS.AT_GATE, actor: ACTOR.VENDOR },
    { to: ORDER_STATUS.DELIVERED, actor: ACTOR.STUDENT },
  ] as const;

  let current = created.order;
  for (const step of steps) {
    const result = await transitionOrder({
      orderId: current._id,
      to: step.to,
      actor: step.actor,
      ...("prepMinutes" in step ? { prepMinutes: step.prepMinutes } : {}),
      reason: "statement test",
    });
    if (!result.ok) throw new Error(`${step.to}: ${result.message}`);
    current = result.order;
  }

  // Land it inside the target campus-local day. Midday, so no timezone edge
  // can push it into a neighbouring one.
  const { start } = campusDayRange(statementDate, campus.timezone);
  const deliveredAt = new Date(start.getTime() + 12 * 60 * 60_000);
  await orders.updateOne({ _id: current._id }, { $set: { "timestamps.deliveredAt": deliveredAt } });

  return { ...current, timestamps: { ...current.timestamps, deliveredAt } };
}

describe("the nightly commission run", () => {
  it("bills the commission on every delivered order and nothing else", async () => {
    const first = await deliveredOrderOn(DAY_ONE);
    const second = await deliveredOrderOn(DAY_ONE);

    const run = await runSettlement({ campus, statementDate: DAY_ONE, actorId: "user_admin" });
    expect(run.statementDate).toBe(DAY_ONE);

    const statement = (await listStatements({ statementDate: DAY_ONE })).find(
      (row) => row.restaurantId === RESTAURANT_ID,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    expect(statement.orderCount).toBe(2);

    // The vendor's staff collected both bills in full.
    expect(statement.cashCollectedPaise).toBe(
      first.payment.cashDuePaise + second.payment.cashDuePaise,
    );
    // And they owe us the commission on both.
    expect(statement.commissionDuePaise).toBe(
      first.pricing.platformCommissionPaise + second.pricing.platformCommissionPaise,
    );
    // The commission is never more than the cash it was charged on — the
    // invariant that would have a vendor paying to cook if it ever broke.
    expect(statement.commissionDuePaise).toBeLessThan(statement.cashCollectedPaise);

    // Both orders close, so tomorrow's run cannot bill them again.
    const orders = await db.orders();
    for (const id of [first._id, second._id]) {
      const after = await orders.findOne({ _id: id });
      expect(after?.status).toBe(ORDER_STATUS.SETTLED);
      expect(after?.payment.status).toBe(PAYMENT_STATUS.COLLECTED);
    }
  });

  it("charges nothing for an order that never reached a gate", async () => {
    const created = await createOrder({
      customer: student,
      restaurantId: RESTAURANT_ID,
      zoneId: "zone_boys_hostel",
      lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: [] }],
      idempotencyKey: `rejected-test-${Date.now()}-${Math.random()}`,
    });
    if (!created.ok) throw new Error(created.message);
    createdOrderIds.push(created.order._id);

    const rejected = await transitionOrder({
      orderId: created.order._id,
      to: ORDER_STATUS.REJECTED_BY_VENDOR,
      actor: ACTOR.VENDOR,
      reason: "Out of paneer",
    });
    if (!rejected.ok) throw new Error(rejected.message);

    // No food, no cash, nothing owed in either direction.
    expect(rejected.order.payment.status).toBe(PAYMENT_STATUS.UNCOLLECTED);
    expect(rejected.order.payment.cashCollectedPaise).toBe(0);

    // And it never lands on a statement, because it has no deliveredAt.
    expect(rejected.order.timestamps.deliveredAt).toBeNull();
  });

  it("F15 — a second run for the same day is a no-op, not a second invoice", async () => {
    const before = await listStatements({ statementDate: DAY_ONE });

    const rerun = await runSettlement({ campus, statementDate: DAY_ONE, actorId: "user_admin" });
    expect(rerun.written).toHaveLength(0);
    expect(rerun.skipped.length).toBeGreaterThan(0);
    expect(rerun.ordersSettled).toBe(0);

    const after = await listStatements({ statementDate: DAY_ONE });
    expect(after).toHaveLength(before.length);

    // The statement is immutable: the invoice is generated FROM it, so a
    // re-run must not have moved a single rupee on the existing row.
    const firstBefore = before.find((row) => row.restaurantId === RESTAURANT_ID);
    const firstAfter = after.find((row) => row.restaurantId === RESTAURANT_ID);
    expect(firstAfter?.netDuePaise).toBe(firstBefore?.netDuePaise);
    expect(firstAfter?._id).toBe(firstBefore?._id);
  });

  it("carries a negative net forward instead of refunding money already collected", async () => {
    // A credit comfortably bigger than the day's commission AND anything
    // carried in from day one. We must not pay the vendor; the balance follows
    // them into the next run.
    const order = await deliveredOrderOn(DAY_TWO);
    const { start } = campusDayRange(DAY_TWO, campus.timezone);

    const entry = await writeLedgerEntry({
      restaurantId: RESTAURANT_ID,
      campusId: campus._id,
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: "MANUAL_ADJUSTMENT",
      // Negative: a credit against what they owe, larger than the day's due.
      amountPaise: -(order.pricing.platformCommissionPaise + COLLECTION_FLOOR_PAISE + R(500)),
      note: "statement test: credit exceeding the day's commission",
    });
    createdLedgerIds.push(entry._id);
    await (await db.ledgerEntries()).updateOne(
      { _id: entry._id },
      { $set: { createdAt: new Date(start.getTime() + 12 * 60 * 60_000) } },
    );

    await runSettlement({ campus, statementDate: DAY_TWO, actorId: "user_admin" });

    const statement = (await listStatements({ statementDate: DAY_TWO })).find(
      (row) => row.restaurantId === RESTAURANT_ID,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    expect(statement.netDuePaise).toBe(0);
    expect(statement.carriedForwardPaise).toBeLessThan(0);

    // Nothing is invented and nothing is lost: what was billed equals what is
    // collected plus what was carried.
    expect(
      statement.commissionDuePaise + statement.adjustmentsPaise + statement.openingBalancePaise,
    ).toBe(statement.netDuePaise + statement.carriedForwardPaise);
  });

  it("rolls a due under the floor forward rather than chasing small change", async () => {
    const statement = (await listStatements({ statementDate: DAY_ONE })).find(
      (row) => row.restaurantId === RESTAURANT_ID,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    const net =
      statement.commissionDuePaise + statement.adjustmentsPaise + statement.openingBalancePaise;

    if (net < COLLECTION_FLOOR_PAISE) {
      expect(statement.netDuePaise).toBe(0);
      expect(statement.carriedForwardPaise).toBe(net);
    } else {
      expect(statement.netDuePaise).toBe(net);
      expect(statement.carriedForwardPaise).toBe(0);
    }
  });
});
