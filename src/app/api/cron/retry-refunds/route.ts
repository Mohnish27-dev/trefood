import { NextResponse } from "next/server";

import { isAuthorisedCron, unauthorisedCron } from "@/server/cron-guard";
import { retryFailedRefunds } from "@/server/services/sweeps";

/** F16 — every 15 minutes. Three attempts with backoff, then an admin alert. */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorisedCron(request)) return unauthorisedCron();
  return NextResponse.json(await retryFailedRefunds());
}
