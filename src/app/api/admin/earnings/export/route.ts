import { NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/server/auth/session";
import { listAllCampuses } from "@/server/services/admin";
import {
  MAX_REPORT_DAYS,
  dailyVendorReportToCsv,
  datesBetween,
  getDailyVendorReport,
  isIsoDay,
} from "@/server/services/daily-vendor-report";

/**
 * The daily vendor report as a CSV download.
 *
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive, campus-local) and an optional
 * `?campus=`. One row per vendor per day. A single day keeps every vendor, idle
 * ones included, so the sheet doubles as a call list; a longer range keeps only
 * vendor-days with something on them.
 *
 * Read-only, like the earnings page it is exported from.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin();

    const params = new URL(request.url).searchParams;
    const from = params.get("from");
    const to = params.get("to") ?? from;
    const campus = params.get("campus");

    if (!isIsoDay(from) || !isIsoDay(to) || to < from) {
      return NextResponse.json(
        { error: "Pass from and to as real YYYY-MM-DD days, with to on or after from." },
        { status: 400 },
      );
    }
    if (datesBetween(from, to).length > MAX_REPORT_DAYS) {
      return NextResponse.json(
        { error: `A report covers at most ${MAX_REPORT_DAYS} days.` },
        { status: 400 },
      );
    }

    const allCampuses = await listAllCampuses();
    // An unknown campus id falls back to every campus, matching the page.
    const scoped = allCampuses.filter((row) => row._id === campus);
    const campuses = scoped.length > 0 ? scoped : allCampuses;

    const rows = await getDailyVendorReport({
      campuses,
      from,
      to,
      includeIdle: from === to,
    });

    const scopeLabel = scoped[0]?.slug ?? "all-campuses";
    const rangeLabel = from === to ? from : `${from}_to_${to}`;

    // The BOM makes Excel read the file as UTF-8, so a vendor name with a
    // non-ASCII character does not arrive as mojibake.
    return new Response(`﻿${dailyVendorReportToCsv(rows)}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="trefood-vendors-${scopeLabel}-${rangeLabel}.csv"`,
        "cache-control": "no-store, no-cache, must-revalidate",
      },
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
