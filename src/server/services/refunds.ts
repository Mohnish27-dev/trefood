import "server-only";

import * as db from "@/server/db/collections";
import { ceilPaiseOfBps, type Paise } from "@/lib/money";
import { PAYMENT_STATUS } from "@/lib/constants";
import { paymentProvider } from "./payments";
import { writeLedgerEntry } from "./ledger";
import type { Order } from "@/types/order";

/**
 * Refunds. D1, D2, D3.
 *
 * Three rules, and every one of them is a decision someone will try to undo:
 *
 *   D1  A refund fires ONLY on vendor or platform fault. Never on a student
 *       changing their mind, never on a no-show, never on refused COD cash.
 *       This module does not decide fault — the caller does — but it is the
 *       only door money leaves by, so every exit is audited in one place.
 *
 *   D2  The refundable amount is `onlinePaid - convenienceFee`, computed ONCE
 *       at order creation and frozen on the document. It is never recomputed
 *       here. The gateway charge and its GST are never returned, because the
 *       gateway does not return them to us either.
 *
 *   D3  The gateway fee lost on that refund is booked as a NEGATIVE ledger
 *       entry against the vendor and deducted from their next payout. That is
 *       what makes a rejection carry a real cost: a vendor who rejects freely
 *       pays for it.
 */

export type RefundOutcome =
  | { ok: true; amountPaise: Paise; refundId: string; skipped: false }
  /** Nothing was captured, so there is nothing to return. Not an error. */
  | { ok: true; amountPaise: 0; refundId: null; skipped: true }
  | { ok: false; message: string };

export async function issueRefund(params: {
  order: Order;
  /** Defaults to the frozen `refundableAmountPaise`. Pass less for a partial (F6, disputes). */
  amountPaise?: Paise;
  reason: string;
  /** D3 — skip the vendor debit when the fault is not the vendor's. */
  recoverGatewayFeeFromVendor?: boolean;
  actorId?: string | null;
}): Promise<RefundOutcome> {
  const { order } = params;
  const requested = params.amountPaise ?? order.pricing.refundableAmountPaise;

  // Cannot return more than actually reached the gateway, minus the fee that
  // never comes back. A partial refund on top of an earlier one is bounded by
  // the same ceiling.
  const alreadyRefunded = order.refund?.status === "PROCESSED" ? order.refund.amountPaise : 0;
  const ceiling = order.pricing.refundableAmountPaise - alreadyRefunded;
  const amountPaise = Math.max(0, Math.min(requested, ceiling));

  if (amountPaise === 0 || order.payment.providerPaymentId === null) {
    return { ok: true, amountPaise: 0, refundId: null, skipped: true };
  }

  const orders = await db.orders();
  const now = new Date();

  let refundId: string;
  let status: "PROCESSED" | "PENDING" | "FAILED";

  try {
    const result = await paymentProvider().refund({
      paymentId: order.payment.providerPaymentId,
      amountPaise,
      reason: params.reason,
    });
    refundId = result.refundId;
    status = result.status;
  } catch (error: unknown) {
    // F16 — three retries then an admin alert. The attempt is recorded so the
    // retry cron can find it; money must never fail silently.
    const message = error instanceof Error ? error.message : "Refund call failed";
    await orders.updateOne(
      { _id: order._id },
      {
        $set: {
          refund: {
            providerRefundId: null,
            amountPaise,
            status: "FAILED",
            attempts: (order.refund?.attempts ?? 0) + 1,
            lastError: message,
            at: now,
          },
        },
      },
    );
    return { ok: false, message };
  }

  const totalRefunded = alreadyRefunded + amountPaise;
  const fullyRefunded = totalRefunded >= order.pricing.refundableAmountPaise;

  await orders.updateOne(
    { _id: order._id },
    {
      $set: {
        refund: {
          providerRefundId: refundId,
          amountPaise: totalRefunded,
          status,
          attempts: (order.refund?.attempts ?? 0) + 1,
          lastError: null,
          at: now,
        },
        "payment.status": fullyRefunded
          ? PAYMENT_STATUS.REFUNDED
          : PAYMENT_STATUS.PARTIALLY_REFUNDED,
      },
    },
  );

  if (params.recoverGatewayFeeFromVendor !== false) {
    await recoverGatewayFee({ order, refundedPaise: amountPaise, actorId: params.actorId ?? null });
  }

  return { ok: true, amountPaise, refundId, skipped: false };
}

/**
 * D3 — book the gateway's cut against the vendor.
 *
 * The fee is computed on the amount actually returned, at the rate snapshotted
 * on the order, in PAISE rather than rupees: this is the one figure in the
 * system that is genuinely sub-rupee, and rounding it to a rupee would either
 * over- or under-charge every vendor on every refund. MONEY section 5's worked
 * entry (-531 paise on a 225-rupee refundable at 236 bps) falls out of this
 * exactly.
 */
async function recoverGatewayFee(params: {
  order: Order;
  refundedPaise: Paise;
  actorId: string | null;
}): Promise<void> {
  const { order } = params;
  const lossPaise = ceilPaiseOfBps(params.refundedPaise, order.pricing.gatewayFeeBps);
  if (lossPaise === 0) return;

  await writeLedgerEntry({
    restaurantId: order.restaurantId,
    campusId: order.campusId,
    orderId: order._id,
    orderNumber: order.orderNumber,
    type: "REFUND_GATEWAY_RECOVERY",
    amountPaise: -lossPaise,
    note: `Gateway fee not returned on refund of ${order.orderNumber}`,
    createdBy: params.actorId,
  });
}
