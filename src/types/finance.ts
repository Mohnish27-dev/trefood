import type { Paise } from "@/lib/money";

/**
 * Append-only payout adjustments. MONEY_AND_SETTLEMENT.md section 5.
 *
 * D3 — on every vendor-fault refund, the gateway keeps its original fee. That
 * loss is booked as a NEGATIVE entry against the vendor and deducted from
 * their next payout. Vendors see the line on their statement, which makes
 * rejections carry a real cost: a vendor who rejects freely pays for it.
 */
export interface LedgerEntry {
  _id: string;
  restaurantId: string;
  campusId: string;
  orderId: string | null;
  orderNumber: string | null;
  type:
    | "REFUND_GATEWAY_RECOVERY"
    | "DISPUTE_DEBIT"
    /** F6 — a line the kitchen could not deliver, refunded to the student. */
    | "STOCKOUT_SHORTFALL"
    | "PENALTY"
    | "MANUAL_ADJUSTMENT"
    | "CARRY_FORWARD";
  /** Negative for a debit against the vendor. The only signed money field in the system. */
  amountPaise: number;
  note: string;
  createdBy: string | null;
  createdAt: Date;
}

/** One immutable row per vendor per day. The payout is generated FROM this, never recomputed. */
export interface Settlement {
  _id: string;
  restaurantId: string;
  campusId: string;
  /** Campus-local date, "2026-09-01". Unique with restaurantId — makes the run idempotent. */
  settlementDate: string;

  /** SUM(vendorReceivable) for DELIVERED prepaid orders only. */
  grossPrepaidPaise: Paise;
  /** Negative sum of ledger entries. */
  adjustmentsPaise: number;
  /** Carried in from a previous day that netted below the payout floor, or negative. */
  openingBalancePaise: number;
  netPayablePaise: number;
  /** Rolled to tomorrow when netPayable is negative or below the 100-rupee floor. */
  carriedForwardPaise: number;

  orderCount: number;
  codOrderCount: number;
  /** COD orders contribute exactly zero — already settled at the gate. */
  codContributionPaise: Paise;

  status: "PENDING" | "PAID";
  paidAt: Date | null;
  utrReference: string | null;
  createdAt: Date;
}

export interface Coupon {
  _id: string;
  code: string;
  campusId: string | null;
  /** Nullable: when set, coupon is scoped to that specific restaurant only. */
  restaurantId?: string | null;
  description?: string | null;
  /** A1 — platform-funded by default, so the vendor is paid on the pre-discount base. */
  fundedBy: "PLATFORM" | "VENDOR";
  type: "FLAT" | "PERCENT";
  valuePaise: Paise;
  valueBps: number;
  /** Capped at 10% of base in the validator, unless you deliberately want a loss-leader. */
  maxDiscountPaise: Paise;
  minOrderPaise: Paise;
  perStudentLimit: number;
  totalLimit: number | null;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
}
