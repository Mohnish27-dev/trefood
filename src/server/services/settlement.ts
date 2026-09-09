import "server-only";

import * as db from "@/server/db/collections";
import { newId } from "@/lib/ids";
import { campusDateString, campusDayRange } from "@/lib/campus-time";
import { formatINRPlain, type Paise } from "@/lib/money";
import { ACTOR, ORDER_STATUS } from "@/lib/constants";
import { ledgerEntriesForDay, sumLedger } from "./ledger";
import { transitionOrder } from "./orders";
import { writeAudit } from "./audit";
import type { Campus } from "@/types/campus";
import type { Restaurant } from "@/types/restaurant";
import type { CommissionStatement } from "@/types/finance";

/**
 * The nightly commission run. MONEY_AND_SETTLEMENT.md section 6.
 *
 *   cashCollected  = SUM(cash actually taken at the gate) -- context, not owed
 *   commissionDue  = SUM(platformCommission) for every DELIVERED order not
 *                    yet invoiced as of the end of this day
 *   adjustments    = SUM(ledger entries for the day)      -- signed, see finance.ts
 *   netDue         = commissionDue + adjustments + openingBalance
 *
 * ★ THIS RUN COLLECTS. IT DOES NOT PAY OUT. ★
 *
 * Every order is cash on delivery, so the vendor's own delivery staff came
 * back from every gate holding the full bill. TREFOOD never touches that
 * money. What this file produces is an invoice: the commission the vendor owes
 * us for the day, which they hand over the next morning.
 *
 * Four properties this file exists to guarantee:
 *
 *   1. Only DELIVERED orders count, and each one counts exactly once. A
 *      rejection, an expiry, a cancellation or a no-show means no food changed
 *      hands and no cash was collected, so there is no commission to charge on
 *      it. Charging one would be billing a vendor for a sale they never made.
 *      Billing is bounded by STATUS, not by date: an invoiced order moves to
 *      SETTLED and can never be picked up again, so an order delivered too
 *      late for its own run lands on the next one instead of vanishing.
 *   2. The run is idempotent (F15). The unique index on
 *      `(restaurantId, statementDate)` makes a second run a no-op rather than
 *      a second invoice.
 *   3. A negative net carries forward as an opening credit. We never claw back
 *      money a vendor has already handed over; it comes off tomorrow instead.
 *   4. The statement is immutable once written. The invoice is generated FROM
 *      it, never recomputed — so a menu edit next week cannot quietly change
 *      what a vendor was billed last night.
 */

/**
 * Rule 3 — a due below this rolls forward rather than being chased.
 *
 * Sending someone to collect forty rupees costs more than forty rupees. It is
 * added to tomorrow's invoice instead, and the vendor sees it as an opening
 * balance rather than as a debt that vanished.
 */
export const COLLECTION_FLOOR_PAISE: Paise = 10_000;

/** Only a delivered order carries commission. Nothing else was ever paid for. */
const BILLABLE_STATUSES = [ORDER_STATUS.DELIVERED] as const;

export interface StatementRunResult {
  statementDate: string;
  written: CommissionStatement[];
  /** Restaurants whose day was already invoiced. Proof the run is idempotent. */
  skipped: string[];
  ordersSettled: number;
}

/**
 * Refused because the day has not happened yet. See the guard in
 * `runSettlement` — this is an operator mistake, not a system failure.
 */
export class FutureStatementDateError extends Error {
  constructor(statementDate: string, today: string) {
    super(
      `Cannot invoice ${statementDate}: it is after ${today} in this campus. ` +
        `A statement covers a day that has finished.`,
    );
    this.name = "FutureStatementDateError";
  }
}

