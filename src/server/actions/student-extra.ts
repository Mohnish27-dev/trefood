"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import * as db from "@/server/db/collections";
import { ACTOR } from "@/lib/constants";
import { requireSession } from "@/server/auth/session";
import { getOrderForCustomer } from "@/server/services/orders";
import { resolveStockout } from "@/server/services/stockout";
import { openDispute } from "@/server/services/disputes";
import type { Dispute } from "@/types/ops";

/**
 * The two student actions that are not part of the happy path.
 *
 * Kept out of `student.ts` deliberately: that file is the ordering flow, and
 * these are the two moments where something has already gone wrong. Both
 * re-check ownership against the session rather than trusting an id from the
 * client, exactly as `placeOrder` and `confirmReceived` do.
 */

export type StudentActionState =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/* ══════════════════════════════════════════════════════════════════════
   F6 — the item that ran out mid-cook
   ══════════════════════════════════════════════════════════════════════ */

const stockoutSchema = z.object({
  orderId: z.string().min(1),
  choice: z.enum(["SUBSTITUTE", "REMOVE", "CANCEL"]),
  substituteItemId: z.string().min(1).nullable().optional(),
});

/**
 * The student's answer to a stockout.
 *
 * Three choices, five minutes, and a default of "remove it, deliver the rest"
 * if nobody answers — the least-bad outcome, because the student still eats
 * and the money for what did not arrive comes back either way.
 */
export async function resolveStockoutChoice(input: unknown): Promise<StudentActionState> {
  const parsed = stockoutSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Pick one of the three options." };

  const { user } = await requireSession();

  const order = await getOrderForCustomer(parsed.data.orderId, user._id);
  if (!order) return { status: "error", message: "That order is not yours." };

  const result = await resolveStockout({
    order,
    choice: parsed.data.choice,
    substituteItemId: parsed.data.substituteItemId ?? null,
    actor: ACTOR.STUDENT,
    actorId: user._id,
  });

  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath(`/orders/${order._id}`);

  const message =
    result.outcome.choice === "CANCEL"
      ? "Order cancelled. Your refund is on its way."
      : result.outcome.choice === "REMOVE"
        ? result.outcome.cashReducedPaise > 0
          ? "Removed. You will pay less cash at the gate."
          : "Removed. The rest is still coming, and that line is being refunded."
        : "Swapped. The rest of your order is unchanged.";

  return { status: "ok", message };
}

/**
 * The substitutes a student may pick from.
 *
 * Same restaurant, currently available, and never the item that just ran out.
 * Read here rather than passed from the client for the obvious reason: the
 * client could otherwise nominate any item on the platform.
 */
export async function listSubstitutes(
  orderId: string,
): Promise<{ itemId: string; name: string; isVeg: boolean; pricePaise: number }[]> {
  const { user } = await requireSession();

  const order = await getOrderForCustomer(orderId, user._id);
  if (!order || !order.stockout) return [];

  const items = await (await db.menuItems())
    .find({
      restaurantId: order.restaurantId,
      isAvailable: true,
      _id: { $ne: order.stockout.itemId },
    })
    .sort({ isPopular: -1, sortOrder: 1 })
    .limit(12)
    .toArray();

  return items.map((item) => ({
    itemId: item._id,
    name: item.name,
    isVeg: item.isVeg,
    pricePaise: item.pricePaise,
  }));
}

/* ══════════════════════════════════════════════════════════════════════
   Disputes — 30 minutes, photo mandatory
   ══════════════════════════════════════════════════════════════════════ */

const disputeSchema = z.object({
  orderId: z.string().min(1),
  reason: z.enum(["WRONG_ITEM", "MISSING_ITEM", "SPILLED", "COLD", "NOT_DELIVERED", "OTHER"]),
  note: z.string().trim().max(500),
  /** Already uploaded through /api/uploads, which is where the bytes are validated. */
  photoUrls: z.array(z.string().min(1)).min(1, "Add at least one photo").max(3),
});

export async function reportProblem(input: unknown): Promise<StudentActionState> {
  const parsed = disputeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Add a photo and pick what went wrong.",
    };
  }

  const { user } = await requireSession();

  const order = await getOrderForCustomer(parsed.data.orderId, user._id);
  if (!order) return { status: "error", message: "That order is not yours." };

  const result = await openDispute({
    order,
    customerId: user._id,
    reason: parsed.data.reason as Dispute["reason"],
    note: parsed.data.note,
    photoUrls: parsed.data.photoUrls,
  });

  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath(`/orders/${order._id}`);
  revalidatePath("/orders");
  return {
    status: "ok",
    message: "Reported. We will look at the photos and get back to you.",
  };
}
