import "server-only";

import * as db from "@/server/db/collections";
import { newId } from "@/lib/ids";
import { ACTOR, ORDER_STATUS } from "@/lib/constants";
import type { Paise } from "@/lib/money";
import { issueRefund } from "./refunds";
import { writeLedgerEntry } from "./ledger";
import { disputeWindowOpen, transitionOrder } from "./orders";
import { getOrderTimeline } from "./audit";
import type { Dispute } from "@/types/ops";
import type { AuditLog, Order } from "@/types/order";

/**
 * Disputes. FAILURES_AND_EDGE_CASES.md section 3.
 *
 * These are the failures that get a human rather than an algorithm. At campus
 * scale the volume is low enough that a person is faster, cheaper and fairer
 * than the logic required to automate a "was the food actually cold" decision.
 *
 * Two hard rules:
 *
 *   · **Photo evidence is mandatory.** No photo, no dispute. Enforced here and
 *     not only in the form, because the form is not authorisation.
 *   · **Thirty-minute window.** Long enough to open the bag, short enough that
 *     the food is still evidence. A late claim is not refused rudely — it is
 *     pointed at the restaurant's phone number, which is the faster fix anyway.
 *
 * Every ruling is audit-logged with the admin identity and a written reason,
 * and upholding one debits the vendor. A ruling with no cost attached is not a
 * ruling, it is the platform quietly paying for a kitchen's mistake.
 */

export type DisputeReason = Dispute["reason"];

export const DISPUTE_REASONS: readonly { value: DisputeReason; label: string }[] = [
  { value: "MISSING_ITEM", label: "Something was missing" },
  { value: "WRONG_ITEM", label: "Wrong item delivered" },
  { value: "SPILLED", label: "Spilled or damaged" },
  { value: "COLD", label: "Cold or inedible" },
  { value: "NOT_DELIVERED", label: "Never actually delivered" },
  { value: "OTHER", label: "Something else" },
];

export async function openDispute(params: {
  order: Order;
  customerId: string;
  reason: DisputeReason;
  note: string;
  photoUrls: string[];
  now?: Date;
}): Promise<{ ok: true; dispute: Dispute } | { ok: false; message: string }> {
  const now = params.now ?? new Date();

  if (params.order.customerId !== params.customerId) {
    return { ok: false, message: "That order is not yours." };
  }

  if (params.photoUrls.length === 0) {
    return {
      ok: false,
      message: "A photo is required. It is the only evidence anyone has once the food is gone.",
    };
  }

  if (!disputeWindowOpen(params.order, now)) {
    return {
      ok: false,
      message:
        "The 30-minute reporting window has closed. Call the restaurant directly — they can usually fix it faster than we can.",
    };
  }

  const dispute: Dispute = {
    _id: newId(),
    orderId: params.order._id,
    orderNumber: params.order.orderNumber,
    campusId: params.order.campusId,
    restaurantId: params.order.restaurantId,
    customerId: params.customerId,
    reason: params.reason,
    note: params.note,
    photoUrls: params.photoUrls,
    status: "OPEN",
    ruling: null,
    refundAmountPaise: null,
    vendorDebitPaise: null,
    ruledBy: null,
    ruledAt: null,
    createdAt: now,
  };

  try {
    await (await db.disputes()).insertOne(dispute);
  } catch (error: unknown) {
    // One dispute per order, enforced by a unique index.
    if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11_000) {
      return { ok: false, message: "You have already reported an issue with this order." };
    }
    throw error;
  }

  const transition = await transitionOrder({
    orderId: params.order._id,
    to: ORDER_STATUS.DISPUTED,
    actor: ACTOR.STUDENT,
    actorId: params.customerId,
    requireCustomerId: params.customerId,
    reason: `${params.reason}: ${params.note || "no note"}`,
  });

  if (!transition.ok) {
    // Roll the dispute back rather than leaving an orphan in the admin queue.
    await (await db.disputes()).deleteOne({ _id: dispute._id });
    return { ok: false, message: transition.message };
  }

  return { ok: true, dispute };
}

