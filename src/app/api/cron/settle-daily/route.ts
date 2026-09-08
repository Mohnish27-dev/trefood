import { NextResponse } from "next/server";

import { isAuthorisedCron, unauthorisedCron } from "@/server/cron-guard";
import { listAllCampuses } from "@/server/services/admin";
import { runSettlement } from "@/server/services/settlement";
import { resetDailyExpiryCounts } from "@/server/services/sweeps";
import { campusDateString } from "@/lib/campus-time";

/**
 * The nightly run, at 23:59 campus-local time.
 *
 * It writes one commission statement per vendor — what they owe TREFOOD for
 * the day's deliveries — and closes the orders on it. Nothing is paid out:
 * the vendors are holding the cash and we are invoicing them for our share.
 *
 * Idempotent by construction (F15): the unique index on
 * `(restaurantId, statementDate)` makes a second run a no-op rather than a
 * second invoice, so retrying this route is always safe.
 *
 * `?date=YYYY-MM-DD` re-runs a specific campus-local day, which is what you
 * reach for when a night was missed.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorisedCron(request)) return unauthorisedCron();

  const date = new URL(request.url).searchParams.get("date");
  const campuses = await listAllCampuses();

  const runs = [];
  for (const campus of campuses) {
    const statementDate = date ?? campusDateString(new Date(), campus.timezone);
    const result = await runSettlement({ campus, statementDate });

    // The F4 counter is a per-day vendor-health signal, so it resets with the
    // day it counts. Only on a live run: re-settling last Tuesday must not
    // clear a restaurant's expiries for today.
    const expiriesReset =
      date === null ? await resetDailyExpiryCounts(campus._id) : 0;

    runs.push({
      campus: campus.slug,
      statementDate: result.statementDate,
      written: result.written.length,
      skipped: result.skipped.length,
      ordersSettled: result.ordersSettled,
      expiriesReset,
    });
  }

  return NextResponse.json({ runs });
}
