import "server-only";

import * as db from "@/server/db/collections";
import { ORDER_STATUS } from "@/lib/constants";
import { campusDayRange } from "@/lib/campus-time";
import { formatINRPlain, bpsToPct, type Bps, type Paise } from "@/lib/money";
import type { Campus } from "@/types/campus";
import type { CommissionStatement } from "@/types/finance";

/**
 * The daily vendor report: one row per vendor per campus-local day.
 *
 * ★ MONEY FLOWS VENDOR -> TREFOOD. NOTHING HERE IS A PAYOUT. ★
 *
 * It answers, for a single day, the four questions an admin asks when working
 * down the vendor list:
 *
 *   1. How many orders did they take?     — orders PLACED that day
 *   2. How much did they make?            — bills on orders DELIVERED that day
 *   3. What commission do they owe us?    — commission on those deliveries
 *   4. What have they handed over?        — that day's statement, and its status
 *
 * Orders taken are dated by `placedAt` (the moment the order reached the
 * vendor) and money by `deliveredAt` (the moment it was earned), because that
 * is how the dashboard and the nightly statement date them too. An order placed
 * at 23:55 and delivered at 00:10 therefore counts as taken on one day and
 * earned on the next — deliberately, so this file always agrees with the
 * statement the vendor is actually invoiced on.
 *
 * Read-only. Nothing in this file writes.
 */

/** The longest range one export may cover. A quarter of rows is a database scan, not a report. */
export const MAX_REPORT_DAYS = 62;

export interface DailyVendorStatement {
  orderCount: number;
  commissionDuePaise: Paise;
  adjustmentsPaise: number;
  openingBalancePaise: number;
  netDuePaise: number;
  carriedForwardPaise: number;
  status: CommissionStatement["status"];
  /** ISO instant. */
  paidAt: string | null;
  collectionMethod: CommissionStatement["collectionMethod"];
  paymentReference: string | null;
}

export interface DailyVendorRow {
  /** Campus-local "YYYY-MM-DD". */
  date: string;
  restaurantId: string;
  name: string;
  campusName: string;
  phone: string;
  commissionBps: Bps;

  /** Orders that reached the vendor this day, whatever became of them. */
  ordersTaken: number;
  /** Of those, the ones that ended without food changing hands. */
  ordersCancelled: number;
  /** Delivered this day. The count every money figure below is summed over. */
  ordersDelivered: number;

  /** What students were billed on today's deliveries. What the vendor made. */
  billedPaise: Paise;
  /** What delivery staff recorded taking at the gate. Reconciliation only. */
  cashCollectedPaise: Paise;
  /** Vendor-absorbed coupon spend. */
  discountPaise: Paise;
  /** What the vendor owes TREFOOD on today's deliveries. */
  commissionPaise: Paise;
  /** Billed minus commission: what the vendor keeps once they have paid us. */
  vendorKeepsPaise: number;

  /** Null until the nightly run writes one for this vendor and day. */
  statement: DailyVendorStatement | null;
  /** Net due on a PAID statement. What the vendor actually handed over. */
  submittedPaise: number;
  /** Net due on a PENDING statement. What is still to chase. */
  balancePaise: number;
}

