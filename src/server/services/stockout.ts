import "server-only";

import * as db from "@/server/db/collections";
import { ACTOR, DEFAULTS, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/constants";
import type { Paise } from "@/lib/money";
import { issueRefund } from "./refunds";
import { writeLedgerEntry } from "./ledger";
import { transitionOrder } from "./orders";
import { writeAudit } from "./audit";
import type { Order, StockoutResolution } from "@/types/order";

/**
 * F6 — an ingredient runs out after the order was accepted.
 *
 * The vendor 86s the item, which does two separate things:
 *   (a) hides it from every FUTURE order, instantly — that is a menu edit
 *   (b) opens THIS resolution flow for every order already in the kitchen
 *
 * The student then gets a blocking three-choice screen with a five-minute
 * timer. No answer means "remove it, deliver the rest" — the least-bad
 * default, because it gets the student both their food and their money back
 * without anyone waiting.
 *
 * Price rule, from the failures doc: a cheaper substitute refunds the
 * difference; a dearer one is absorbed by the vendor. TREFOOD never charges a
 * second time. Collecting an incremental 20 rupees mid-order needs a whole
 * second gateway flow that would fail more often than it works.
 *
 * The frozen `pricing` block is never rewritten here. A price is fixed at
 * creation (MONEY rule 5); what changes is what gets refunded, what cash the
 * rider collects, and what the vendor is owed — all recorded alongside it.
 */

export type StockoutChoice = NonNullable<StockoutResolution["choice"]>;

/* ------------------------------------------------------------------ */
/* Raising                                                             */
/* ------------------------------------------------------------------ */

export async function raiseStockout(params: {
  order: Order;
  itemId: string;
  now?: Date;
}): Promise<{ ok: true; order: Order } | { ok: false; message: string }> {
  const now = params.now ?? new Date();
  const line = params.order.items.find((item) => item.itemId === params.itemId);
  if (!line) return { ok: false, message: "That item is not on this order." };

  if (params.order.stockout && params.order.stockout.resolvedAt === null) {
    return { ok: false, message: "This order already has an unresolved stockout." };
  }

  const stockout: StockoutResolution = {
    itemId: line.itemId,
    itemName: line.name,
    raisedAt: now,
    expiresAt: new Date(now.getTime() + DEFAULTS.stockoutResolutionSeconds * 1_000),
    choice: null,
    substituteItemId: null,
    resolvedAt: null,
    autoResolved: false,
  };

  const updated = await (await db.orders()).findOneAndUpdate(
    { _id: params.order._id, status: { $in: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING] } },
    { $set: { stockout } },
    { returnDocument: "after" },
  );

  if (!updated) {
    return {
      ok: false,
      message: "This order has moved past the kitchen. Call the student instead.",
    };
  }

  await writeAudit({
    entity: "ORDER",
    entityId: updated._id,
    orderId: updated._id,
    from: updated.status,
    to: updated.status,
    actorId: null,
    actorRole: ACTOR.VENDOR,
    reason: `F6 stockout raised on ${line.name}`,
  });

  return { ok: true, order: updated };
}

/* ------------------------------------------------------------------ */
/* Resolving                                                           */
/* ------------------------------------------------------------------ */

export interface StockoutOutcome {
  choice: StockoutChoice;
  /** Money returned to the gateway, in paise. Zero for COD, which reduces cash instead. */
  refundedPaise: Paise;
  /** COD only: how much less cash the rider now collects. */
  cashReducedPaise: Paise;
  cancelled: boolean;
}

