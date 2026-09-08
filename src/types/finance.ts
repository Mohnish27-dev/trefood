import type { Paise } from "@/lib/money";

/**
 * Append-only adjustments to what a vendor owes. MONEY_AND_SETTLEMENT.md section 5.
 *
 * ★ SIGN CONVENTION ★ — `amountPaise` is signed AGAINST THE VENDOR'S DUE.
 *
 *   positive  the vendor owes TREFOOD more (a penalty)
 *   negative  the vendor owes TREFOOD less (a credit)
 *
 * This is the reverse of the sign the file carried while TREFOOD held the
 * money and paid vendors out. Money now flows vendor -> platform, so the only
 * signed field in the system flows with it. Anything reading a ledger row
 * adds it to the day's commission, never subtracts.
 */
export interface LedgerEntry {
  _id: string;
  restaurantId: string;
  campusId: string;
  orderId: string | null;
  orderNumber: string | null;
  type:
    /** F6 — a line the kitchen could not deliver. The student paid less cash,
        so the commission on that line is credited back. Always negative. */
    | "STOCKOUT_CREDIT"
    | "PENALTY"
    | "MANUAL_ADJUSTMENT"
    | "CARRY_FORWARD";
  amountPaise: number;
  note: string;
  createdBy: string | null;
  createdAt: Date;
}

/**
 * One immutable row per vendor per day: what that vendor owes TREFOOD.
 *
 * The vendor's delivery staff collected the full bill in cash at every gate,
 * so the vendor ends the day holding all of it. This statement is the invoice
 * for our commission on that day's deliveries, and the admin marks it paid
 * when the vendor hands the money over.
 */
export interface CommissionStatement {
  _id: string;
  restaurantId: string;
  campusId: string;
  /** Campus-local date, "2026-09-01". Unique with restaurantId — makes the run idempotent. */
  statementDate: string;

  /** SUM(grandTotal) the vendor's staff collected. Context for the vendor, not owed. */
  cashCollectedPaise: Paise;
  /** SUM(platformCommission) for the day's DELIVERED orders. The invoice line. */
  commissionDuePaise: Paise;
  /** Signed ledger entries for the day, added to the due. */
  adjustmentsPaise: number;
  /** Carried in from a day that fell below the collection floor, or went negative. */
  openingBalancePaise: number;
  /** commissionDue + adjustments + openingBalance, floored at zero for collection. */
  netDuePaise: number;
  /** Rolled to tomorrow when the net is negative or below the collection floor. */
  carriedForwardPaise: number;

  orderCount: number;

  status: "PENDING" | "PAID";
  paidAt: Date | null;
  /** How the vendor settled up, and the reference the admin recorded. */
  collectionMethod: "CASH" | "UPI" | "BANK_TRANSFER" | null;
  paymentReference: string | null;
  createdAt: Date;
}

export interface Coupon {
  _id: string;
  code: string;
  campusId: string | null;
  /** Nullable: when set, coupon is scoped to that specific restaurant only. */
  restaurantId?: string | null;
  description?: string | null;
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
