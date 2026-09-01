import "server-only";

import * as db from "@/server/db/collections";
import { newId } from "@/lib/ids";
import type { Actor } from "@/lib/constants";
import type { AuditLog } from "@/types/order";

/**
 * Append-only audit trail.
 *
 * PRD Part 4.6 — every state transition writes one of these, recording actor,
 * role, from, to, reason and timestamp. There is deliberately no update and no
 * delete function in this module: the trail is the evidence in every dispute
 * and every chargeback, and an editable audit log is not an audit log.
 */

export interface AuditInput {
  entity: AuditLog["entity"];
  entityId: string;
  orderId?: string | null;
  from?: string | null;
  to: string;
  actorId?: string | null;
  actorRole: Actor;
  reason?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<AuditLog> {
  const entry: AuditLog = {
    _id: newId(),
    entity: input.entity,
    entityId: input.entityId,
    orderId: input.orderId ?? null,
    from: input.from ?? null,
    to: input.to,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole,
    reason: input.reason ?? null,
    at: new Date(),
  };

  await (await db.auditLogs()).insertOne(entry);
  return entry;
}

/** The order timeline shown to admin during a dispute ruling. */
export async function getOrderTimeline(orderId: string): Promise<AuditLog[]> {
  const logs = await db.auditLogs();
  return logs.find({ orderId }).sort({ at: 1 }).toArray();
}

export async function listAuditLogs(options: {
  entity?: AuditLog["entity"];
  actorId?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  const logs = await db.auditLogs();
  const filter: Record<string, unknown> = {};
  if (options.entity) filter.entity = options.entity;
  if (options.actorId) filter.actorId = options.actorId;
  return logs
    .find(filter)
    .sort({ at: -1 })
    .limit(options.limit ?? 100)
    .toArray();
}
