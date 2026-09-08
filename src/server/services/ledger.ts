import "server-only";

import * as db from "@/server/db/collections";
import { newId } from "@/lib/ids";
import { campusDayRange } from "@/lib/campus-time";
import type { LedgerEntry } from "@/types/finance";

/**
 * Append-only adjustments to what a vendor owes. MONEY_AND_SETTLEMENT.md section 5.
 *
 * There is no update and no delete here, for the same reason there is none in
 * `audit.ts`: this is the evidence behind every invoice a vendor questions. A
 * correction is a NEW entry with the opposite sign, never an edit to an old
 * one, so the statement always reads as a history rather than a claim.
 *
 * `amountPaise` is the only signed money field in the system, and it is signed
 * AGAINST THE VENDOR'S DUE: positive means they owe us more, negative means
 * they owe us less. See the note on `LedgerEntry` in types/finance.ts.
 */

export interface LedgerInput {
  restaurantId: string;
  campusId: string;
  orderId?: string | null;
  orderNumber?: string | null;
  type: LedgerEntry["type"];
  /** Positive adds to what the vendor owes; negative credits them. */
  amountPaise: number;
  note: string;
  createdBy?: string | null;
}

export async function writeLedgerEntry(input: LedgerInput): Promise<LedgerEntry> {
  if (!Number.isSafeInteger(input.amountPaise)) {
    throw new Error(`Ledger amount must be integer paise, received ${input.amountPaise}`);
  }

  const entry: LedgerEntry = {
    _id: newId(),
    restaurantId: input.restaurantId,
    campusId: input.campusId,
    orderId: input.orderId ?? null,
    orderNumber: input.orderNumber ?? null,
    type: input.type,
    amountPaise: input.amountPaise,
    note: input.note,
    createdBy: input.createdBy ?? null,
    createdAt: new Date(),
  };

  await (await db.ledgerEntries()).insertOne(entry);
  return entry;
}

export async function listLedgerEntries(params: {
  restaurantId: string;
  limit?: number;
}): Promise<LedgerEntry[]> {
  return (await db.ledgerEntries())
    .find({ restaurantId: params.restaurantId })
    .sort({ createdAt: -1 })
    .limit(params.limit ?? 100)
    .toArray();
}

/**
 * Adjustments belonging to one campus-local statement day.
 *
 * Membership is decided by `createdAt` falling inside the campus day rather
 * than by a statementId written back onto the entry. That keeps the ledger
 * genuinely append-only and makes a re-run of the same day produce the same
 * set — which is what F15's idempotency actually requires.
 */
export async function ledgerEntriesForDay(params: {
  restaurantId: string;
  statementDate: string;
  timezone: string;
}): Promise<LedgerEntry[]> {
  const { start, end } = campusDayRange(params.statementDate, params.timezone);
  return (await db.ledgerEntries())
    .find({ restaurantId: params.restaurantId, createdAt: { $gte: start, $lt: end } })
    .sort({ createdAt: 1 })
    .toArray();
}

export function sumLedger(entries: readonly LedgerEntry[]): number {
  return entries.reduce((total, entry) => total + entry.amountPaise, 0);
}
