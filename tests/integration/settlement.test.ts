import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as db from "@/server/db/collections";
import { getMongoClient } from "@/server/db/client";
import { createOrder, transitionOrder } from "@/server/services/orders";
import { issueRefund } from "@/server/services/refunds";
import { writeLedgerEntry } from "@/server/services/ledger";
import { listSettlements, runSettlement, PAYOUT_FLOOR_PAISE } from "@/server/services/settlement";
import { campusDayRange } from "@/lib/campus-time";
import { ACTOR, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";
import type { Campus } from "@/types/campus";
import type { Order } from "@/types/order";
import type { User } from "@/types/user";

/**
 * The nightly settlement run, against a real database.
 *
 * MONEY_AND_SETTLEMENT.md section 6 makes four promises, and every one of them
 * is a way to pay a vendor the wrong amount if it breaks:
 *
 *   1. COD orders contribute EXACTLY ZERO — they settled at the gate
 *   2. re-running a day is a no-op (F15), not a second payout
 *   3. a negative net carries forward; money already sent is never clawed back
 *   4. a payout below the floor rolls forward rather than being eaten by fees
 *
 * Dates are far in the future so this never collides with a real run, and
 * every document it writes is deleted afterwards.
 *
 * Requires the seed (`npm run seed`).
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
  const user = await (await db.users()).findOne({ _id: "user_student_demo" });
  if (!found || !user) throw new Error("Seed missing. Run `npm run seed` first.");
  campus = found;
  student = user;
});

afterAll(async () => {
  await (await db.settlements()).deleteMany({ settlementDate: { $in: [DAY_ONE, DAY_TWO] } });
  if (createdOrderIds.length > 0) {
    await (await db.orders()).deleteMany({ _id: { $in: createdOrderIds } });
    await (await db.auditLogs()).deleteMany({ orderId: { $in: createdOrderIds } });
    await (await db.ledgerEntries()).deleteMany({ orderId: { $in: createdOrderIds } });
  }
  if (createdLedgerIds.length > 0) {
    await (await db.ledgerEntries()).deleteMany({ _id: { $in: createdLedgerIds } });
  }
  await (await getMongoClient()).close();
});

/** Places an order, walks it to DELIVERED, and lands it inside a campus day. */
async function deliveredOrderOn(
  settlementDate: string,
  method: typeof PAYMENT_METHOD.ONLINE_100 | typeof PAYMENT_METHOD.HYBRID_COD,
): Promise<Order> {
  const created = await createOrder({
    customer: student,
    restaurantId: RESTAURANT_ID,
    zoneId: "zone_ganga_boys",
    lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: [] }],
    method,
    idempotencyKey: `settlement-test-${settlementDate}-${method}-${Date.now()}`,
  });
  if (!created.ok) throw new Error(created.message);
  createdOrderIds.push(created.order._id);

  const orders = await db.orders();
  await orders.updateOne(
    { _id: created.order._id },
    {
      $set: {
        "payment.status": "CAPTURED",
        "payment.razorpayPaymentId": `stub_pay_${created.order._id}`,
        "payment.onlinePaidPaise":
          method === PAYMENT_METHOD.ONLINE_100
            ? created.order.pricing.grandTotalPaise
            : created.order.pricing.platformCommissionPaise +
              created.order.pricing.convenienceFeePaise,
      },
    },
  );

  const steps = [
    { to: ORDER_STATUS.PLACED, actor: ACTOR.WEBHOOK },
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
      reason: "settlement test",
    });
    if (!result.ok) throw new Error(`${step.to}: ${result.message}`);
    current = result.order;
  }

  // Land it inside the target campus-local day. Midday, so no timezone edge
  // can push it into a neighbouring one.
  const { start } = campusDayRange(settlementDate, campus.timezone);
  const deliveredAt = new Date(start.getTime() + 12 * 60 * 60_000);
  await orders.updateOne({ _id: current._id }, { $set: { "timestamps.deliveredAt": deliveredAt } });

  return { ...current, timestamps: { ...current.timestamps, deliveredAt } };
}

