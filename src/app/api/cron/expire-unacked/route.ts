import { NextResponse } from "next/server";

import { isAuthorisedCron, unauthorisedCron } from "@/server/cron-guard";
import { expireUnackedOrders } from "@/server/services/sweeps";

/** F4 — every minute. Four minutes of vendor silence auto-cancels and refunds. */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorisedCron(request)) return unauthorisedCron();
  return NextResponse.json(await expireUnackedOrders());
}
