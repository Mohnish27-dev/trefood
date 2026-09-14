import "server-only";

import { DEFAULTS, ORDER_STATUS } from "@/lib/constants";
import { getCampusById } from "./catalog";
import { getOrder, releasePendingOrders } from "./orders";
import { notifyVendorNewOrder } from "./push";

/**
 * ★ No vendor misses an order because their phone was on the table ★
 *
 * An order sits in its 15-second student-cancellation hold, and until now the
 * only things that moved it on to PLACED were polls: the student's tracker or
 * the vendor's board. The cron routes are not scheduled in production
 * (DEPLOYMENT.md). So a student who closed the app straight after checkout,
 * ordering from a vendor whose phone was locked, produced an order that no
 * process would ever release. No push can fire for an order that never
 * reaches the restaurant.
 *
 * This is the missing timer. It is started from the checkout request (via
 * `after()`, so the student's response is not held up), and it:
 *
 *   1. waits out the hold and releases the order, which sends the first
 *      vendor push from inside `releasePendingOrders`;
 *   2. re-buzzes every minute while the order is still unanswered, stopping
 *      the moment it is accepted, rejected or expired, and never after the
 *      acknowledgement deadline.
 *
 * It is an accelerator, not the source of truth. A restart mid-wait loses the
 * timer, and then the polls and the cron release the order exactly as before.
 * The first alert still fires in that case, because it lives in the release
 * itself, not here. Only reminders depend on this process staying up.
 */

/** A little past the deadline, so the `$lte: $$NOW` guard on release is already true. */
const RELEASE_SLACK_MS = 750;
const REMINDER_INTERVAL_MS = 60_000;

export async function driveNewOrderAlerts(
  orderId: string,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<void> {
  try {
    const created = await getOrder(orderId);
    if (!created || created.status !== ORDER_STATUS.PENDING_CONFIRMATION) return;

    const cancelUntil = created.cancelUntil?.getTime() ?? Date.now();
    await sleep(Math.max(0, cancelUntil - Date.now()) + RELEASE_SLACK_MS);
    await releasePendingOrders({ orderId });

    const campus = await getCampusById(created.campusId);
    const expireMs =
      (campus?.settings.vendorAutoExpireSeconds ?? DEFAULTS.vendorAutoExpireSeconds) * 1_000;

    for (let reminder = 1; ; reminder += 1) {
      const order = await getOrder(orderId);
      // Released by someone else, or not at all yet (the student cancelled in
      // the last instant). Either way the order is no longer ours to chase.
      const placedAt = order?.timestamps.placedAt?.getTime();
      if (!order || order.status !== ORDER_STATUS.PLACED || placedAt === undefined) return;

      const remindAt = placedAt + reminder * REMINDER_INTERVAL_MS;
      const deadline = placedAt + expireMs;
      // A reminder that lands in the final moments would say "auto-cancels in
      // 1 min" about an order that is already gone. Stop a little early.
      if (remindAt >= deadline - 15_000) return;

      await sleep(Math.max(0, remindAt - Date.now()));

      const current = await getOrder(orderId);
      if (!current || current.status !== ORDER_STATUS.PLACED) return;

      await notifyVendorNewOrder({
        order: current,
        secondsToAccept: (deadline - Date.now()) / 1_000,
        reminder,
      });
    }
  } catch (error: unknown) {
    // Never allowed to surface: the order is already placed, and the board
    // and the in-console alarm still carry it.
    console.error("[vendor-alerts] new-order alert driver failed:", error);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
