import { NextResponse } from "next/server";

import { isAuthorisedCron, unauthorisedCron } from "@/server/cron-guard";
import { abandonStalePayments } from "@/server/services/sweeps";

/**
 * F1/F2 — every minute.
 *
 * Half of this job exists today: an order that never confirmed is closed after
 * the abandon window so it stops sitting in a student's history as a live
 * order that will never move. The other half — asking Razorpay whether a
 * payment actually captured — arrives with the Razorpay provider in Phase 9,
 * behind the same seam, and must share this code path so that whichever of the
 * webhook and the cron wins the race, the order is promoted exactly once.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorisedCron(request)) return unauthorisedCron();
  return NextResponse.json(await abandonStalePayments());
}
