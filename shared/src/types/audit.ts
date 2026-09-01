import type { OrderStatus, UserRole } from "../constants.js";
import type { Id, IsoDateTime } from "./common.js";

export const AUDIT_ACTIONS = [
  "ORDER_TRANSITION",
  "PRICE_EDIT",
  "COMMISSION_OVERRIDE",
  "MANUAL_CANCELLATION",
  "DISPUTE_RULING",
  "SETTLEMENT_RUN",
  "COD_BLOCK",
  "VENDOR_KYC",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * The append-only transition trail.
 *
 * Every state transition and every financial action writes one of these. It is
 * INSERT-ONLY: there is no update path, no delete path, and no UI anywhere that
 * offers either. A log that can be edited is not evidence, and the whole point of
 * this collection is to be the thing you can trust when a vendor and a student
 * disagree about what happened at a gate at 1 AM.
 */
export interface IAuditLog {
  _id: Id;
  action: AuditAction;

  orderId?: Id;
  restaurantId?: Id;

  /** Who fired it. `SYSTEM` for cron-driven transitions. */
  actorId: Id | "SYSTEM";
  actorRole: UserRole | "SYSTEM";

  /** Present on ORDER_TRANSITION. */
  from?: OrderStatus;
  to?: OrderStatus;

  /**
   * Mandatory for anything discretionary — a manual cancellation, a dispute ruling,
   * a commission override. "Because I said so" is not a reason, and six months later
   * neither is a blank field.
   */
  reason?: string;

  /** Free-form context, e.g. the before/after of a price edit. */
  metadata?: Record<string, string | number | boolean>;

  at: IsoDateTime;
}
