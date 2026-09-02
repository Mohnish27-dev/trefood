import "server-only";

import * as db from "@/server/db/collections";
import { newId } from "@/lib/ids";
import { campusDateString, campusDayRange } from "@/lib/campus-time";
import { formatINRPlain, type Paise } from "@/lib/money";
import { ACTOR, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/constants";
import { ledgerEntriesForDay, sumLedger } from "./ledger";
import { transitionOrder } from "./orders";
import { writeAudit } from "./audit";
import type { Campus } from "@/types/campus";
import type { RestaurantPayout } from "@/types/restaurant";
import type { Settlement } from "@/types/finance";

/**
 * The nightly settlement run. MONEY_AND_SETTLEMENT.md section 6.
 *
 *   grossPrepaid = SUM(vendorReceivable) for DELIVERED prepaid orders
 *   adjustments  = SUM(ledger entries for the day)   -- negative debits
 *   netPayable   = grossPrepaid + adjustments + openingBalance
 *
 * Four properties this file exists to guarantee:
 *
 *   1. COD orders contribute EXACTLY ZERO. The token already paid the
 *      commission and the cash already paid the vendor, so there is no debt in
 *      either direction. If a COD order ever lands in `grossPrepaid`, the
 *      vendor is being paid twice.
 *   2. The run is idempotent (F15). The unique index on
 *      `(restaurantId, settlementDate)` makes a second run a no-op rather than
 *      a second payout.
 *   3. A negative net carries forward as an opening debit. Money already sent
 *      is never clawed back.
 *   4. The settlement document is immutable once written. The payout is
 *      generated FROM it, never recomputed — so a menu edit next week cannot
 *      quietly change what a vendor was paid last night.
 */

/** Rule 3 — a payout below this rolls forward, so per-transfer fees do not eat it. */
export const PAYOUT_FLOOR_PAISE: Paise = 10_000;

/** Only these close a day. Anything still in flight rolls to the next run. */
const SETTLEABLE_STATUSES = [
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.DELIVERED_TO_SECURITY,
  ORDER_STATUS.DISPUTE_REJECTED,
] as const;

export interface SettlementRunResult {
  settlementDate: string;
  written: Settlement[];
  /** Restaurants whose day was already settled. Proof the run is idempotent. */
  skipped: string[];
  ordersSettled: number;
}

export async function runSettlement(params: {
  campus: Campus;
  /** Campus-local "YYYY-MM-DD". Defaults to today in the campus timezone. */
  settlementDate?: string;
  actorId?: string | null;
}): Promise<SettlementRunResult> {
  const settlementDate =
    params.settlementDate ?? campusDateString(new Date(), params.campus.timezone);
  const { start, end } = campusDayRange(settlementDate, params.campus.timezone);

  const [orders, settlements, restaurants] = await Promise.all([
    db.orders(),
    db.settlements(),
    db.restaurants(),
  ]);

  const vendors = await restaurants.find({ campusId: params.campus._id }).toArray();

  const written: Settlement[] = [];
  const skipped: string[] = [];
  let ordersSettled = 0;

  for (const restaurant of vendors) {
    const existing = await settlements.findOne({ restaurantId: restaurant._id, settlementDate });
    if (existing) {
      skipped.push(restaurant._id);
      continue;
    }

    const dayOrders = await orders
      .find({
        restaurantId: restaurant._id,
        status: { $in: [...SETTLEABLE_STATUSES] },
        "timestamps.deliveredAt": { $gte: start, $lt: end },
      })
      .toArray();

    const prepaid = dayOrders.filter((o) => o.payment.method === PAYMENT_METHOD.ONLINE_100);
    const cod = dayOrders.filter((o) => o.payment.method === PAYMENT_METHOD.HYBRID_COD);

    const grossPrepaidPaise = prepaid.reduce(
      (total, o) => total + o.pricing.vendorReceivablePaise,
      0,
    );

    const entries = await ledgerEntriesForDay({
      restaurantId: restaurant._id,
      settlementDate,
      timezone: params.campus.timezone,
    });
    const adjustmentsPaise = sumLedger(entries);
    const openingBalancePaise = await previousCarryForward({
      restaurantId: restaurant._id,
      settlementDate,
    });

    const net = grossPrepaidPaise + adjustmentsPaise + openingBalancePaise;
    // Rules 2 and 3 in one place: anything negative or under the floor rolls
    // forward rather than being paid out or clawed back.
    const netPayablePaise = net >= PAYOUT_FLOOR_PAISE ? net : 0;
    const carriedForwardPaise = net >= PAYOUT_FLOOR_PAISE ? 0 : net;

    const settlement: Settlement = {
      _id: newId(),
      restaurantId: restaurant._id,
      campusId: params.campus._id,
      settlementDate,
      grossPrepaidPaise,
      adjustmentsPaise,
      openingBalancePaise,
      netPayablePaise,
      carriedForwardPaise,
      orderCount: dayOrders.length,
      codOrderCount: cod.length,
      // Always zero, by construction. It appears on the statement so a vendor
      // can see their COD orders were counted, and settled at the gate.
      codContributionPaise: 0,
      status: "PENDING",
      paidAt: null,
      utrReference: null,
      createdAt: new Date(),
    };

    try {
      await settlements.insertOne(settlement);
    } catch (error: unknown) {
      // F15 — another instance of the cron won the race. That is the unique
      // index doing its job, not a failure.
      if (isDuplicateKey(error)) {
        skipped.push(restaurant._id);
        continue;
      }
      throw error;
    }

    written.push(settlement);

    await writeAudit({
      entity: "SETTLEMENT",
      entityId: settlement._id,
      from: null,
      to: "PENDING",
      actorId: params.actorId ?? null,
      actorRole: ACTOR.SYSTEM,
      reason: `Settlement ${settlementDate} for ${restaurant.name}: ${dayOrders.length} order(s)`,
    });

    // Orders close only after the immutable row exists, so a crash between the
    // two leaves them re-runnable rather than settled against nothing.
    for (const order of dayOrders) {
      const result = await transitionOrder({
        orderId: order._id,
        to: ORDER_STATUS.SETTLED,
        actor: ACTOR.SYSTEM,
        actorId: params.actorId ?? null,
        reason: `Settled in run ${settlementDate}`,
      });
      if (result.ok) ordersSettled += 1;
    }
  }

  return { settlementDate, written, skipped, ordersSettled };
}

async function previousCarryForward(params: {
  restaurantId: string;
  settlementDate: string;
}): Promise<number> {
  const previous = await (await db.settlements()).findOne(
    { restaurantId: params.restaurantId, settlementDate: { $lt: params.settlementDate } },
    { sort: { settlementDate: -1 } },
  );
  return previous?.carriedForwardPaise ?? 0;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11_000
  );
}

