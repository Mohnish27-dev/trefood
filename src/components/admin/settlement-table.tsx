"use client";

import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { markCollected, runSettlementNow } from "@/server/actions/admin";
import { formatCampusDate, shiftCampusDate } from "@/lib/campus-time";
import { formatINRPlain } from "@/lib/money";

export interface StatementRow {
  /**
   * STATEMENT — the immutable invoice for the day exists.
   * PREVIEW   — nobody has run the day yet; figures are live from delivered
   *             orders and nothing can be collected against them.
   */
  kind: "STATEMENT" | "PREVIEW";
  statementId: string | null;
  restaurantId: string;
  restaurantName: string;
  /** So the admin can call them without leaving the screen. */
  contactPhone: string;
  cashCollectedPaise: number;
  commissionDuePaise: number;
  adjustmentsPaise: number;
  openingBalancePaise: number;
  netDuePaise: number;
  carriedForwardPaise: number;
  orderCount: number;
  status: "PENDING" | "PAID";
  collectionMethod: "CASH" | "UPI" | "BANK_TRANSFER" | null;
  paymentReference: string | null;
}

export interface CampusOption {
  campusId: string;
  name: string;
}

type CollectionMethod = NonNullable<StatementRow["collectionMethod"]>;

const METHOD_LABEL: Record<CollectionMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
};

/**
 * Commission collections.
 *
 * ★ MONEY COMES IN ON THIS SCREEN. IT DOES NOT GO OUT. ★
 *
 * Every order is cash on delivery, so the vendor's own staff came back from
 * every gate holding the full bill. TREFOOD never touched it. Pick a day, see
 * what each kitchen collected and the commission they owe on it, run the day
 * to lock the invoice, and stamp each row as the money arrives.
 *
 * Campus and day live in the URL, so changing either reloads the rows from the
 * server. Re-running a day is safe: the unique index on
 * `(restaurantId, statementDate)` makes the second run a no-op.
 */
