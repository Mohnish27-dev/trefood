import { NextResponse } from "next/server";

import { isAuthorisedCron, unauthorisedCron } from "@/server/cron-guard";
import { listAllCampuses } from "@/server/services/admin";
import { runSettlement } from "@/server/services/settlement";
import { resetDailyExpiryCounts } from "@/server/services/sweeps";
import { campusDateString } from "@/lib/campus-time";

/**
 * The nightly run, at 23:59 campus-local time.
 *
 * Idempotent by construction (F15): the unique index on
 * `(restaurantId, settlementDate)` makes a second run a no-op rather than a
 * second payout, so retrying this route is always safe.
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
    const settlementDate = date ?? campusDateString(new Date(), campus.timezone);
    const result = await runSettlement({ campus, settlementDate });

    // The F4 counter is a per-day vendor-health signal, so it resets with the
    // day it counts. Only on a live run: re-settling last Tuesday must not
    // clear a restaurant's expiries for today.
    const expiriesReset =
      date === null ? await resetDailyExpiryCounts(campus._id) : 0;

    runs.push({
      campus: campus.slug,
      settlementDate: result.settlementDate,
      written: result.written.length,
      skipped: result.skipped.length,
      ordersSettled: result.ordersSettled,
      expiriesReset,
    });
  }

  return NextResponse.json({ runs });
}