/* ------------------------------------------------------------------ */
/* Reads and payout marking                                            */
/* ------------------------------------------------------------------ */

export async function listSettlements(params: {
  settlementDate?: string;
  restaurantId?: string;
  status?: Settlement["status"];
  limit?: number;
}): Promise<Settlement[]> {
  const filter: Record<string, unknown> = {};
  if (params.settlementDate) filter.settlementDate = params.settlementDate;
  if (params.restaurantId) filter.restaurantId = params.restaurantId;
  if (params.status) filter.status = params.status;

  return (await db.settlements())
    .find(filter)
    .sort({ settlementDate: -1, netPayablePaise: -1 })
    .limit(params.limit ?? 200)
    .toArray();
}

export async function markSettlementPaid(params: {
  settlementId: string;
  utrReference: string;
  actorId: string;
}): Promise<{ ok: true; settlement: Settlement } | { ok: false; message: string }> {
  const settlements = await db.settlements();

  // The status guard makes this a compare-and-swap: two admins marking the
  // same batch paid cannot both write a UTR.
  const updated = await settlements.findOneAndUpdate(
    { _id: params.settlementId, status: "PENDING" },
    { $set: { status: "PAID", paidAt: new Date(), utrReference: params.utrReference } },
    { returnDocument: "after" },
  );

  if (!updated) {
    return { ok: false, message: "That settlement is missing, or was already marked paid." };
  }

  await writeAudit({
    entity: "SETTLEMENT",
    entityId: updated._id,
    from: "PENDING",
    to: "PAID",
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Paid by bank transfer, UTR ${params.utrReference}`,
  });

  return { ok: true, settlement: updated };
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

export interface SettlementCsvRow extends Settlement {
  restaurantName: string;
  payout: RestaurantPayout;
}

/**
 * The payout CSV.
 *
 * v1 settlement is a bank transfer an admin makes by hand, so this file IS the
 * integration — deliberately, per MONEY section 6. At 10-20 vendors a
 * five-minute nightly CSV genuinely beats a payout-API activation. Automate at
 * 50+, not before.
 *
 * Amounts are plain rupee decimals with no symbol and no grouping, because
 * this is pasted into a banking portal rather than read by a person.
 */
export function settlementsToCsv(rows: readonly SettlementCsvRow[]): string {
  const header = [
    "settlementDate",
    "restaurant",
    "accountName",
    "accountNumber",
    "ifsc",
    "upi",
    "grossPrepaid",
    "adjustments",
    "openingBalance",
    "netPayable",
    "carriedForward",
    "orders",
    "codOrders",
    "status",
    "utr",
  ].join(",");

  const lines = rows.map((row) =>
    [
      row.settlementDate,
      csvCell(row.restaurantName),
      csvCell(row.payout.accountName),
      csvCell(row.payout.accountNumber),
      csvCell(row.payout.ifsc),
      csvCell(row.payout.upiId ?? ""),
      formatINRPlain(row.grossPrepaidPaise),
      signedRupees(row.adjustmentsPaise),
      signedRupees(row.openingBalancePaise),
      formatINRPlain(row.netPayablePaise),
      signedRupees(row.carriedForwardPaise),
      String(row.orderCount),
      String(row.codOrderCount),
      row.status,
      csvCell(row.utrReference ?? ""),
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
