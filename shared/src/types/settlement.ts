import type { Paise } from "../money.js";
import type { Id, IsoDateTime } from "./common.js";

/**
 * One immutable row per vendor per day. The payout is generated FROM this document,
 * never recomputed on the fly.
 *
 * Idempotency is enforced by a unique index on (restaurantId, settlementDate), so a
 * cron that fires twice is a no-op (F15).
 */
export interface ISettlement {
  _id: Id;
  restaurantId: Id;
  /** YYYY-MM-DD, campus-local. */
  settlementDate: string;

  /** Sum of vendorReceivable for DELIVERED ONLINE_100 orders. */
  grossPrepaidPaise: Paise;
  /** Sum of ledger entries. Negative. */
  adjustmentsPaise: Paise;
  /** gross + adjustments. May be negative — it carries forward, never clawed back. */
  netPayoutPaise: Paise;

  /** COD orders settled themselves at the gate and contribute exactly ₹0. */
  codOrderCount: number;
  prepaidOrderCount: number;

  /** Under ₹100 rolls forward so per-transfer fees do not eat the amount. */
  status: "PENDING" | "CARRIED_FORWARD" | "PAID";
  /** Bank reference, filled in when an admin marks the batch paid. */
  utr?: string;

  createdAt: IsoDateTime;
  paidAt?: IsoDateTime;
}
