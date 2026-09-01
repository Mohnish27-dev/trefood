"use client";

import { useMemo, useState } from "react";
import { Download, Lock } from "lucide-react";
import { AUDIT_ACTIONS, auditLogs, type AuditAction } from "@trefood/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The audit log viewer.
 *
 * Read-only, and visibly so. There is no edit control and no delete control anywhere
 * on this screen, because `auditLogs` is append-only in the database and a UI that
 * implied otherwise would be lying about what the system can do.
 *
 * That matters concretely: this table is the evidence when a vendor and a student
 * disagree about what happened at a gate at 1 AM. A log that could be edited would be
 * worthless for exactly the case it exists to settle.
 */
export default function AuditLogPage() {
  const [action, setAction] = useState<AuditAction | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return auditLogs
      .filter((entry) => action === "ALL" || entry.action === action)
      .filter(
        (entry) =>
          needle === "" ||
          entry.orderId?.toLowerCase().includes(needle) === true ||
          entry.actorId.toLowerCase().includes(needle) ||
          entry.reason?.toLowerCase().includes(needle) === true,
      )
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [action, query]);

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Audit log</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Lock className="size-3.5" aria-hidden />
            Append-only. Entries cannot be edited or deleted, by anyone.
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="size-4" aria-hidden />
          Export CSV
        </Button>
      </div>

      <div className="flex gap-2">
        <select
          value={action}
          onChange={(event) => setAction(event.target.value as AuditAction | "ALL")}
          aria-label="Filter by action"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="ALL">All actions</option>
          {AUDIT_ACTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by order, actor or reason"
          aria-label="Search audit log"
          className="max-w-sm"
        />
      </div>

      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-xs uppercase">
          <tr>
            <th className="py-2 text-start font-medium">When</th>
            <th className="py-2 text-start font-medium">Action</th>
            <th className="py-2 text-start font-medium">Actor</th>
            <th className="py-2 text-start font-medium">Transition</th>
            <th className="py-2 text-start font-medium">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((entry) => (
            <tr key={entry._id}>
              <td className="text-muted-foreground py-2 font-mono text-xs whitespace-nowrap">
                {new Date(entry.at).toLocaleString("en-IN")}
              </td>
              <td className="font-medium">{entry.action}</td>
              <td className="text-xs">
                {entry.actorId}
                <span className="text-muted-foreground block">{entry.actorRole}</span>
              </td>
              <td className="font-mono text-xs">
                {entry.from !== undefined && entry.to !== undefined
                  ? `${entry.from} → ${entry.to}`
                  : "—"}
              </td>
              <td className="text-muted-foreground max-w-md text-xs">
                {entry.reason ?? "—"}
                {entry.metadata !== undefined ? (
                  <span className="block font-mono">{JSON.stringify(entry.metadata)}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No entries match this filter.
        </p>
      ) : null}
    </main>
  );
}