export async function getDailyVendorReport(params: {
  campuses: Campus[];
  /** Inclusive, campus-local "YYYY-MM-DD". */
  from: string;
  /** Inclusive, campus-local "YYYY-MM-DD". */
  to: string;
  /**
   * Keep vendors with nothing on a day. Right for a one-day screen, where a
   * missing vendor looks like a missing row; wrong for a month export, where
   * it buries thirty days of activity under thirty days of zeros.
   */
  includeIdle: boolean;
}): Promise<DailyVendorRow[]> {
  const dates = datesBetween(params.from, params.to);
  const campusIds = params.campuses.map((campus) => campus._id);

  const [restaurants, taken, delivered, statements] = await Promise.all([
    restaurantIndex(params.campuses),
    Promise.all(params.campuses.map((campus) => collectTaken(campus, params.from, params.to))),
    Promise.all(params.campuses.map((campus) => collectDelivered(campus, params.from, params.to))),
    (await db.commissionStatements())
      .find({
        campusId: { $in: campusIds },
        statementDate: { $gte: params.from, $lte: params.to },
      })
      .toArray(),
  ]);

  const takenByKey = mergeRows(taken.flat());
  const deliveredByKey = mergeRows(delivered.flat());
  const statementByKey = new Map(
    statements.map((row) => [key(row.restaurantId, row.statementDate), row]),
  );

  const rows: DailyVendorRow[] = [];

  for (const date of dates) {
    for (const restaurant of restaurants) {
      const k = key(restaurant.restaurantId, date);
      const takenRow = takenByKey.get(k);
      const deliveredRow = deliveredByKey.get(k);
      const statement = statementByKey.get(k);

      // The nightly run writes a statement for every vendor every day, most of
      // them all zeros, so a statement alone does not make a day active.
      if (!params.includeIdle && !takenRow && !deliveredRow && !statementHasMoney(statement)) {
        continue;
      }

      const billedPaise = deliveredRow?.billedPaise ?? 0;
      const commissionPaise = deliveredRow?.commissionPaise ?? 0;

      rows.push({
        date,
        ...restaurant,
        ordersTaken: takenRow?.orderCount ?? 0,
        ordersCancelled: takenRow?.cancelledCount ?? 0,
        ordersDelivered: deliveredRow?.orderCount ?? 0,
        billedPaise,
        cashCollectedPaise: deliveredRow?.cashCollectedPaise ?? 0,
        discountPaise: deliveredRow?.discountPaise ?? 0,
        commissionPaise,
        vendorKeepsPaise: billedPaise - commissionPaise,
        statement: statement
          ? {
              orderCount: statement.orderCount,
              commissionDuePaise: statement.commissionDuePaise,
              adjustmentsPaise: statement.adjustmentsPaise,
              openingBalancePaise: statement.openingBalancePaise,
              netDuePaise: statement.netDuePaise,
              carriedForwardPaise: statement.carriedForwardPaise,
              status: statement.status,
              paidAt: statement.paidAt?.toISOString() ?? null,
              collectionMethod: statement.collectionMethod,
              paymentReference: statement.paymentReference,
            }
          : null,
        submittedPaise: statement?.status === "PAID" ? statement.netDuePaise : 0,
        balancePaise: statement?.status === "PENDING" ? statement.netDuePaise : 0,
      });
    }
  }

  // Newest day first, and within a day the biggest earner first — the top of
  // the sheet is where the money is. Ties break by name so rows never jitter.
  return rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.commissionPaise - a.commissionPaise ||
      b.ordersTaken - a.ordersTaken ||
      a.name.localeCompare(b.name),
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Aggregations — one pass per campus, because `$dateToString` takes a
   single timezone and two campuses can sit in two of them.
   ══════════════════════════════════════════════════════════════════════ */

interface DayRow {
  restaurantId: string;
  date: string;
  orderCount: number;
  cancelledCount: number;
  billedPaise: number;
  cashCollectedPaise: number;
  discountPaise: number;
  commissionPaise: number;
}

const CANCELLED_STATUSES = [
  ORDER_STATUS.REJECTED_BY_VENDOR,
  ORDER_STATUS.EXPIRED_NO_ACK,
  ORDER_STATUS.CANCELLED_BY_ADMIN,
  ORDER_STATUS.CANCELLED_BY_STUDENT,
  ORDER_STATUS.NO_SHOW,
];

/** Orders that reached the vendor, by campus-local day of `placedAt`. */
async function collectTaken(campus: Campus, from: string, to: string): Promise<DayRow[]> {
  return aggregateByDay(campus, from, to, "timestamps.placedAt", {});
}

/** Delivered money, by campus-local day of `deliveredAt`. */
async function collectDelivered(campus: Campus, from: string, to: string): Promise<DayRow[]> {
  return aggregateByDay(campus, from, to, "timestamps.deliveredAt", {
    // SETTLED as well as DELIVERED: an invoiced order is still a delivered one.
    status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.SETTLED] },
  });
}