export async function runSettlement(params: {
  campus: Campus;
  /** Campus-local "YYYY-MM-DD". Defaults to today in the campus timezone. */
  statementDate?: string;
  actorId?: string | null;
}): Promise<StatementRunResult> {
  const today = campusDateString(new Date(), params.campus.timezone);
  const statementDate = params.statementDate ?? today;

  // ★ A statement may never be dated in the future. ★
  //
  // This is a real business rule — you cannot invoice a day that has not
  // finished — but it earns its place as a SAFETY RAIL. The order sweep below
  // is bounded above by the end of the statement day and nothing else, so a
  // run dated 2099 would bill every delivered order this platform has ever
  // taken onto a single statement and close all of them. One mistyped year in
  // the date box on the collections screen would do it, silently and
  // irreversibly, because a settled order can never be billed again.
  //
  // Lexicographic comparison is exact here: both sides are zero-padded ISO
  // days produced by the same function.
  if (statementDate > today) {
    throw new FutureStatementDateError(statementDate, today);
  }

  const { start, end } = campusDayRange(statementDate, params.campus.timezone);

  const [orders, statements, restaurants] = await Promise.all([
    db.orders(),
    db.commissionStatements(),
    db.restaurants(),
  ]);

  const vendors = await restaurants.find({ campusId: params.campus._id }).toArray();
  const existingStatements = await statements
    .find({ campusId: params.campus._id, statementDate })
    .toArray();
  const existingRestaurantIds = new Set(existingStatements.map((s) => s.restaurantId));

  const written: CommissionStatement[] = [];
  const skipped: string[] = [];
  let ordersSettled = 0;

  const results = await Promise.all(
    vendors.map(async (restaurant) => {
      if (existingRestaurantIds.has(restaurant._id)) {
        return { skipped: restaurant._id, written: null, ordersSettled: 0 };
      }

      // Everything delivered up to the END of this day and not yet invoiced —
      // deliberately NOT just the orders whose delivery fell inside it.
      //
      // The window used to be `[start, end)`, and that quietly leaked money. An
      // order delivered at 23:59:30, moments after the run wrote this vendor's
      // row, missed its own day; the next night's run then filtered on the next
      // day's `deliveredAt` and missed it too. The statement for the day it
      // belonged to already existed, so a re-run skipped the vendor entirely.
      // The commission on that order was never billed by any run, ever.
      //
      // Double-billing is impossible regardless of how wide this window is:
      // an invoiced order leaves DELIVERED for SETTLED below, and SETTLED is
      // not in BILLABLE_STATUSES. The status filter — not the date bound — is
      // what makes an order billable exactly once. So the bound is now a
      // cutoff rather than a window, and a straggler simply lands on the next
      // statement the vendor receives.
      const dayOrders = await orders
        .find({
          restaurantId: restaurant._id,
          status: { $in: [...BILLABLE_STATUSES] },
          "timestamps.deliveredAt": { $lt: end },
        })
        .toArray();

      // Carried in from an earlier day. Worth naming in the audit trail: it is
      // the difference between a vendor's order count and what they counted.
      const stragglerCount = dayOrders.filter(
        (o) => o.timestamps.deliveredAt !== null && o.timestamps.deliveredAt < start,
      ).length;

      const cashCollectedPaise = dayOrders.reduce(
        (total, o) => total + o.payment.cashCollectedPaise,
        0,
      );
      const commissionDuePaise = dayOrders.reduce(
        (total, o) => total + o.pricing.platformCommissionPaise,
        0,
      );

      const entries = await ledgerEntriesForDay({
        restaurantId: restaurant._id,
        statementDate,
        timezone: params.campus.timezone,
      });
      const adjustmentsPaise = sumLedger(entries);
      const openingBalancePaise = await previousCarryForward({
        restaurantId: restaurant._id,
        statementDate,
      });

      const net = commissionDuePaise + adjustmentsPaise + openingBalancePaise;
      // Rules 2 and 3 in one place: anything negative or under the floor rolls
      // forward rather than being invoiced or refunded.
      const netDuePaise = net >= COLLECTION_FLOOR_PAISE ? net : 0;
      const carriedForwardPaise = net >= COLLECTION_FLOOR_PAISE ? 0 : net;

      const statement: CommissionStatement = {
        _id: newId(),
        restaurantId: restaurant._id,
        campusId: params.campus._id,
        statementDate,
        cashCollectedPaise,
        commissionDuePaise,
        adjustmentsPaise,
        openingBalancePaise,
        netDuePaise,
        carriedForwardPaise,
        orderCount: dayOrders.length,
        status: "PENDING",
        paidAt: null,
        collectionMethod: null,
        paymentReference: null,
        createdAt: new Date(),
      };

      try {
        await statements.insertOne(statement);
      } catch (error: unknown) {
        // F15 — another instance of the cron won the race. That is the unique
        // index doing its job, not a failure.
        if (isDuplicateKey(error)) {
          return { skipped: restaurant._id, written: null, ordersSettled: 0 };
        }
        throw error;
      }

      await writeAudit({
        entity: "STATEMENT",
        entityId: statement._id,
        from: null,
        to: "PENDING",
        actorId: params.actorId ?? null,
        actorRole: ACTOR.SYSTEM,
        reason:
          `Commission statement ${statementDate} for ${restaurant.name}: ` +
          `${dayOrders.length} order(s)` +
          (stragglerCount > 0 ? `, ${stragglerCount} carried in from an earlier day` : ""),
      });

      let settledCount = 0;
      // Orders close only after the immutable row exists, so a crash between the
      // two leaves them re-runnable rather than billed against nothing.
      for (const order of dayOrders) {
        
        const result = await transitionOrder({
          orderId: order._id,
          to: ORDER_STATUS.SETTLED,
          actor: ACTOR.SYSTEM,
          actorId: params.actorId ?? null,
          reason: `Invoiced in run ${statementDate}`,
        });
        if (result.ok) settledCount += 1;
      }

      return { skipped: null, written: statement, ordersSettled: settledCount };
    }),
  );

  for (const res of results) {
    if (res.skipped) skipped.push(res.skipped);
    if (res.written) written.push(res.written);
    ordersSettled += res.ordersSettled;
  }

  return { statementDate, written, skipped, ordersSettled };
}

