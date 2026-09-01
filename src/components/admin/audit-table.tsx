"use client";

import { Download, FileClock } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/states";

export interface AuditRow {
  id: string;
  at: string;
  entity: string;
  entityId: string;
  orderId: string | null;
  from: string | null;
  to: string;
  actorId: string | null;
  actorRole: string;
  reason: string | null;
}

const ENTITIES = ["ORDER", "RESTAURANT", "CAMPUS", "USER", "SETTLEMENT", "DISPUTE"] as const;

/**
 * The audit log viewer.
 *
 * Append-only, and there is deliberately no edit or delete control anywhere on
 * this screen — an editable audit log is not an audit log. This is the
 * evidence in every dispute and every chargeback, so the only two verbs it
 * supports are filter and export.
 *
 * Filtering happens client-side over the last few hundred entries, which is
 * the right trade at campus volume: an admin scanning for "what happened to
 * TRF-NITP-0042" wants instant narrowing, not a round trip per keystroke.
 */
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [entity, setEntity] = useState("");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (entity !== "" && row.entity !== entity) return false;
    if (needle.length === 0) return true;
    return (
      row.entityId.toLowerCase().includes(needle) ||
      row.to.toLowerCase().includes(needle) ||
      (row.from ?? "").toLowerCase().includes(needle) ||
      (row.reason ?? "").toLowerCase().includes(needle) ||
      (row.actorId ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select value={entity} onChange={(event) => setEntity(event.target.value)}>
            <option value="">Everything</option>
            {ENTITIES.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </Select>
        </div>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by id, status or reason"
          className="max-w-sm"
          aria-label="Filter the audit log"
        />

        <span className="text-sm text-muted">
          {filtered.length} of {rows.length}
        </span>

        <Button
          variant="secondary"
          className="ml-auto"
          disabled={filtered.length === 0}
          onClick={() => downloadCsv(filtered)}
        >
          <Download />
          Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileClock}
            title="Nothing matches"
            description="Every state transition in the system lands here. Widen the filter to see them."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>When</TH>
              <TH>Entity</TH>
              <TH>Transition</TH>
              <TH>Actor</TH>
              <TH>Reason</TH>
            </tr>
          </THead>
          <TBody>
            {filtered.map((row) => (
              <TR key={row.id}>
                <TD className="whitespace-nowrap tabular text-muted">
                  {new Date(row.at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </TD>
                <TD>
                  <Badge tone="neutral">{row.entity.toLowerCase()}</Badge>
                  <p className="mt-1 max-w-40 truncate font-mono text-[10px] text-faint">
                    {row.entityId}
                  </p>
                </TD>
                <TD className="whitespace-nowrap">
                  {row.from ? <span className="text-faint">{row.from} → </span> : null}
                  <span className="font-medium">{row.to}</span>
                </TD>
                <TD>
                  <p className="text-xs">{row.actorRole}</p>
                  {row.actorId ? (
                    <p className="mt-0.5 max-w-32 truncate font-mono text-[10px] text-faint">
                      {row.actorId}
                    </p>
                  ) : null}
                </TD>
                <TD className="max-w-96 text-xs text-muted">{row.reason ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function downloadCsv(rows: AuditRow[]): void {
  const header = ["at", "entity", "entityId", "orderId", "from", "to", "actorRole", "actorId", "reason"];
  const body = rows.map((row) =>
    [
      row.at,
      row.entity,
      row.entityId,
      row.orderId ?? "",
      row.from ?? "",
      row.to,
      row.actorRole,
      row.actorId ?? "",
      quote(row.reason ?? ""),
    ].join(","),
  );

  const blob = new Blob([[header.join(","), ...body].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `trefood-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