async function aggregateByDay(
  campus: Campus,
  from: string,
  to: string,
  dateField: "timestamps.placedAt" | "timestamps.deliveredAt",
  extraMatch: Record<string, unknown>,
): Promise<DayRow[]> {
  const start = campusDayRange(from, campus.timezone).start;
  const end = campusDayRange(to, campus.timezone).end;

  interface Row extends Omit<DayRow, "restaurantId" | "date"> {
    _id: { restaurantId: string; date: string };
  }

  const rows = await (await db.orders())
    .aggregate<Row>([
      {
        $match: {
          campusId: campus._id,
          [dateField]: { $gte: start, $lt: end },
          ...extraMatch,
        },
      },
      {
        $group: {
          _id: {
            restaurantId: "$restaurantId",
            date: {
              $dateToString: {
                date: `$${dateField}`,
                format: "%Y-%m-%d",
                // The campus's midnight, never the server's UTC one.
                timezone: campus.timezone,
              },
            },
          },
          orderCount: { $sum: 1 },
          cancelledCount: {
            $sum: { $cond: [{ $in: ["$status", CANCELLED_STATUSES] }, 1, 0] },
          },
          billedPaise: { $sum: "$pricing.grandTotalPaise" },
          cashCollectedPaise: { $sum: "$payment.cashCollectedPaise" },
          discountPaise: { $sum: "$pricing.discountPaise" },
          commissionPaise: { $sum: "$pricing.platformCommissionPaise" },
        },
      },
    ])
    .toArray();

  return rows.map(({ _id, ...rest }) => ({ ...rest, ..._id }));
}

/** Name, campus, contact and effective commission rate for every vendor in scope. */
async function restaurantIndex(
  campuses: Campus[],
): Promise<
  { restaurantId: string; name: string; campusName: string; phone: string; commissionBps: Bps }[]
> {
  const campusById = new Map(campuses.map((campus) => [campus._id, campus]));
  const restaurants = await (await db.restaurants())
    .find({ campusId: { $in: [...campusById.keys()] } })
    .sort({ name: 1 })
    .toArray();

  return restaurants.map((restaurant) => {
    const campus = campusById.get(restaurant.campusId);
    return {
      restaurantId: restaurant._id,
      name: restaurant.name,
      campusName: campus?.name ?? "Unknown campus",
      // A number to chase the money on: the owner first, then the shop.
      phone: restaurant.kyc?.ownerPhone || restaurant.phone || "",
      // Mirrors pricing: the override wins, the campus rate is the default.
      commissionBps: restaurant.commissionBpsOverride ?? campus?.settings.commissionBps ?? 0,
    };
  });
}

function statementHasMoney(statement: CommissionStatement | undefined): boolean {
  return (
    statement !== undefined &&
    (statement.orderCount > 0 ||
      statement.netDuePaise !== 0 ||
      statement.adjustmentsPaise !== 0 ||
      statement.openingBalancePaise !== 0 ||
      statement.carriedForwardPaise !== 0)
  );
}

function key(restaurantId: string, date: string): string {
  return `${restaurantId}|${date}`;
}