export async function resolveStockout(params: {
  order: Order;
  choice: StockoutChoice;
  substituteItemId?: string | null;
  actor: typeof ACTOR.STUDENT | typeof ACTOR.SYSTEM;
  actorId?: string | null;
  now?: Date;
}): Promise<{ ok: true; outcome: StockoutOutcome } | { ok: false; message: string }> {
  const { order } = params;
  const now = params.now ?? new Date();
  const stockout = order.stockout;

  if (!stockout || stockout.resolvedAt !== null) {
    return { ok: false, message: "There is nothing waiting on you for this order." };
  }

  const line = order.items.find((item) => item.itemId === stockout.itemId);
  if (!line) return { ok: false, message: "That item is no longer on this order." };

  const orders = await db.orders();
  const isCod = order.payment.method === PAYMENT_METHOD.HYBRID_COD;

  const outcome: StockoutOutcome = {
    choice: params.choice,
    refundedPaise: 0,
    cashReducedPaise: 0,
    cancelled: false,
  };

  /* --- Cancel the whole order ------------------------------------- */

  if (params.choice === "CANCEL") {
    const refund = await issueRefund({
      order,
      reason: `Student cancelled after ${stockout.itemName} ran out (F6)`,
      actorId: params.actorId ?? null,
    });
    if (!refund.ok) return { ok: false, message: refund.message };

    const transition = await transitionOrder({
      orderId: order._id,
      to: ORDER_STATUS.CANCELLED_BY_ADMIN,
      // The FSM's SYSTEM actor, not STUDENT: this is a platform cancellation
      // caused by the kitchen, which is why it carries a full refund and does
      // not violate D1.
      actor: ACTOR.SYSTEM,
      actorId: params.actorId ?? null,
      reason: `${stockout.itemName} ran out; student chose to cancel (F6)`,
    });
    if (!transition.ok) return { ok: false, message: transition.message };

    outcome.refundedPaise = refund.skipped ? 0 : refund.amountPaise;
    outcome.cancelled = true;
  }

  /* --- Remove the line, deliver the rest --------------------------- */

  if (params.choice === "REMOVE") {
    const shortfall = line.lineTotalPaise;

    if (isCod) {
      // No online money to return: the rider simply collects less at the gate.
      // The creation-time invariant `cashDue === vendorReceivable` described a
      // full delivery; this order is no longer one, and charging cash for food
      // that never arrives would be the actual violation.
      const reduced = Math.max(0, order.payment.cashDueOnDeliveryPaise - shortfall);
      outcome.cashReducedPaise = order.payment.cashDueOnDeliveryPaise - reduced;
      await orders.updateOne(
        { _id: order._id },
        { $set: { "payment.cashDueOnDeliveryPaise": reduced } },
      );
    } else {
      const refund = await issueRefund({
        order,
        amountPaise: shortfall,
        reason: `${stockout.itemName} was unavailable and removed (F6)`,
        actorId: params.actorId ?? null,
      });
      if (!refund.ok) return { ok: false, message: refund.message };
      outcome.refundedPaise = refund.skipped ? 0 : refund.amountPaise;

      // The platform refunded food the vendor never cooked, out of money it is
      // holding on the vendor's behalf. Without this debit TREFOOD absorbs a
      // kitchen shortfall, which is neither fair nor sustainable.
      if (outcome.refundedPaise > 0) {
        await writeLedgerEntry({
          restaurantId: order.restaurantId,
          campusId: order.campusId,
          orderId: order._id,
          orderNumber: order.orderNumber,
          type: "STOCKOUT_SHORTFALL",
          amountPaise: -outcome.refundedPaise,
          note: `${stockout.itemName} not delivered on ${order.orderNumber}`,
          createdBy: params.actorId ?? null,
        });
      }
    }

    await orders.updateOne(
      { _id: order._id, "items.itemId": line.itemId },
      { $set: { "items.$.name": `${line.name} (not delivered)` } },
    );
  }

  /* --- Swap for something else ------------------------------------- */

  if (params.choice === "SUBSTITUTE") {
    const substituteId = params.substituteItemId ?? null;
    if (!substituteId) return { ok: false, message: "Pick something to swap it for." };

    const substitute = await (await db.menuItems()).findOne({
      _id: substituteId,
      restaurantId: order.restaurantId,
      isAvailable: true,
    });
    if (!substitute) return { ok: false, message: "That swap is no longer available." };

    // Per-unit comparison, because the line may be for several portions.
    const originalPerUnit = line.unitPricePaise;
    const differencePerUnit = originalPerUnit - substitute.pricePaise;

    if (differencePerUnit > 0 && !isCod) {
      const refund = await issueRefund({
        order,
        amountPaise: differencePerUnit * line.quantity,
        reason: `Swapped ${stockout.itemName} for ${substitute.name} (F6)`,
        actorId: params.actorId ?? null,
        // Not a vendor fault worth a second debit — they are still cooking
        // and still delivering. The gateway fee on a few rupees is noise.
        recoverGatewayFeeFromVendor: false,
      });
      if (!refund.ok) return { ok: false, message: refund.message };
      outcome.refundedPaise = refund.skipped ? 0 : refund.amountPaise;
    } else if (differencePerUnit > 0 && isCod) {
      const reduce = differencePerUnit * line.quantity;
      const reduced = Math.max(0, order.payment.cashDueOnDeliveryPaise - reduce);
      outcome.cashReducedPaise = order.payment.cashDueOnDeliveryPaise - reduced;
      await orders.updateOne(
        { _id: order._id },
        { $set: { "payment.cashDueOnDeliveryPaise": reduced } },
      );
    }
    // A dearer substitute is absorbed by the vendor. Nothing to charge, and
    // deliberately no second payment flow.

    await orders.updateOne(
      { _id: order._id, "items.itemId": line.itemId },
      {
        $set: {
          "items.$.name": `${substitute.name} (swapped for ${line.name})`,
          "items.$.isVeg": substitute.isVeg,
        },
      },
    );
  }

  await orders.updateOne(
    { _id: order._id },
    {
      $set: {
        "stockout.choice": params.choice,
        "stockout.substituteItemId": params.substituteItemId ?? null,
        "stockout.resolvedAt": now,
        "stockout.autoResolved": params.actor === ACTOR.SYSTEM,
      },
    },
  );

  await writeAudit({
    entity: "ORDER",
    entityId: order._id,
    orderId: order._id,
    from: order.status,
    to: outcome.cancelled ? ORDER_STATUS.CANCELLED_BY_ADMIN : order.status,
    actorId: params.actorId ?? null,
    actorRole: params.actor,
    reason:
      `F6 ${params.choice} on ${stockout.itemName}` +
      (params.actor === ACTOR.SYSTEM ? " (auto-resolved on timeout)" : ""),
  });

  return { ok: true, outcome };
}

/**
 * The five-minute timer, fired by the sweep.
 *
 * "Remove it, deliver the rest" is the automatic choice because it is the only
 * one that cannot make things worse: the student still eats, and the money for
 * what did not arrive comes back without anyone having to ask.
 */
export async function autoResolveExpiredStockouts(now: Date = new Date()): Promise<number> {
  const pending = await (await db.orders())
    .find({
      "stockout.resolvedAt": null,
      "stockout.expiresAt": { $lte: now },
      status: { $in: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY] },
    })
    .limit(50)
    .toArray();

  let resolved = 0;
  for (const order of pending) {
    const result = await resolveStockout({
      order,
      choice: "REMOVE",
      actor: ACTOR.SYSTEM,
      actorId: null,
      now,
    });
    if (result.ok) resolved += 1;
  }
  return resolved;
}
