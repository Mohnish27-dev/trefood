import { NextResponse } from "next/server";

import { pingDb } from "@/server/db/client";

/**
 * Liveness probe. Never cached — a health check served from a cache is not a health
 * check. docs/PHASES.md Phase 0 exit gate.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const db = await pingDb();
    return NextResponse.json(
      {
        ok: true,
        service: "trefood",
        db,
        at: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    // Health checks report the failure; they never mask it behind a 200.
    return NextResponse.json(
      {
        ok: false,
        service: "trefood",
        error: error instanceof Error ? error.message : "Unknown database error",
        at: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
