import "server-only";

import * as db from "@/server/db/collections";
import { ACTOR, DEFAULTS, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/constants";
import { issueRefund } from "./refunds";
import { transitionOrder } from "./orders";
import { recordStrike } from "./students";
import { autoResolveExpiredStockouts } from "./stockout";
import { notifyOrderEvent } from "./push";
import { writeAudit } from "./audit";
import type { Campus } from "@/types/campus";
import type { Order } from "@/types/order";

/**
 * The timers. FAILURES_AND_EDGE_CASES.md section 2.
 *
 * Every one of these is a deadline somebody missed, and every one of them has
 * to resolve without a human — at 01:40 there is nobody to ask. They are
 * written as idempotent sweeps rather than per-order timers because a
 * serverless process cannot hold a `setTimeout` across a cold start, and an
 * order stuck because the instance that owned its timer was recycled is worse
 * than a sweep that runs a few seconds late.
 *
 * Each sweep is safe to run concurrently: the status guard inside
 * `transitionOrder` is a compare-and-swap, so two runs racing on the same
 * order produce one transition and one audit entry.
 */

export interface SweepReport {
  job: string;
  scanned: number;
  acted: number;
  errors: string[];
}

/* ══════════════════════════════════════════════════════════════════════
   F4 — the vendor who never answered
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Four minutes of silence closes the order and returns the money.
 *
 * Three expiries in one campus-local day also flips the restaurant closed and
 * flags it for admin. A canteen that cannot answer its tablet should not keep
 * taking orders — every further order it swallows is another refund and
 * another student who stops trusting the app.
 */
export async function expireUnackedOrders(now: Date = new Date()): Promise<SweepReport> {
  const report: SweepReport = { job: "expire-unacked", scanned: 0, acted: 0, errors: [] };

  const campuses = await campusMap();
  const orders = await (await db.orders())
    .find({ status: ORDER_STATUS.PLACED })
    .limit(200)
    .toArray();

  for (const order of orders) {
    const campus = campuses.get(order.campusId);
    const placedAt = order.timestamps.placedAt;
    if (!campus || !placedAt) continue;

    report.scanned += 1;
    const deadline = placedAt.getTime() + campus.settings.vendorAutoExpireSeconds * 1_000;
    if (now.getTime() < deadline) continue;

    const transition = await transitionOrder({
      orderId: order._id,
      to: ORDER_STATUS.EXPIRED_NO_ACK,
      actor: ACTOR.SYSTEM,
      reason: `${order.restaurantSnapshot.name} did not respond within ${Math.trunc(
        campus.settings.vendorAutoExpireSeconds / 60,
      )} minutes`,
    });

    if (!transition.ok) {
      report.errors.push(`${order.orderNumber}: ${transition.message}`);
      continue;
    }

    const refund = await issueRefund({
      order: transition.order,
      reason: `Vendor did not acknowledge ${order.orderNumber} (F4)`,
    });
    if (!refund.ok) report.errors.push(`${order.orderNumber} refund: ${refund.message}`);

    await countExpiryAgainstRestaurant(order, now);
    await notifyOrderEvent({
      order: transition.order,
      title: "Your order could not be started",
      body: `${order.restaurantSnapshot.name} did not respond. Your refund is on its way.`,
    });

    report.acted += 1;
  }

  return report;
}

async function countExpiryAgainstRestaurant(order: Order, now: Date): Promise<void> {
  const restaurants = await db.restaurants();
  const updated = await restaurants.findOneAndUpdate(
    { _id: order.restaurantId },
    { $inc: { expiryCountToday: 1 }, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );

  if (!updated || updated.expiryCountToday < DEFAULTS.dailyExpiryCloseThreshold) return;
  if (!updated.isOpen) return;

  await restaurants.updateOne(
    { _id: updated._id },
    { $set: { isOpen: false, autoClosedAt: now, updatedAt: now } },
  );

  await writeAudit({
    entity: "RESTAURANT",
    entityId: updated._id,
    from: "open",
    to: "auto-closed",
    actorId: null,
    actorRole: ACTOR.SYSTEM,
    reason: `${updated.expiryCountToday} unacknowledged orders today (F4)`,
  });
}

/* ══════════════════════════════════════════════════════════════════════
   F7 / F8 / F10 — the student who did not come to the gate
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Fifteen minutes at the gate, then the two paths diverge completely.
 *
 *   PREPAID  the rider leaves the packet with the hostel guard. The platform
 *            already holds the money, so nothing is at risk but the food.
 *   COD      the rider cannot leave unpaid food. It goes back, the token is
 *            forfeited to the vendor as compensation, and a strike is recorded.
 *
 * F10 — the student who took the food and never tapped — is indistinguishable
 * from F7 at this point, and deliberately collapses into it. The confirm tap
 * is a receipt, not a payment gate: the vendor already has the cash or the
 * platform already has the money either way.
 */
export async function closeStaleGates(now: Date = new Date()): Promise<SweepReport> {
  const report: SweepReport = { job: "close-stale-gates", scanned: 0, acted: 0, errors: [] };

  const campuses = await campusMap();
  const orders = await (await db.orders())
    .find({ status: ORDER_STATUS.AT_GATE })
    .limit(200)
    .toArray();

  for (const order of orders) {
    const campus = campuses.get(order.campusId);
    const atGateAt = order.timestamps.atGateAt;
    if (!campus || !atGateAt) continue;

    report.scanned += 1;
    if (now.getTime() < atGateAt.getTime() + campus.settings.gateGraceSeconds * 1_000) continue;

    const isCod = order.payment.method === PAYMENT_METHOD.HYBRID_COD;

    const transition = await transitionOrder({
      orderId: order._id,
      to: isCod ? ORDER_STATUS.NO_SHOW : ORDER_STATUS.DELIVERED_TO_SECURITY,
      actor: ACTOR.SYSTEM,
      reason: isCod
        ? "COD order not collected within the grace window (F8)"
        : "Prepaid order left with gate security after the grace window (F7)",
    });

    if (!transition.ok) {
      report.errors.push(`${order.orderNumber}: ${transition.message}`);
      continue;
    }

    if (isCod) {
      // No refund, by design (D1). The token stays with the vendor as
      // compensation for food that was cooked and carried for nothing.
      await recordStrike({
        userId: order.customerId,
        orderId: order._id,
        orderNumber: order.orderNumber,
        reason: "NO_SHOW_COD",
        actor: ACTOR.SYSTEM,
      });
      await notifyOrderEvent({
        order: transition.order,
        title: "Your order was not collected",
        body: `${order.restaurantSnapshot.name} took it back. Cash orders that are not collected count as a strike.`,
      });
    } else {
      await notifyOrderEvent({
        order: transition.order,
        title: "Left with gate security",
        body: `Your order is with security at ${order.deliveryZoneSnapshot.name}. Collect it there.`,
      });
    }

    report.acted += 1;
  }

  return report;
}

/* ══════════════════════════════════════════════════════════════════════
   F1 / F2 — the payment that never confirmed
   ══════════════════════════════════════════════════════════════════════ */

/**
 * An order stuck in PAYMENT_PENDING is a student on hostel wifi whose UPI app
 * succeeded while their browser tab died.
 *
 * Reconciliation against the gateway is Phase 9 work and belongs behind the
 * same `PaymentProvider` seam. What runs now is the other half: after the
 * abandon window, the order is closed as PAYMENT_FAILED so it stops sitting in
 * a student's history as a live order that will never move.
 */
export async function abandonStalePayments(now: Date = new Date()): Promise<SweepReport> {
  const report: SweepReport = { job: "abandon-payments", scanned: 0, acted: 0, errors: [] };

  const cutoff = new Date(now.getTime() - DEFAULTS.paymentAbandonMinutes * 60_000);
  const orders = await (await db.orders())
    .find({ status: ORDER_STATUS.PAYMENT_PENDING, "timestamps.createdAt": { $lt: cutoff } })
    .limit(200)
    .toArray();

  for (const order of orders) {
    report.scanned += 1;
    const transition = await transitionOrder({
      orderId: order._id,
      to: ORDER_STATUS.PAYMENT_FAILED,
      actor: ACTOR.SYSTEM,
      reason: `Payment not completed within ${DEFAULTS.paymentAbandonMinutes} minutes (F1)`,
    });
    if (transition.ok) report.acted += 1;
    else report.errors.push(`${order.orderNumber}: ${transition.message}`);
  }

  return report;
}

/* ══════════════════════════════════════════════════════════════════════
   F16 — the refund the gateway would not take
   ══════════════════════════════════════════════════════════════════════ */

/** Three attempts, then it is an admin's problem rather than a loop's. */
export const REFUND_MAX_ATTEMPTS = 3;

/**
 * Retry refunds that failed at the gateway.
 *
 * Money that fails to move must never fail silently. After three attempts the
 * order stops being retried and stays visible with its error payload, because
 * the fix at that point is a human opening the Razorpay dashboard — and a
 * cron that keeps retrying forever is how that human never finds out.
 */
export async function retryFailedRefunds(now: Date = new Date()): Promise<SweepReport> {
  const report: SweepReport = { job: "retry-refunds", scanned: 0, acted: 0, errors: [] };

  const orders = await (await db.orders())
    .find({ "refund.status": "FAILED", "refund.attempts": { $lt: REFUND_MAX_ATTEMPTS } })
    .limit(50)
    .toArray();

  for (const order of orders) {
    report.scanned += 1;

    // Exponential backoff between attempts: 1, then 4, then 9 minutes. A
    // gateway having a bad minute should not be hammered for it.
    const attempts = order.refund?.attempts ?? 1;
    const waitMs = attempts * attempts * 60_000;
    const lastAt = order.refund?.at.getTime() ?? 0;
    if (now.getTime() < lastAt + waitMs) continue;

    const result = await issueRefund({
      order,
      amountPaise: order.refund?.amountPaise ?? order.pricing.refundableAmountPaise,
      reason: `Retry ${attempts + 1} of a failed refund on ${order.orderNumber}`,
      // The recovery entry was already booked on the first attempt; booking it
      // again on each retry would debit the vendor three times for one refund.
      recoverGatewayFeeFromVendor: false,
    });

    if (result.ok) report.acted += 1;
    else report.errors.push(`${order.orderNumber}: ${result.message}`);
  }

  return report;
}

/* ══════════════════════════════════════════════════════════════════════
   F6 — the stockout nobody answered
   ══════════════════════════════════════════════════════════════════════ */

export async function resolveExpiredStockouts(now: Date = new Date()): Promise<SweepReport> {
  const acted = await autoResolveExpiredStockouts(now);
  return { job: "resolve-stockouts", scanned: acted, acted, errors: [] };
}

/* ══════════════════════════════════════════════════════════════════════
   Everything, in one pass
   ══════════════════════════════════════════════════════════════════════ */

/**
 * The order matters. Stockouts resolve first so an order that is about to be
 * cancelled is not also expired; gates close last so an order that just moved
 * to AT_GATE gets its full grace window.
 */
export async function runAllSweeps(now: Date = new Date()): Promise<SweepReport[]> {
  return [
    await resolveExpiredStockouts(now),
    await expireUnackedOrders(now),
    await abandonStalePayments(now),
    await closeStaleGates(now),
    await retryFailedRefunds(now),
  ];
}

/** Reset the F4 counter at the start of each campus day. Called by the nightly run. */
export async function resetDailyExpiryCounts(campusId: string): Promise<number> {
  const result = await (await db.restaurants()).updateMany(
    { campusId, expiryCountToday: { $gt: 0 } },
    { $set: { expiryCountToday: 0, updatedAt: new Date() } },
  );
  return result.modifiedCount;
}

async function campusMap(): Promise<Map<string, Campus>> {
  const rows = await (await db.campuses()).find({}).toArray();
  return new Map(rows.map((campus) => [campus._id, campus]));
}