async function previousCarryForward(params: {
  restaurantId: string;
  statementDate: string;
}): Promise<number> {
  const previous = await (await db.commissionStatements()).findOne(
    { restaurantId: params.restaurantId, statementDate: { $lt: params.statementDate } },
    { sort: { statementDate: -1 } },
  );
  return previous?.carriedForwardPaise ?? 0;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11_000
  );
}

/* ------------------------------------------------------------------ */
/* Reads and collection marking                                        */
/* ------------------------------------------------------------------ */

export async function listStatements(params: {
  statementDate?: string;
  restaurantId?: string;
  status?: CommissionStatement["status"];
  limit?: number;
}): Promise<CommissionStatement[]> {
  const filter: Record<string, unknown> = {};
  if (params.statementDate) filter.statementDate = params.statementDate;
  if (params.restaurantId) filter.restaurantId = params.restaurantId;
  if (params.status) filter.status = params.status;

  return (await db.commissionStatements())
    .find(filter)
    .sort({ statementDate: -1, netDuePaise: -1 })
    .limit(params.limit ?? 200)
    .toArray();
}

export type CollectionMethod = NonNullable<CommissionStatement["collectionMethod"]>;

export async function markStatementCollected(params: {
  statementId: string;
  collectionMethod: CollectionMethod;
  /** UPI ref, bank UTR, or the cash receipt number. Free text on purpose. */
  paymentReference: string;
  actorId: string;
}): Promise<
  { ok: true; statement: CommissionStatement } | { ok: false; message: string }
> {
  const statements = await db.commissionStatements();

  // The status guard makes this a compare-and-swap: two admins marking the
  // same statement collected cannot both write a reference.
  const updated = await statements.findOneAndUpdate(
    { _id: params.statementId, status: "PENDING" },
    {
      $set: {
        status: "PAID",
        paidAt: new Date(),
        collectionMethod: params.collectionMethod,
        paymentReference: params.paymentReference,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    return { ok: false, message: "That statement is missing, or was already marked collected." };
  }

  await writeAudit({
    entity: "STATEMENT",
    entityId: updated._id,
    from: "PENDING",
    to: "PAID",
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Commission collected by ${params.collectionMethod}, ref ${params.paymentReference}`,
  });

  return { ok: true, statement: updated };
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

export interface StatementCsvRow extends CommissionStatement {
  restaurantName: string;
  restaurantPhone: string;
  ownerPhone: string | null;
}

/**
 * The collections CSV.
 *
 * This is the sheet somebody works down in the morning, phone in hand, ticking
 * off vendors as they hand the commission over. It carries phone numbers
 * rather than bank details, because the money is coming to us now — there is
 * nothing to pay out and no banking portal to paste into.
 *
 * Amounts are plain rupee decimals with no symbol and no grouping, so the file
 * opens cleanly in a spreadsheet.
 */
export function statementsToCsv(rows: readonly StatementCsvRow[]): string {
  const header = [
    "statementDate",
    "restaurant",
    "phone",
    "ownerPhone",
    "orders",
    "cashCollected",
    "commissionDue",
    "adjustments",
    "openingBalance",
    "netDue",
    "carriedForward",
    "status",
    "collectedVia",
    "reference",
  ].join(",");

  const lines = rows.map((row) =>
    [
      row.statementDate,
      csvCell(row.restaurantName),
      csvCell(row.restaurantPhone),
      csvCell(row.ownerPhone ?? ""),
      String(row.orderCount),
      formatINRPlain(row.cashCollectedPaise),
      formatINRPlain(row.commissionDuePaise),
      signedRupees(row.adjustmentsPaise),
      signedRupees(row.openingBalancePaise),
      formatINRPlain(row.netDuePaise),
      signedRupees(row.carriedForwardPaise),
      row.status,
      csvCell(row.collectionMethod ?? ""),
      csvCell(row.paymentReference ?? ""),
    ].join(","),
  );

  return [header, ...lines].join("\r\n");
}

/** Ledger and carry-forward are the only signed money columns in the file. */
function signedRupees(paise: number): string {
  return paise < 0 ? `-${formatINRPlain(-paise)}` : formatINRPlain(paise);
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Convenience for callers building CSV rows from a restaurant document. */
export function csvRow(
  statement: CommissionStatement,
  restaurant: Restaurant | undefined,
): StatementCsvRow {
  return {
    ...statement,
    restaurantName: restaurant?.name ?? "Unknown restaurant",
    restaurantPhone: restaurant?.phone ?? "",
    ownerPhone: restaurant?.kyc?.ownerPhone ?? null,
  };
}
