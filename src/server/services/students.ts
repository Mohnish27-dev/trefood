import "server-only";

import * as db from "@/server/db/collections";
import { ACTOR, CUSTOMER_VISIBLE_STATUSES, DEFAULTS, type Actor } from "@/lib/constants";
import { writeAudit } from "./audit";
import type { User } from "@/types/user";

/**
 * Student standing — strikes, and the block only a human can apply. F8 and F9.
 *
 * Every order is cash on delivery, which changes what a strike can mean. There
 * is no "make them prepay instead" any more: blocking is banning. So strikes
 * accumulate, and they surface the account on the admin queue, but they never
 * stop an order on their own. A person decides whether someone has run out of
 * chances, and that person can see the whole history when they do.
 *
 * Two things earn a strike, and the counter does not distinguish them:
 *
 *   F8  a no-show at the gate. Usually accidental.
 *   F9  refusing to pay the cash. Rarely accidental.
 *
 * The vendor absorbs the cost of both — they cooked the food and carried it —
 * which is exactly why the record has to be good enough for an admin to act on.
 */

export interface StrikeResult {
  user: User;
  /** True once the count crosses the alert threshold. Flags, never blocks. */
  needsReview: boolean;
}

export async function recordStrike(params: {
  userId: string;
  orderId: string;
  orderNumber: string;
  reason: "NO_SHOW" | "REFUSED_PAYMENT";
  actor: Actor;
  actorId?: string | null;
}): Promise<StrikeResult | null> {
  const users = await db.users();

  const user = await users.findOne({ _id: params.userId });
  if (!user) return null;

  const strikes = user.strikes + 1;
  const needsReview = strikes >= DEFAULTS.strikeAlertThreshold;

  const updated = await users.findOneAndUpdate(
    { _id: params.userId },
    { $set: { strikes, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!updated) return null;

  await writeAudit({
    entity: "USER",
    entityId: updated._id,
    orderId: params.orderId,
    from: `strikes:${user.strikes}`,
    to: `strikes:${strikes}${needsReview ? " needsReview" : ""}`,
    actorId: params.actorId ?? null,
    actorRole: params.actor,
    reason: `${params.reason} on ${params.orderNumber}`,
  });

  return { user: updated, needsReview };
}

/**
 * Admin override, both directions. This is the ONLY thing that stops a student
 * ordering, and unblocking matters as much as blocking: it is the way back.
 */
export async function setOrdersBlocked(params: {
  userId: string;
  blocked: boolean;
  reason: string;
  actorId: string;
}): Promise<User | null> {
  const users = await db.users();
  const before = await users.findOne({ _id: params.userId });
  if (!before) return null;

  const updated = await users.findOneAndUpdate(
    { _id: params.userId },
    {
      $set: {
        ordersBlocked: params.blocked,
        ordersBlockedReason: params.blocked ? params.reason : null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (updated) {
    await writeAudit({
      entity: "USER",
      entityId: updated._id,
      from: before.ordersBlocked ? "ordersBlocked" : "ordersAllowed",
      to: params.blocked ? "ordersBlocked" : "ordersAllowed",
      actorId: params.actorId,
      actorRole: ACTOR.ADMIN,
      reason: params.reason,
    });
  }

  return updated;
}

/** Clearing strikes is how a student gets a clean slate after a bad fortnight. */
export async function clearStrikes(params: {
  userId: string;
  actorId: string;
  reason: string;
}): Promise<User | null> {
  const users = await db.users();
  const updated = await users.findOneAndUpdate(
    { _id: params.userId },
    { $set: { strikes: 0, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (updated) {
    await writeAudit({
      entity: "USER",
      entityId: updated._id,
      from: "strikes",
      to: "strikes:0",
      actorId: params.actorId,
      actorRole: ACTOR.ADMIN,
      reason: params.reason,
    });
  }

  return updated;
}

export interface StudentRow {
  user: User;
  orderCount: number;
  noShowCount: number;
  lastOrderAt: Date | null;
}

export interface StudentList {
  rows: StudentRow[];
  /** Every student matching the filter, not just the ones returned. */
  total: number;
}

/**
 * The admin student list. Counts come from orders, never from a denormalised field.
 * No limit by default — a truncated list hides students from search, which only
 * runs over what was loaded.
 */
export async function listStudents(params: {
  campusId?: string;
  query?: string;
  blockedOnly?: boolean;
  limit?: number;
}): Promise<StudentList> {
  const filter: Record<string, unknown> = { role: "STUDENT" };
  if (params.campusId) filter.campusId = params.campusId;
  if (params.blockedOnly === true) filter.ordersBlocked = true;
  if (params.query) {
    const escaped = params.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { phone: { $regex: escaped, $options: "i" } },
    ];
  }

  const usersColl = await db.users();
  let cursor = usersColl.find(filter).sort({ strikes: -1, name: 1 });
  if (params.limit !== undefined) cursor = cursor.limit(params.limit);

  const [users, total] = await Promise.all([
    cursor.toArray(),
    usersColl.countDocuments(filter),
  ]);

  if (users.length === 0) return { rows: [], total };

  // Grouped in the database: pulling every order into memory and filtering it
  // per student is quadratic, and the list is no longer capped.
  const stats = await (await db.orders())
    .aggregate<{ _id: string; orderCount: number; noShowCount: number; lastOrderAt: Date }>([
      {
        $match: {
          customerId: { $in: users.map((u) => u._id) },
          status: { $in: [...CUSTOMER_VISIBLE_STATUSES] },
        },
      },
      {
        $group: {
          _id: "$customerId",
          orderCount: { $sum: 1 },
          noShowCount: { $sum: { $cond: [{ $eq: ["$status", "NO_SHOW"] }, 1, 0] } },
          lastOrderAt: { $max: "$timestamps.createdAt" },
        },
      },
    ])
    .toArray();

  const statsByUser = new Map(stats.map((s) => [s._id, s]));

  const rows = users.map((user) => {
    const mine = statsByUser.get(user._id);
    return {
      user,
      orderCount: mine?.orderCount ?? 0,
      noShowCount: mine?.noShowCount ?? 0,
      lastOrderAt: mine?.lastOrderAt ?? null,
    };
  });

  return { rows, total };
}
