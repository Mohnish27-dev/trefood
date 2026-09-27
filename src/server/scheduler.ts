import "server-only";

import { listAllCampuses } from "@/server/services/admin";
import { runSettlement } from "@/server/services/settlement";
import { resetDailyExpiryCounts, runAllSweeps } from "@/server/services/sweeps";
import { campusDateString, shiftCampusDate } from "@/lib/campus-time";

/**
 * The in-process clock for the `/api/cron/*` jobs.
 *
 * Production is one long-lived container on Lightsail with nothing calling the
 * cron routes, so settlement never ran: delivered orders never became SETTLED
 * (and sat on the live radar forever) and every day showed up on the earnings
 * screen as un-invoiced. This ticks once a minute inside the server instead.
 *
 * Every job here is idempotent — the sweeps act only on orders whose timer has
 * fired, and a settlement is unique on `(restaurantId, statementDate)` — so a
 * second instance, a restart, or an external cron hitting the same routes can
 * only ever repeat a no-op.
 */

const TICK_MS = 60_000;

/** Campus id → the campus-local day whose close has already been handled. */
const closedDayByCampus = new Map<string, string>();

let started = false;
let running = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  void tick();
  setInterval(() => void tick(), TICK_MS).unref();
}

async function tick(): Promise<void> {
  // A slow Atlas round-trip must not stack ticks on top of each other.
  if (running) return;
  running = true;
  try {
    await runAllSweeps();
    await closeFinishedDays();
  } catch (error: unknown) {
    console.error("[scheduler] tick failed", error);
  } finally {
    running = false;
  }
}

/**
 * Once per campus-local day, invoice YESTERDAY.
 *
 * Yesterday rather than "today at 23:59": the day is over, so nothing can land
 * after the cutoff. A run bills every delivered order up to the end of its day,
 * so after downtime the first tick sweeps up the whole backlog in one go.
 */
async function closeFinishedDays(): Promise<void> {
  const campuses = await listAllCampuses();
  const now = new Date();

  for (const campus of campuses) {
    const today = campusDateString(now, campus.timezone);
    const lastClosed = closedDayByCampus.get(campus._id);
    if (lastClosed === today) continue;

    const yesterday = shiftCampusDate(today, -1);
    try {
      const result = await runSettlement({ campus, statementDate: yesterday });
      // Only on a real midnight rollover. The first tick after a restart is
      // mid-day as often as not, and must not wipe today's F4 counts.
      if (lastClosed !== undefined) await resetDailyExpiryCounts(campus._id);
      closedDayByCampus.set(campus._id, today);

      if (result.written.length > 0 || result.ordersSettled > 0) {
        console.info(
          `[scheduler] ${campus.slug} ${yesterday}: ${result.written.length} statement(s), ` +
            `${result.ordersSettled} order(s) settled`,
        );
      }
    } catch (error: unknown) {
      // Left unmarked, so the next tick retries this campus.
      console.error(`[scheduler] settlement failed for ${campus.slug} ${yesterday}`, error);
    }
  }
}