export function SettlementTable({
  rows,
  campuses,
  selectedCampusId,
  selectedDate,
  todayDate,
}: {
  rows: StatementRow[];
  campuses: CampusOption[];
  selectedCampusId: string;
  selectedDate: string;
  todayDate: string;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [running, setRunning] = useState(false);

  const go = (next: { campus?: string; date?: string }): void => {
    const params = new URLSearchParams();
    const campus = next.campus ?? selectedCampusId;
    const date = next.date ?? selectedDate;
    if (campus !== "") params.set("campus", campus);
    if (date !== "") params.set("date", date);
    startNavigation(() => router.push(`/admin/settlements?${params.toString()}`));
  };

  const run = async (): Promise<void> => {
    setRunning(true);
    const result = await runSettlementNow({
      campusId: selectedCampusId,
      statementDate: selectedDate,
    });
    setRunning(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  };

  const dayIsOver = selectedDate !== "" && selectedDate < todayDate;
  const previewRows = rows.filter((row) => row.kind === "PREVIEW");
  const unbilledOrders = previewRows.reduce((total, row) => total + row.orderCount, 0);
  const statements = rows.filter((row) => row.kind === "STATEMENT");

  const totals = {
    cash: sum(rows, (row) => row.cashCollectedPaise),
    commission: sum(rows, (row) => row.commissionDuePaise),
    collected: sum(
      statements.filter((row) => row.status === "PAID"),
      (row) => row.netDuePaise,
    ),
    pending: sum(
      statements.filter((row) => row.status === "PENDING"),
      (row) => row.netDuePaise,
    ),
  };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44">
            <Label htmlFor="settle-campus">Campus</Label>
            <Select
              id="settle-campus"
              value={selectedCampusId}
              disabled={campuses.length === 0}
              onChange={(event) => go({ campus: event.target.value })}
            >
              {campuses.map((campus) => (
                <option key={campus.campusId} value={campus.campusId}>
                  {campus.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="settle-date">Day</Label>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Previous day"
                disabled={selectedDate === ""}
                onClick={() => go({ date: shiftCampusDate(selectedDate, -1) })}
              >
                <ChevronLeft />
              </Button>
              <Input
                id="settle-date"
                type="date"
                className="w-40"
                value={selectedDate}
                max={todayDate || undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value <= todayDate) {
                    go({ date: value });
                  }
                }}
              />
              <Button
                variant="secondary"
                size="icon"
                aria-label="Next day"
                disabled={selectedDate === "" || selectedDate >= todayDate}
                onClick={() => go({ date: shiftCampusDate(selectedDate, 1) })}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          <Button
            disabled={running || navigating || !dayIsOver || previewRows.length === 0}
            onClick={() => void run()}
            title={
              !dayIsOver
                ? "A day can be invoiced once it is over"
                : previewRows.length === 0
                  ? "Every restaurant already has a statement for this day"
                  : undefined
            }
          >
            {running ? <Loader2 className="animate-spin" /> : <PlayCircle />}
            Run statements
          </Button>

          {rows.length > 0 ? (
            <Button variant="secondary" onClick={() => downloadCsv(rows, selectedDate)}>
              <Download />
              Download CSV
            </Button>
          ) : null}

          {navigating ? <Loader2 className="size-4 animate-spin text-muted" /> : null}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <Total label="Cash collected" paise={totals.cash} />
          <Total label="Commission" paise={totals.commission} />
          <Total label="Collected" paise={totals.collected} tone="text-mint" />
          <Total label="Pending" paise={totals.pending} tone="text-amber" />
        </dl>
      </Card>

      {previewRows.length > 0 && selectedDate !== "" ? (
        <Notice>
          {!dayIsOver ? (
            <>
              <strong className="text-bone">{formatCampusDate(selectedDate)} is still going.</strong>{" "}
              Rows marked “Not invoiced” are live figures from delivered orders and will keep
              changing. Run this day&apos;s statements tomorrow to lock them in and start
              collecting.
            </>
          ) : (
            <>
              <strong className="text-bone">
                {previewRows.length} restaurant{previewRows.length === 1 ? " has" : "s have"} no
                statement for this day
              </strong>
              {unbilledOrders > 0
                ? ` (${unbilledOrders} delivered order${unbilledOrders === 1 ? "" : "s"} not invoiced yet)`
                : ""}
              . Press <strong className="text-bone">Run statements</strong> to lock the figures
              in; then each row can be marked collected.
            </>
          )}
        </Notice>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Banknote}
            title={campuses.length === 0 ? "No campuses yet" : "No restaurants on this campus"}
            description="Collections appear here once a campus has restaurants taking orders."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Restaurant</TH>
              <TH>Phone</TH>
              <TH className="text-right">Cash collected</TH>
              <TH className="text-right">Commission</TH>
              <TH className="text-right">Owes us</TH>
              <TH>Status</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.statementId ?? `preview-${row.restaurantId}`}>
                <TD>
                  <p className="font-medium">{row.restaurantName}</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {row.orderCount} order{row.orderCount === 1 ? "" : "s"} delivered
                  </p>
                </TD>
                <TD className="whitespace-nowrap text-xs text-muted">
                  {row.contactPhone ? (
                    <a href={`tel:${row.contactPhone}`} className="hover:text-saffron">
                      {row.contactPhone}
                    </a>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </TD>
                <TD className="text-right text-muted">
                  <Money paise={row.cashCollectedPaise} exact />
                </TD>
                <TD className="text-right">
                  <Money paise={row.commissionDuePaise} exact />
                </TD>
                <TD className="text-right">
                  <OwesCell row={row} />
                </TD>
                <TD>
                  <StatusCell row={row} />
                </TD>
                <TD className="text-right">
                  {row.kind === "STATEMENT" &&
                  row.status === "PENDING" &&
                  row.netDuePaise > 0 &&
                  row.statementId !== null ? (
                    <MarkCollectedDialog row={row} statementId={row.statementId} />
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Total({ label, paise, tone }: { label: string; paise: number; tone?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${tone ?? "text-bone"}`}>
        <Money paise={paise} exact />
      </dd>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-sky/30 bg-sky-wash px-4 py-3 text-sm text-muted">
      <Info className="mt-0.5 size-4 shrink-0 text-sky" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

/**
 * The amount to collect, with whatever moved it away from the plain commission
 * spelled out underneath — a vendor on the phone asks why, every time.
 */
function OwesCell({ row }: { row: StatementRow }) {
  if (row.kind === "PREVIEW") return <span className="text-faint">—</span>;

  const notes: { key: string; paise: number; label: string }[] = [
    { key: "opening", paise: row.openingBalancePaise, label: "from earlier" },
    { key: "adjustments", paise: row.adjustmentsPaise, label: "adjustments" },
    { key: "carried", paise: row.carriedForwardPaise, label: "to next day" },
  ].filter((note) => note.paise !== 0);

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <Money paise={row.netDuePaise} exact className="font-semibold" />
      {notes.map((note) => (
        <span key={note.key} className="text-[10px] text-faint">
          <Signed paise={note.paise} /> {note.label}
        </span>
      ))}
    </span>
  );
}

function StatusCell({ row }: { row: StatementRow }) {
  if (row.kind === "PREVIEW") {
    return <Badge tone="neutral">Not invoiced</Badge>;
  }

  if (row.status === "PAID") {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Badge tone="success">Collected</Badge>
        {row.collectionMethod || row.paymentReference ? (
          <span className="font-mono text-[10px] text-faint">
            {row.collectionMethod ? METHOD_LABEL[row.collectionMethod] : ""}
            {row.collectionMethod && row.paymentReference ? " · " : ""}
            {row.paymentReference ?? ""}
          </span>
        ) : null}
      </span>
    );
  }

  if (row.netDuePaise > 0) return <Badge tone="warning">Pending</Badge>;

  // Nothing to collect on this statement. Under the collection floor (or a
  // credit) the balance rolls onto the vendor's next statement, so this row is
  // settled by that one rather than by a visit — it must not read "Pending".
  if (row.carriedForwardPaise > 0) {
    return (
      <span
        className="inline-flex flex-col gap-0.5"
        title="Too small to collect on its own — added to this restaurant's next statement."
      >
        <Badge tone="info">Carried forward</Badge>
        <span className="text-[10px] text-faint">Added to next statement</span>
      </span>
    );
  }
  if (row.carriedForwardPaise < 0) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Badge tone="info">Credit</Badge>
        <span className="text-[10px] text-faint">Taken off next statement</span>
      </span>
    );
  }
  return <Badge tone="neutral">Nothing due</Badge>;
}

function MarkCollectedDialog({ row, statementId }: { row: StatementRow; statementId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<CollectionMethod>("CASH");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const referenceRequired = method !== "CASH";
  const canSubmit = !submitting && (!referenceRequired || reference.trim().length >= 3);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    const result = await markCollected({
      statementId,
      collectionMethod: method,
      paymentReference: reference.trim(),
    });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Mark collected</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Collected <Money paise={row.netDuePaise} exact /> from {row.restaurantName}?
          </DialogTitle>
          <DialogDescription>
            Record how the money came in. It appears on the vendor&apos;s statement, which is
            what stops the “I already paid for last Tuesday” conversation.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div>
            <Label htmlFor={`method-${statementId}`}>How it was paid</Label>
            <Select
              id={`method-${statementId}`}
              value={method}
              onChange={(event) => setMethod(event.target.value as CollectionMethod)}
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
            </Select>
          </div>

          <div>
            <Label htmlFor={`ref-${statementId}`}>
              Reference{referenceRequired ? "" : " (optional)"}
            </Label>
            <Input
              id={`ref-${statementId}`}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder={
                referenceRequired ? "UPI reference or bank UTR" : "Receipt number, or who collected it"
              }
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Confirm collected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Signed({ paise }: { paise: number }) {
  // Positive adds to what the vendor owes us; negative credits them.
  return (
    <span className={paise < 0 ? "text-mint" : "text-chili"}>
      {paise < 0 ? "−" : "+"}
      <Money paise={Math.abs(paise)} exact />
    </span>
  );
}

function sum(rows: readonly StatementRow[], pick: (row: StatementRow) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

/**
 * The collections file.
 *
 * Generated in the browser from what is on screen so the admin downloads
 * exactly the rows they are looking at. The canonical formatter lives in
 * `settlement.ts` for the server-side export; this mirrors its columns.
 */
function downloadCsv(rows: StatementRow[], date: string): void {
  const header = [
    "date",
    "restaurant",
    "phone",
    "orders",
    "cashCollected",
    "commissionDue",
    "adjustments",
    "opening",
    "netDue",
    "carried",
    "status",
    "collectedVia",
    "reference",
  ].join(",");

  const body = rows.map((row) =>
    [
      date,
      quote(row.restaurantName),
      quote(row.contactPhone),
      String(row.orderCount),
      rupees(row.cashCollectedPaise),
      rupees(row.commissionDuePaise),
      rupees(row.adjustmentsPaise),
      rupees(row.openingBalancePaise),
      rupees(row.netDuePaise),
      rupees(row.carriedForwardPaise),
      row.kind === "PREVIEW" ? "NOT_INVOICED" : row.status,
      quote(row.collectionMethod ?? ""),
      quote(row.paymentReference ?? ""),
    ].join(","),
  );

  const blob = new Blob([[header, ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `trefood-collections-${formatCampusDate(date).replaceAll(" ", "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Plain rupee decimals, no symbol and no grouping — this opens in a spreadsheet. */
function rupees(paise: number): string {
  return paise < 0 ? `-${formatINRPlain(-paise)}` : formatINRPlain(paise);
}

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
