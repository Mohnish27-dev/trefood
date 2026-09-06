import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { zoneCookieName } from "@/lib/cookies";
import { buildCampusSearchIndex, getCampusBySlug } from "@/server/services/catalog";

/**
 * The autocomplete index for one campus, scoped to the student's gate.
 *
 * Fetched ONCE per session by the search bar and filtered in the browser
 * afterwards, rather than queried per keystroke. A campus is a few hundred
 * dishes, which is small enough to rank client-side in under a millisecond —
 * and that is the only way "type b, see Biryani" can feel instant on hostel
 * wifi. Zone comes from the cookie, never the query string, so a student
 * cannot autocomplete dishes that will not reach their gate.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const campusSlug = new URL(request.url).searchParams.get("campus");
  if (!campusSlug) {
    return NextResponse.json({ error: "campus is required" }, { status: 400 });
  }

  const campus = await getCampusBySlug(campusSlug);
  if (!campus) {
    return NextResponse.json({ error: "Unknown campus" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const storedZoneId = cookieStore.get(zoneCookieName(campusSlug))?.value ?? null;
  const zoneId = campus.zones.find((z) => z.id === storedZoneId)?.id ?? null;

  const index = await buildCampusSearchIndex(campus, zoneId);

  return NextResponse.json(index, {
    // Private: the payload depends on the caller's zone cookie.
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
