import type { Paise } from "../money.js";
import type { Id, IsoDateTime } from "./common.js";

export const DISPUTE_REASONS = [
  "WRONG_ITEM",
  "MISSING_ITEM",
  "SPILLED_OR_COLD",
  "NEVER_DELIVERED",
  "OTHER",
] as const;

export type DisputeReason = (typeof DISPUTE_REASONS)[number];

/**
 * A student complaint, raised inside a 30-minute window after delivery — long enough
 * to open the bag, short enough that the food is still evidence.
 *
 * These get an admin queue, not an algorithm. At campus scale a person is faster,
 * cheaper and fairer than the logic automating it would require.
 */
export interface IDispute {
  _id: Id;
  orderId: Id;
  customerId: Id;
  restaurantId: Id;

  reason: DisputeReason;
  note?: string;

  /**
   * MANDATORY. No photo, no dispute. Stored in Supabase Storage; Mongo holds the URL.
   */
  photoUrls: string[];

  status: "OPEN" | "UPHELD" | "REJECTED";

  /** Every ruling is audit-logged with the admin identity and a written reason. */
  ruling?: {
    by: Id;
    refundAmountPaise: Paise;
    reason: string;
    at: IsoDateTime;
  };

  createdAt: IsoDateTime;
}
