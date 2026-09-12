import type { Metadata } from "next";

import {
  EarningsDashboard,
  type DashboardCampus,
} from "@/components/admin/earnings-dashboard";
import { requireAdmin } from "@/server/auth/session";
import { listAllCampuses } from "@/server/services/admin";
import { datesOfMonth, getEarningsAnalytics } from "@/server/services/analytics";
import { getDailyVendorReport, isIsoDay } from "@/server/services/daily-vendor-report";

export const metadata: Metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

/**
 * The money overview: what was sold, what we earned on it, what has come in.
 *
 * Read-only by construction. Running a settlement and stamping a statement as
 * collected both live on `/admin/settlements`, and they stay there — this page
 * imports no action and can move no money. An analytics screen that can also
 * mutate is a screen where somebody eventually mutates by accident while
 * trying to filter.
 *
 * `?campus=` scopes to one campus, `?month=YYYY-MM` picks the month and
 * `?day=YYYY-MM-DD` picks the day the vendor report covers. All are absent by
 * default, which means every campus, the current month, and today.
 */
export default async function AdminEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string; month?: string; day?: string }>;
}) {
  await requireAdmin();

  const { campus, month, day } = await searchParams;
  const allCampuses = await listAllCampuses();

  // An unknown or stale campus id falls back to every campus rather than
  // rendering an empty dashboard that looks like a business with no orders.
  const scoped = allCampuses.filter((row) => row._id === campus);
  const campuses = scoped.length > 0 ? scoped : allCampuses;
  const selectedCampusId = scoped.length > 0 ? campus ?? "" : "";

  const analytics = await getEarningsAnalytics({
    campuses,
    // Anything that is not a real "YYYY-MM" is dropped, so a hand-edited URL
    // cannot reach the date arithmetic.
    ...(month !== undefined && /^\d{4}-\d{2}$/.test(month) ? { month } : {}),
  });

  const reportDay = isIsoDay(day) ? day : defaultReportDay(analytics.month, analytics.todayDate);

  const dailyReport = await getDailyVendorReport({
    campuses,
    from: reportDay,
    to: reportDay,
    includeIdle: true,
  });

  const campusOptions: DashboardCampus[] = allCampuses.map((row) => ({
    campusId: row._id,
    name: row.name,
  }));

  return (
    <EarningsDashboard
      {...analytics}
      reportDay={reportDay}
      dailyReport={dailyReport}
      campuses={campusOptions}
      selectedCampusId={selectedCampusId}
    />
  );
}

/**
 * Today when the month being viewed contains it, otherwise the nearest day of
 * that month to today: its last day for a past month, its first for a future one.
 */
function defaultReportDay(month: string, todayDate: string): string {
  const days = datesOfMonth(month);
  if (todayDate.startsWith(month)) return todayDate;
  return (month < todayDate ? days.at(-1) : days[0]) ?? todayDate;
}