/** Summed rather than set, so a restaurant spanning campuses would still add up. */
function mergeRows(rows: readonly DayRow[]): Map<string, DayRow> {
  const out = new Map<string, DayRow>();
  for (const row of rows) {
    const k = key(row.restaurantId, row.date);
    const existing = out.get(k);
    out.set(
      k,
      existing
        ? {
            ...existing,
            orderCount: existing.orderCount + row.orderCount,
            cancelledCount: existing.cancelledCount + row.cancelledCount,
            billedPaise: existing.billedPaise + row.billedPaise,
            cashCollectedPaise: existing.cashCollectedPaise + row.cashCollectedPaise,
            discountPaise: existing.discountPaise + row.discountPaise,
            commissionPaise: existing.commissionPaise + row.commissionPaise,
          }
        : row,
    );
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════
   Dates — string arithmetic on zero-padded ISO days, never a clock.
   ══════════════════════════════════════════════════════════════════════ */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day, so "2026-02-31" never reaches the date maths. */
export function isIsoDay(value: string | null | undefined): value is string {
  if (!value || !ISO_DAY.test(value)) return false;
  return new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Every day from `from` to `to`, inclusive, oldest first. */
export function datesBetween(from: string, to: string): string[] {
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  const count = Math.floor((end - start) / 86_400_000) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CSV
   ══════════════════════════════════════════════════════════════════════ */

/**
 * The daily vendor report as a spreadsheet.
 *
 * Plain rupee decimals with no symbol and no grouping, the same shape as the
 * collections CSV, so the two files add up in the same column of one sheet.
 */
export function dailyVendorReportToCsv(rows: readonly DailyVendorRow[]): string {
  const header = [
    "date",
    "campus",
    "vendor",
    "phone",
    "commissionPct",
    "ordersTaken",
    "ordersCancelled",
    "ordersDelivered",
    "billed",
    "cashRecorded",
    "discount",
    "commissionEarned",
    "vendorKeeps",
    "statementOrders",
    "statementCommissionDue",
    "adjustments",
    "openingBalance",
    "netDue",
    "carriedForward",
    "status",
    "submitted",
    "stillOwed",
    "paidAt",
    "collectedVia",
    "reference",
  ].join(",");

  const lines = rows.map((row) =>
    [
      row.date,
      csvCell(row.campusName),
      csvCell(row.name),
      csvCell(row.phone),
      String(bpsToPct(row.commissionBps)),
      String(row.ordersTaken),
      String(row.ordersCancelled),
      String(row.ordersDelivered),
      rupees(row.billedPaise),
      rupees(row.cashCollectedPaise),
      rupees(row.discountPaise),
      rupees(row.commissionPaise),
      rupees(row.vendorKeepsPaise),
      row.statement ? String(row.statement.orderCount) : "",
      row.statement ? rupees(row.statement.commissionDuePaise) : "",
      row.statement ? rupees(row.statement.adjustmentsPaise) : "",
      row.statement ? rupees(row.statement.openingBalancePaise) : "",
      row.statement ? rupees(row.statement.netDuePaise) : "",
      row.statement ? rupees(row.statement.carriedForwardPaise) : "",
      statementStatus(row),
      rupees(row.submittedPaise),
      rupees(row.balancePaise),
      row.statement?.paidAt ?? "",
      csvCell(row.statement?.collectionMethod ?? ""),
      csvCell(row.statement?.paymentReference ?? ""),
    ].join(","),
  );

  return [header, ...lines].join("\r\n");
}

/**
 * PAID, PENDING, NOTHING_DUE or NOT_RUN. A zero-due statement is stored as
 * PENDING, but "pending" beside a zero reads as a debt nobody has chased.
 */
function statementStatus(row: DailyVendorRow): string {
  if (row.statement === null) return "NOT_RUN";
  if (row.statement.status === "PENDING" && row.statement.netDuePaise <= 0) return "NOTHING_DUE";
  return row.statement.status;
}

/** Signed: adjustments and carry-forward are the only columns that go negative. */
function rupees(paise: number): string {
  return paise < 0 ? `-${formatINRPlain(-paise)}` : formatINRPlain(paise);
}

function csvCell(value: string): string {
  // A leading =, +, - or @ turns a vendor name into a spreadsheet formula.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
