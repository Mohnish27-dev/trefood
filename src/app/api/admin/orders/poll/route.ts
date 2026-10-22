import { NextResponse } from "next/server";

import { isFullAdmin } from "@/lib/constants";
import { AuthError, requireStaff } from "@/server/auth/session";
import { getRadar, withoutStudents, type RadarSnapshot } from "@/server/services/admin";

/**
 * The admin live radar poll. Every 10 seconds — slower than the vendor board,
 * because nobody is waiting on this screen to cook anything.
 *
 * It returns every non-terminal order across every campus with the stuck ones
 * ranked first. The healthy orders are context; the stuck ones are the job.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type AdminRadarResponse = RadarSnapshot;

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await requireStaff();

    const campusId = new URL(request.url).searchParams.get("campusId");

    const snapshot = await getRadar(campusId ? { campusId } : {});
    return NextResponse.json(isFullAdmin(session.role) ? snapshot : withoutStudents(snapshot), {
      headers: { "cache-control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "UNAUTHENTICATED" ? 401 : 403 },
      );
    }
    throw error;
  }
}
