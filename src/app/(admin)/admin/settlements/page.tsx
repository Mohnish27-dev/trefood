import type { Metadata } from "next";

import {
  SettlementTable,
  type CampusOption,
  type StatementRow,
} from "@/components/admin/settlement-table";
import { requireAdmin } from "@/server/auth/session";
import { listAllCampuses, listVendors } from "@/server/services/admin";
import { listStatements, previewUnbilled } from "@/server/services/settlement";
import { campusDateString, shiftCampusDate } from "@/lib/campus-time";
import type { Restaurant } from "@/types/restaurant";

export const metadata: Metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string; date?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const campuses = await listAllCampuses();

  // Everything on this screen is one campus and one day, both held in the URL
  // so that picking either actually reloads the rows. They used to live only
  // in client state, which left the table showing one day while the date box
  // and the Run button pointed at another.
  const campus = campuses.find((row) => row._id === params.campus) ?? campuses[0];

  const campusOptions: CampusOption[] = campuses.map((row) => ({
    campusId: row._id,
    name: row.name,
  }));

  if (!campus) {
    return (
      <>
        <Header />
        <SettlementTable
          rows={[]}
          campuses={campusOptions}
          selectedCampusId=""
          selectedDate=""
          todayDate=""
        />
      </>
    );
  }

  // Campus-local, never the server's clock: on a UTC host "today" would end at
  // 18:30 IST. The default is YESTERDAY — the day whose commission the vendors
  // hand over this morning, and the latest day that can actually be invoiced.
  const todayDate = campusDateString(new Date(), campus.timezone);
  const requested = params.date !== undefined && ISO_DAY.test(params.date) ? params.date : null;
  const statementDate =
    requested !== null && requested <= todayDate ? requested : shiftCampusDate(todayDate, -1);

  const [statements, vendors, unbilled] = await Promise.all([
    listStatements({ statementDate, campusId: campus._id }),
    listVendors({ campusId: campus._id }),
    previewUnbilled({ campus, statementDate }),
  ]);
  const vendorById = new Map(vendors.map((vendor) => [vendor._id, vendor]));
  const invoiced = new Set(statements.map((statement) => statement.restaurantId));

  const rows: StatementRow[] = statements.map((statement) => ({
    kind: "STATEMENT",
    statementId: statement._id,
    restaurantId: statement.restaurantId,
    restaurantName: vendorById.get(statement.restaurantId)?.name ?? "Unknown restaurant",
    contactPhone: phoneFor(vendorById.get(statement.restaurantId)),
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
  }));

  // Every vendor without a statement for the day still gets a row, carrying
  // the live figures a run would bill. An un-run day used to render as a blank
  // screen, which is indistinguishable from a day with no business at all.
  for (const vendor of vendors) {
    if (invoiced.has(vendor._id)) continue;
    const live = unbilled.get(vendor._id);

    rows.push({
      kind: "PREVIEW",
      statementId: null,
      restaurantId: vendor._id,
      restaurantName: vendor.name,
      contactPhone: phoneFor(vendor),
      cashCollectedPaise: live?.cashCollectedPaise ?? 0,
      commissionDuePaise: live?.commissionDuePaise ?? 0,
      adjustmentsPaise: 0,
      openingBalancePaise: 0,
      netDuePaise: 0,
      carriedForwardPaise: 0,
      orderCount: live?.orderCount ?? 0,
      status: "PENDING",
      collectionMethod: null,
      paymentReference: null,
    });
  }

  // Money still to chase first, then the busiest kitchens.
  rows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.netDuePaise - a.netDuePaise ||
      b.cashCollectedPaise - a.cashCollectedPaise ||
      a.restaurantName.localeCompare(b.restaurantName),
  );

  return (
    <>
      <Header />
      <SettlementTable
        rows={rows}
        campuses={campusOptions}
        selectedCampusId={campus._id}
        selectedDate={statementDate}
        todayDate={todayDate}
      />
    </>
  );
}

function Header() {
  return (
    <header className="mb-5">
      <h1 className="font-display text-xl font-semibold text-bone">Collections</h1>
      <p className="mt-1 text-sm text-muted">
        Pick a day to see what each restaurant collected in cash and the commission they owe
        TREFOOD on it. Mark a row collected when the money comes in.
      </p>
    </header>
  );
}

/** A phone number, not bank details: the money comes to us, so the admin needs a way to chase it. */
function phoneFor(vendor: Restaurant | undefined): string {
  return vendor?.kyc?.ownerPhone ?? vendor?.phone ?? "";
}

function rank(row: StatementRow): number {
  if (row.kind === "STATEMENT" && row.status === "PENDING" && row.netDuePaise > 0) return 0;
  if (row.kind === "PREVIEW" && row.orderCount > 0) return 1;
  if (row.kind === "STATEMENT" && row.status === "PAID") return 2;
  return 3;
}
