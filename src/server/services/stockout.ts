import "server-only";

import * as db from "@/server/db/collections";
import { ACTOR, DEFAULTS, ORDER_STATUS } from "@/lib/constants";
import { ceilRupeeOfBps, type Paise } from "@/lib/money";
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
 * default, because the student still eats and is never charged for the part
 * that did not arrive, without anyone having to wait.
 *
 * Price rule, from the failures doc: a cheaper substitute costs the student
 * less; a dearer one is absorbed by the vendor. TREFOOD never charges more
 * than the student agreed to at checkout.
 *
 * Cash on delivery makes this far simpler than it used to be. No money has
 * moved yet, so a shortfall is not a refund — it is just a smaller number for
 * the rider to collect at the gate.
 *
 * The frozen `pricing` block is never rewritten here. A price is fixed at
 * creation (MONEY rule 5); what changes is `payment.cashDuePaise`, plus a
 * ledger credit for the commission on food that never arrived — recorded
 * alongside the price, never over it.
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
  /** How much less cash the rider now collects at the gate. */
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

  const outcome: StockoutOutcome = {
    choice: params.choice,
    cashReducedPaise: 0,
    cancelled: false,
  };

  /* --- Cancel the whole order ------------------------------------- */

  if (params.choice === "CANCEL") {
    // Nothing to unwind. The student never paid, so cancelling costs them
    // nothing and owes them nothing.
    const transition = await transitionOrder({
      orderId: order._id,
      to: ORDER_STATUS.CANCELLED_BY_ADMIN,
      // The FSM's SYSTEM actor, not STUDENT: this is a platform cancellation
      // caused by the kitchen. Nothing is owed in either direction, and D1 is
      // untouched because this is vendor fault rather than change of mind.
      actor: ACTOR.SYSTEM,
      actorId: params.actorId ?? null,
      reason: `${stockout.itemName} ran out; student chose to cancel (F6)`,
    });
    if (!transition.ok) return { ok: false, message: transition.message };

    outcome.cancelled = true;
  }

  /* --- Remove the line, deliver the rest --------------------------- */

  if (params.choice === "REMOVE") {
    outcome.cashReducedPaise = await reduceCashDue({
      order,
      byPaise: line.lineTotalPaise,
      note: `${stockout.itemName} not delivered on ${order.orderNumber}`,
      actorId: params.actorId ?? null,
    });

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

    if (differencePerUnit > 0) {
      outcome.cashReducedPaise = await reduceCashDue({
        order,
        byPaise: differencePerUnit * line.quantity,
        note: `Swapped ${stockout.itemName} for a cheaper ${substitute.name} on ${order.orderNumber}`,
        actorId: params.actorId ?? null,
      });
    }
    // A dearer substitute is absorbed by the vendor. The student pays what
    // they agreed to and not a rupee more.

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
 * Collect less at the gate, and bill us less for it.
 *
 * Two things have to move together or the vendor is charged for a sale they
 * did not make. The cash the rider collects drops by the shortfall, and the
 * commission frozen on the order — which was computed on a base that included
 * this food — is credited back by the same rate.
 *
 * The credit is a ledger entry rather than an edit to `pricing`, because the
 * price block is immutable once written (MONEY rule 5). The vendor sees the
 * line on their statement, which is the honest way to show it: they were
 * billed for the whole order, and then credited for the part of it that never
 * left the kitchen.
 */
async function reduceCashDue(params: {
  order: Order;
  byPaise: Paise;
  note: string;
  actorId: string | null;
}): Promise<Paise> {
  const { order } = params;
  const reduced = Math.max(0, order.payment.cashDuePaise - params.byPaise);
  const actualReductionPaise = order.payment.cashDuePaise - reduced;
  if (actualReductionPaise === 0) return 0;

  await (await db.orders()).updateOne(
    { _id: order._id },
    { $set: { "payment.cashDuePaise": reduced } },
  );

  const commissionCreditPaise = ceilRupeeOfBps(
    actualReductionPaise,
    order.pricing.commissionBps,
  );

  if (commissionCreditPaise > 0) {
    await writeLedgerEntry({
      restaurantId: order.restaurantId,
      campusId: order.campusId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: "STOCKOUT_CREDIT",
      // Negative: it reduces what the vendor owes us.
      amountPaise: -commissionCreditPaise,
      note: params.note,
      createdBy: params.actorId,
    });
  }

  return actualReductionPaise;
}

/**
 * The five-minute timer, fired by the sweep.
 *
 * "Remove it, deliver the rest" is the automatic choice because it is the only
 * one that cannot make things worse: the student still eats, and they are
 * never asked for cash for the part that did not arrive.
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
