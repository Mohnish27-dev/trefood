import type { Paise } from "../money.js";
import type { Id, IsoDateTime } from "./common.js";

export const LEDGER_ENTRY_TYPES = [
  /**
   * D3 — on a vendor-fault refund Razorpay keeps its fee, and that loss is debited
   * from the vendor's next payout. This is what makes free rejection cost something:
   * a vendor who rejects freely pays for it.
   */
  "REFUND_GATEWAY_RECOVERY",
  "DISPUTE_DEBIT",
  "PENALTY",
  "MANUAL_ADJUSTMENT",
  "OPENING_BALANCE_CARRY_FORWARD",
] as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

/** Append-only. Never updated, never deleted. */
export interface ILedgerEntry {
  _id: Id;
  restaurantId: Id;
  orderId?: Id;
  type: LedgerEntryType;
  /** Negative for a debit. Vendors see this line on their statement. */
  amountPaise: Paise;
  note: string;
  createdAt: IsoDateTime;
}
