import { NextResponse } from "next/server";

import { isAuthorisedCron, unauthorisedCron } from "@/server/cron-guard";
import { closeStaleGates } from "@/server/services/sweeps";

/** F7/F8/F10 — every minute. Fifteen minutes at the gate, then the paths diverge. */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorisedCron(request)) return unauthorisedCron();
  return NextResponse.json(await closeStaleGates());
}
