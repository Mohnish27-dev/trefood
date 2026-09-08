import type { Metadata } from "next";

import {
  SettlementTable,
  type CampusOption,
  type StatementRow,
} from "@/components/admin/settlement-table";
import { requireAdmin } from "@/server/auth/session";
import { listAllCampuses, listVendors } from "@/server/services/admin";
import { listStatements } from "@/server/services/settlement";
import { campusDateString } from "@/lib/campus-time";

export const metadata: Metadata = { title: "Collections" };
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
  const statementDate = date ?? campusDateString(new Date(), primaryTimezone);

  const [statements, vendors] = await Promise.all([
    listStatements({ statementDate }),
    listVendors({}),
  ]);
  const vendorById = new Map(vendors.map((vendor) => [vendor._id, vendor]));

  const rows: StatementRow[] = statements.map((statement) => {
    const vendor = vendorById.get(statement.restaurantId);

    return {
      statementId: statement._id,
      statementDate: statement.statementDate,
      restaurantName: vendor?.name ?? "Unknown restaurant",
      // A phone number, not bank details: the money comes to us now, so what
      // an admin needs on this screen is a way to chase it.
      contactPhone: vendor?.kyc?.ownerPhone ?? vendor?.phone ?? "",
      cashCollectedPaise: statement.cashCollectedPaise,
      commissionDuePaise: statement.commissionDuePaise,
      adjustmentsPaise: statement.adjustmentsPaise,
      openingBalancePaise: statement.openingBalancePaise,
      netDuePaise: statement.netDuePaise,
      carriedForwardPaise: statement.carriedForwardPaise,
      orderCount: statement.orderCount,
      status: statement.status,
      collectionMethod: statement.collectionMethod,
      paymentReference: statement.paymentReference,
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
        <h1 className="font-display text-xl font-semibold text-bone">Collections</h1>
        <p className="mt-1 text-sm text-muted">
          One immutable statement per vendor per day: the commission they owe TREFOOD on what
          they delivered. The invoice is generated from it and never recomputed.
        </p>
      </header>

      <SettlementTable rows={rows} campuses={campusOptions} selectedDate={statementDate} />
    </>
  );
}
