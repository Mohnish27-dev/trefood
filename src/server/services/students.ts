import "server-only";

import * as db from "@/server/db/collections";
import { ACTOR, DEFAULTS, type Actor } from "@/lib/constants";
import { writeAudit } from "./audit";
import type { User } from "@/types/user";

/**
 * Student standing — strikes and the COD block. F8 and F9.
 *
 * The rule underneath every function here: a blocked-COD student is never a
 * banned student. Someone who must prepay is a *better* customer than a lost
 * one, and prepaid orders carry zero collection risk. Nothing in this file
 * closes an account.
 *
 * Two ways to lose COD, deliberately asymmetric:
 *
 *   F8  two no-shows. Accidental, so it takes twice.
 *   F9  one refusal to pay cash at the gate. Deliberate, so it takes once.
 */

export interface StrikeResult {
  user: User;
  codBlockedNow: boolean;
}

export async function recordStrike(params: {
  userId: string;
  orderId: string;
  orderNumber: string;
  reason: "NO_SHOW_COD" | "REFUSED_PAYMENT";
  actor: Actor;
  actorId?: string | null;
}): Promise<StrikeResult | null> {
  const users = await db.users();

  const user = await users.findOne({ _id: params.userId });
  if (!user) return null;

  const strikes = user.strikes + 1;
  // F9 is immediate; F8 needs the threshold. Both are recorded as strikes so
  // the account page and the admin queue tell the same story.
  const blockNow =
    params.reason === "REFUSED_PAYMENT" || strikes >= DEFAULTS.codStrikeThreshold;

  const codBlockedReason = blockNow
    ? params.reason === "REFUSED_PAYMENT"
      ? `Refused to pay cash on delivery for ${params.orderNumber}`
      : `${strikes} orders were not collected at the gate, including ${params.orderNumber}`
    : user.codBlockedReason;

  const updated = await users.findOneAndUpdate(
    { _id: params.userId },
    {
      $set: {
        strikes,
        codBlocked: user.codBlocked || blockNow,
        codBlockedReason: codBlockedReason ?? null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) return null;

  await writeAudit({
    entity: "USER",
    entityId: updated._id,
    orderId: params.orderId,
    from: `strikes:${user.strikes}`,
    to: `strikes:${strikes}${blockNow ? " codBlocked" : ""}`,
    actorId: params.actorId ?? null,
    actorRole: params.actor,
    reason: `${params.reason} on ${params.orderNumber}`,
  });

  return { user: updated, codBlockedNow: blockNow && !user.codBlocked };
}

/** Admin override, both directions. Unblocking is as important as blocking. */
export async function setCodBlocked(params: {
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
        codBlocked: params.blocked,
        codBlockedReason: params.blocked ? params.reason : null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (updated) {
    await writeAudit({
      entity: "USER",
      entityId: updated._id,
      from: before.codBlocked ? "codBlocked" : "codAllowed",
      to: params.blocked ? "codBlocked" : "codAllowed",
      actorId: params.actorId,
      actorRole: ACTOR.ADMIN,
      reason: params.reason,
    });
  }

  return updated;
}

/** Clearing strikes is how a student earns COD back after a bad fortnight. */
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

/** The admin student list. Counts come from orders, never from a denormalised field. */
export async function listStudents(params: {
  campusId?: string;
  query?: string;
  codBlockedOnly?: boolean;
  limit?: number;
}): Promise<StudentRow[]> {
  const filter: Record<string, unknown> = { role: "STUDENT" };
  if (params.campusId) filter.campusId = params.campusId;
  if (params.codBlockedOnly === true) filter.codBlocked = true;
  if (params.query) {
    const escaped = params.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { phone: { $regex: escaped, $options: "i" } },
    ];
  }

  const users = await (await db.users())
    .find(filter)
    .sort({ strikes: -1, name: 1 })
    .limit(params.limit ?? 100)
    .toArray();

  if (users.length === 0) return [];

  const orders = await (await db.orders())
    .find({ customerId: { $in: users.map((u) => u._id) } })
    .project<{ customerId: string; status: string; timestamps: { createdAt: Date } }>({
      customerId: 1,
      status: 1,
      "timestamps.createdAt": 1,
    })
    .toArray();

  return users.map((user) => {
    const mine = orders.filter((o) => o.customerId === user._id);
    const lastOrderAt = mine.reduce<Date | null>((latest, o) => {
      const at = o.timestamps.createdAt;
      return latest === null || at > latest ? at : latest;
    }, null);

    return {
      user,
      orderCount: mine.length,
      noShowCount: mine.filter((o) => o.status === "NO_SHOW").length,
      lastOrderAt,
    };
  });
}
