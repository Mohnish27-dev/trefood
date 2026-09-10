import "server-only";

import * as db from "@/server/db/collections";
import { ACTOR, DEFAULTS, ORDER_STATUS } from "@/lib/constants";
import { transitionOrder, releasePendingOrders } from "./orders";
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
 * Four minutes of silence closes the order.
 *
 * There is no money to return — nothing was paid — so the whole cost of a
 * vendor ignoring their tablet is a student who went hungry waiting. That is
 * the more expensive one.
 *
 * Three expiries in one campus-local day also flips the restaurant closed and
 * flags it for admin. A canteen that cannot answer its tablet should not keep
 * taking orders — every further order it swallows is another student who
 * stops trusting the app.
 */
export async function expireUnackedOrders(
  now: Date = new Date(),
  /**
   * Narrows the sweep to one restaurant or one order.
   *
   * The cron runs it unscoped across every campus. The poll endpoints run it
   * scoped, because a scheduled job alone cannot be the mechanism here: the
   * deadline is four minutes and the cheapest cron tier fires once a day, so an
   * order would sit in New long after its countdown hit zero. The two poll
   * routes are already talking to the server every few seconds on behalf of the
   * exact two people waiting on this decision, so they settle it themselves and
   * the cron becomes the backstop for orders nobody has open.
   *
   * Safe to run from anywhere and from several places at once: the status guard
   * inside `transitionOrder` is a compare-and-swap, so whoever gets there first
   * performs the transition and the rest see a no-op.
   */
  scope: { restaurantId?: string; orderId?: string } = {},
): Promise<SweepReport> {
  await releasePendingOrders(scope);
  const report: SweepReport = { job: "expire-unacked", scanned: 0, acted: 0, errors: [] };

  const filter: Record<string, unknown> = { status: ORDER_STATUS.PLACED };
  if (scope.orderId) filter._id = scope.orderId;
  if (scope.restaurantId) filter.restaurantId = scope.restaurantId;

  const campuses = await campusMap();
  const orders = await (await db.orders()).find(filter).limit(200).toArray();

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

    await countExpiryAgainstRestaurant(order, now);
    await notifyOrderEvent({
      order: transition.order,
      title: "Your order could not be confirmed",
      body: `${order.restaurantSnapshot.name} is busier than usual and could not confirm it in time. Nothing has been charged — please try again shortly.`,
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
 * Fifteen minutes at the gate, and then there is only one thing that can happen.
 *
 * The rider cannot leave unpaid food with a security desk and walk away, so
 * the old prepaid path — leave the packet with the guard — has no meaning any
 * more. Every uncollected order ends the same way: the food goes back, the
 * vendor carries the loss of having cooked and carried it, and the student
 * takes a strike.
 *
 * The vendor eats that loss rather than the platform, which is the honest
 * allocation: we never held any of this money. What the strike buys is a
 * record an admin can act on when the same student does it twice.
 *
 * F10 — the student who took the food and never tapped — is indistinguishable
 * from a no-show here, and deliberately collapses into it. The confirm tap is
 * a receipt, not a payment gate: if the rider handed the packet over, they
 * were paid for it at the same moment.
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

    const transition = await transitionOrder({
      orderId: order._id,
      to: ORDER_STATUS.NO_SHOW,
      actor: ACTOR.SYSTEM,
      reason: "Order not collected within the grace window (F8)",
    });

    if (!transition.ok) {
      report.errors.push(`${order.orderNumber}: ${transition.message}`);
      continue;
    }

    await recordStrike({
      userId: order.customerId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      reason: "NO_SHOW",
      actor: ACTOR.SYSTEM,
    });
    await notifyOrderEvent({
      order: transition.order,
      title: "Your order was not collected",
      body: `${order.restaurantSnapshot.name} took it back. Orders that are not collected count as a strike.`,
    });

    report.acted += 1;
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
    await closeStaleGates(now),
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
