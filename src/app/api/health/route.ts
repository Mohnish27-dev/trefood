import { NextResponse } from "next/server";

import { pingDb } from "@/server/db/client";

// Health must reflect this instant, never a cached response.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const db = await pingDb();
    return NextResponse.json({
      status: "ok",
      db: "ok",
      roundTripMs: db.roundTripMs,
      at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ status: "degraded", db: "unreachable", message }, { status: 503 });
  }
}
