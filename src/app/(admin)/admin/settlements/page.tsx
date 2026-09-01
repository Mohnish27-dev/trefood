import type { Metadata } from "next";

import {
  SettlementTable,
  type CampusOption,
  type SettlementRow,
} from "@/components/admin/settlement-table";
import { requireAdmin } from "@/server/auth/session";
import { listAllCampuses, listVendors } from "@/server/services/admin";
import { listSettlements } from "@/server/services/settlement";
import { campusDateString } from "@/lib/campus-time";

export const metadata: Metadata = { title: "Settlements" };
export const dynamic = "force-dynamic";

export default async function AdminSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdmin();

  const { date } = await searchParams;
  const campuses = await listAllCampuses();

  // Default to today in the FIRST campus's timezone rather than the server's.
  // On Vercel the server is UTC, which would show the wrong day for every
  // order placed after 18:30 IST — that is, most of them.
  const primaryTimezone = campuses[0]?.timezone ?? "Asia/Kolkata";
  const settlementDate = date ?? campusDateString(new Date(), primaryTimezone);

  const [settlements, vendors] = await Promise.all([
    listSettlements({ settlementDate }),
    listVendors({}),
  ]);
  const vendorById = new Map(vendors.map((vendor) => [vendor._id, vendor]));

  const rows: SettlementRow[] = settlements.map((settlement) => {
    const vendor = vendorById.get(settlement.restaurantId);
    const accountNumber = vendor?.payout.accountNumber ?? "";

    return {
      settlementId: settlement._id,
      settlementDate: settlement.settlementDate,
      restaurantName: vendor?.name ?? "Unknown restaurant",
      // Never the full account number on a listing screen. The CSV carries it
      // because a bank portal needs it; a shoulder-surfable table does not.
      accountLabel: accountNumber
        ? `${vendor?.payout.ifsc ?? ""} ····${accountNumber.slice(-4)}`
        : "No bank details",
      upiId: vendor?.payout.upiId ?? null,
      grossPrepaidPaise: settlement.grossPrepaidPaise,
      adjustmentsPaise: settlement.adjustmentsPaise,
      openingBalancePaise: settlement.openingBalancePaise,
      netPayablePaise: settlement.netPayablePaise,
      carriedForwardPaise: settlement.carriedForwardPaise,
      orderCount: settlement.orderCount,
      codOrderCount: settlement.codOrderCount,
      status: settlement.status,
      utrReference: settlement.utrReference,
    };
  });

  const campusOptions: CampusOption[] = campuses.map((campus) => ({
    campusId: campus._id,
    name: campus.name,
    todayDate: campusDateString(new Date(), campus.timezone),
  }));

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-xl font-semibold text-bone">Settlements</h1>
        <p className="mt-1 text-sm text-muted">
          One immutable statement per vendor per day. The payout is generated from it and never
          recomputed.
        </p>
      </header>

      <SettlementTable rows={rows} campuses={campusOptions} selectedDate={settlementDate} />
    </>
  );
}
