import type { Metadata } from "next";

import { AuditTable, type AuditRow } from "@/components/admin/audit-table";
import { requireAdmin } from "@/server/auth/session";
import { listAuditLogs } from "@/server/services/audit";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdmin();

  const logs = await listAuditLogs({ limit: 400 });

  const rows: AuditRow[] = logs.map((entry) => ({
    id: entry._id,
    at: entry.at.toISOString(),
    entity: entry.entity,
    entityId: entry.entityId,
    orderId: entry.orderId,
    from: entry.from,
    to: entry.to,
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    reason: entry.reason,
  }));

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-xl font-semibold text-bone">Audit log</h1>
        <p className="mt-1 text-sm text-muted">
          Append-only. Every state transition in the system writes one row here, and nothing
          ever edits or deletes one.
        </p>
      </header>

      <AuditTable rows={rows} />
    </>
  );
}