describe("the nightly settlement run", () => {
  it("pays prepaid receivables and counts COD as exactly zero", async () => {
    const prepaid = await deliveredOrderOn(DAY_ONE, PAYMENT_METHOD.ONLINE_100);
    const cod = await deliveredOrderOn(DAY_ONE, PAYMENT_METHOD.HYBRID_COD);

    const run = await runSettlement({ campus, settlementDate: DAY_ONE, actorId: "user_admin" });
    expect(run.settlementDate).toBe(DAY_ONE);

    const statement = (await listSettlements({ settlementDate: DAY_ONE })).find(
      (row) => row.restaurantId === RESTAURANT_ID,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    // The COD order is counted, but contributes nothing: its token already
    // paid our commission and its cash already paid the vendor.
    expect(statement.orderCount).toBe(2);
    expect(statement.codOrderCount).toBe(1);
    expect(statement.codContributionPaise).toBe(0);
    expect(statement.grossPrepaidPaise).toBe(prepaid.pricing.vendorReceivablePaise);
    // Stated the other way round too, because this is the invariant that would
    // quietly pay a vendor twice for the same cash if it ever broke.
    expect(statement.grossPrepaidPaise).not.toBe(
      prepaid.pricing.vendorReceivablePaise + cod.pricing.vendorReceivablePaise,
    );

    // Both orders close, so tomorrow's run cannot pick them up again.
    const orders = await db.orders();
    for (const id of [prepaid._id, cod._id]) {
      const after = await orders.findOne({ _id: id });
      expect(after?.status).toBe(ORDER_STATUS.SETTLED);
    }
  });

  it("F15 — a second run for the same day is a no-op, not a second payout", async () => {
    const before = await listSettlements({ settlementDate: DAY_ONE });

    const rerun = await runSettlement({ campus, settlementDate: DAY_ONE, actorId: "user_admin" });
    expect(rerun.written).toHaveLength(0);
    expect(rerun.skipped.length).toBeGreaterThan(0);
    expect(rerun.ordersSettled).toBe(0);

    const after = await listSettlements({ settlementDate: DAY_ONE });
    expect(after).toHaveLength(before.length);

    // The statement is immutable: the payout is generated FROM it, so a
    // re-run must not have moved a single rupee on the existing row.
    const firstBefore = before.find((row) => row.restaurantId === RESTAURANT_ID);
    const firstAfter = after.find((row) => row.restaurantId === RESTAURANT_ID);
    expect(firstAfter?.netPayablePaise).toBe(firstBefore?.netPayablePaise);
    expect(firstAfter?._id).toBe(firstBefore?._id);
  });

  it("carries a negative net forward instead of clawing money back", async () => {
    // A dispute debit comfortably bigger than the day's takings AND anything
    // carried in from day one, which can be up to the payout floor. The vendor
    // must not be billed; the shortfall follows them into the next run.
    const order = await deliveredOrderOn(DAY_TWO, PAYMENT_METHOD.ONLINE_100);
    const { start } = campusDayRange(DAY_TWO, campus.timezone);

    const entry = await writeLedgerEntry({
      restaurantId: RESTAURANT_ID,
      campusId: campus._id,
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: "DISPUTE_DEBIT",
      amountPaise: -(order.pricing.vendorReceivablePaise + PAYOUT_FLOOR_PAISE + R(500)),
      note: "settlement test: debit exceeding the day's takings",
    });
    createdLedgerIds.push(entry._id);
    await (await db.ledgerEntries()).updateOne(
      { _id: entry._id },
      { $set: { createdAt: new Date(start.getTime() + 12 * 60 * 60_000) } },
    );

    await runSettlement({ campus, settlementDate: DAY_TWO, actorId: "user_admin" });

    const statement = (await listSettlements({ settlementDate: DAY_TWO })).find(
      (row) => row.restaurantId === RESTAURANT_ID,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    expect(statement.netPayablePaise).toBe(0);
    expect(statement.carriedForwardPaise).toBeLessThan(0);

    // Nothing is invented and nothing is lost: what came in equals what went
    // out plus what was carried.
    expect(
      statement.grossPrepaidPaise + statement.adjustmentsPaise + statement.openingBalancePaise,
    ).toBe(statement.netPayablePaise + statement.carriedForwardPaise);
  });

  it("rolls a payout under the floor forward rather than letting fees eat it", async () => {
    const statement = (await listSettlements({ settlementDate: DAY_ONE })).find(
      (row) => row.restaurantId === RESTAURANT_ID,
    );
    expect(statement).toBeDefined();
    if (!statement) return;

    const net =
      statement.grossPrepaidPaise + statement.adjustmentsPaise + statement.openingBalancePaise;

    if (net < PAYOUT_FLOOR_PAISE) {
      expect(statement.netPayablePaise).toBe(0);
      expect(statement.carriedForwardPaise).toBe(net);
    } else {
      expect(statement.netPayablePaise).toBe(net);
      expect(statement.carriedForwardPaise).toBe(0);
    }
  });
});

describe("refunds — D2 and D3", () => {
  it("returns the refundable amount and books the gateway fee against the vendor", async () => {
    const created = await createOrder({
      customer: student,
      restaurantId: RESTAURANT_ID,
      zoneId: "zone_ganga_boys",
      lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: [] }],
      method: PAYMENT_METHOD.ONLINE_100,
      idempotencyKey: `refund-test-${Date.now()}`,
    });
    if (!created.ok) throw new Error(created.message);
    createdOrderIds.push(created.order._id);

    await (await db.orders()).updateOne(
      { _id: created.order._id },
      {
        $set: {
          "payment.status": "CAPTURED",
          "payment.razorpayPaymentId": `stub_pay_${created.order._id}`,
          "payment.onlinePaidPaise": created.order.pricing.grandTotalPaise,
        },
      },
    );

    const placed = await transitionOrder({
      orderId: created.order._id,
      to: ORDER_STATUS.PLACED,
      actor: ACTOR.WEBHOOK,
      reason: "refund test",
    });
    if (!placed.ok) throw new Error(placed.message);

    const rejected = await transitionOrder({
      orderId: placed.order._id,
      to: ORDER_STATUS.REJECTED_BY_VENDOR,
      actor: ACTOR.VENDOR,
      reason: "Out of paneer",
    });
    if (!rejected.ok) throw new Error(rejected.message);

    const refund = await issueRefund({ order: rejected.order, reason: "refund test" });
    expect(refund.ok).toBe(true);
    if (!refund.ok || refund.skipped) throw new Error("expected a real refund");

    // D2 — the convenience fee is never returned. It was Razorpay's, not ours.
    expect(refund.amountPaise).toBe(rejected.order.pricing.refundableAmountPaise);
    expect(refund.amountPaise).toBe(
      rejected.order.pricing.grandTotalPaise - rejected.order.pricing.convenienceFeePaise,
    );

    // D3 — and the fee Razorpay kept is debited from the vendor's next payout,
    // which is what makes a rejection carry a real cost.
    const recovery = await (await db.ledgerEntries()).findOne({
      orderId: rejected.order._id,
      type: "REFUND_GATEWAY_RECOVERY",
    });
    expect(recovery).toBeDefined();
    expect(recovery?.amountPaise).toBeLessThan(0);

    const after = await (await db.orders()).findOne({ _id: rejected.order._id });
    expect(after?.payment.status).toBe("REFUNDED");
  });
});