/* ------------------------------------------------------------------ */
/* Admin queue                                                         */
/* ------------------------------------------------------------------ */

export interface DisputeWithContext {
  dispute: Dispute;
  order: Order | null;
  timeline: AuditLog[];
}

export async function listDisputes(params: {
  status?: Dispute["status"];
  campusId?: string;
  limit?: number;
}): Promise<Dispute[]> {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.campusId) filter.campusId = params.campusId;

  return (await db.disputes())
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(params.limit ?? 100)
    .toArray();
}

export async function getDisputeWithContext(disputeId: string): Promise<DisputeWithContext | null> {
  const dispute = await (await db.disputes()).findOne({ _id: disputeId });
  if (!dispute) return null;

  const [order, timeline] = await Promise.all([
    (await db.orders()).findOne({ _id: dispute.orderId }),
    getOrderTimeline(dispute.orderId),
  ]);

  return { dispute, order, timeline };
}

/* ------------------------------------------------------------------ */
/* Ruling                                                              */
/* ------------------------------------------------------------------ */

export async function ruleDispute(params: {
  disputeId: string;
  uphold: boolean;
  /** Ignored when rejecting. Capped at the order's refundable amount. */
  refundAmountPaise?: Paise | undefined;
  /** D3's sibling: what the vendor pays for it. Defaults to the refund. */
  vendorDebitPaise?: Paise | undefined;
  ruling: string;
  actorId: string;
}): Promise<{ ok: true; dispute: Dispute } | { ok: false; message: string }> {
  const disputes = await db.disputes();

  const dispute = await disputes.findOne({ _id: params.disputeId, status: "OPEN" });
  if (!dispute) return { ok: false, message: "That dispute is missing, or already ruled on." };

  const order = await (await db.orders()).findOne({ _id: dispute.orderId });
  if (!order) return { ok: false, message: "The order behind this dispute no longer exists." };

  const now = new Date();
  let refundedPaise = 0;
  let debitPaise = 0;

  if (params.uphold) {
    const requested = params.refundAmountPaise ?? order.pricing.refundableAmountPaise;
    const refund = await issueRefund({
      order,
      amountPaise: requested,
      reason: `Dispute upheld on ${order.orderNumber}: ${params.ruling}`,
      actorId: params.actorId,
    });
    if (!refund.ok) return { ok: false, message: refund.message };
    refundedPaise = refund.skipped ? 0 : refund.amountPaise;

    // The vendor carries the cost of an upheld dispute. Default it to the
    // refund so the platform is whole, and let the admin lower it when the
    // fault was genuinely shared.
    debitPaise = params.vendorDebitPaise ?? requested;
    if (debitPaise > 0) {
      await writeLedgerEntry({
        restaurantId: order.restaurantId,
        campusId: order.campusId,
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: "DISPUTE_DEBIT",
        amountPaise: -debitPaise,
        note: `Dispute upheld on ${order.orderNumber}: ${dispute.reason}`,
        createdBy: params.actorId,
      });
    }
  }

  const transition = await transitionOrder({
    orderId: order._id,
    to: params.uphold ? ORDER_STATUS.DISPUTE_UPHELD : ORDER_STATUS.DISPUTE_REJECTED,
    actor: ACTOR.ADMIN,
    actorId: params.actorId,
    reason: params.ruling,
  });
  if (!transition.ok) return { ok: false, message: transition.message };

  const updated = await disputes.findOneAndUpdate(
    { _id: dispute._id, status: "OPEN" },
    {
      $set: {
        status: params.uphold ? "UPHELD" : "REJECTED",
        ruling: params.ruling,
        refundAmountPaise: params.uphold ? refundedPaise : null,
        vendorDebitPaise: params.uphold ? debitPaise : null,
        ruledBy: params.actorId,
        ruledAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) return { ok: false, message: "That dispute changed while you were ruling on it." };
  return { ok: true, dispute: updated };
}
