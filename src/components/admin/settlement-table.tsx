"use client";

import { Banknote, Download, Loader2, PlayCircle } from "lucide-react";
import { useState } from "react";
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
import { markPaid, runSettlementNow } from "@/server/actions/admin";
import { formatCampusDate } from "@/lib/campus-time";
import { formatINRPlain } from "@/lib/money";

export interface SettlementRow {
  settlementId: string;
  settlementDate: string;
  restaurantName: string;
  accountLabel: string;
  upiId: string | null;
  grossPrepaidPaise: number;
  adjustmentsPaise: number;
  openingBalancePaise: number;
  netPayablePaise: number;
  carriedForwardPaise: number;
  orderCount: number;
  codOrderCount: number;
  status: "PENDING" | "PAID";
  utrReference: string | null;
}

export interface CampusOption {
  campusId: string;
  name: string;
  todayDate: string;
}

/**
 * Settlement.
 *
 * v1 payout is an admin with a banking app and a CSV — deliberately, per
 * MONEY section 6. At ten to twenty vendors, five minutes a night genuinely
 * beats a RazorpayX activation, and this screen is that five minutes: run the
 * day, download the file, pay, come back and stamp each row with its UTR.
 *
 * Re-running a day is safe and expected. The unique index on
 * `(restaurantId, settlementDate)` makes the second run a no-op, so the button
 * can be pressed twice by a nervous human without paying anyone twice.
 */
export function SettlementTable({
  rows,
  campuses,
  selectedDate,
}: {
  rows: SettlementRow[];
  campuses: CampusOption[];
  selectedDate: string;
}) {
  const [campusId, setCampusId] = useState(campuses[0]?.campusId ?? "");
  const [date, setDate] = useState(selectedDate);
  const [running, setRunning] = useState(false);

  const run = async (): Promise<void> => {
    setRunning(true);
    const result = await runSettlementNow({ campusId, settlementDate: date });
    setRunning(false);

    if (result.status === "error") toast.error(result.message);
    else toast.success(result.message);
  };

  const totalPayable = rows
    .filter((row) => row.status === "PENDING")
    .reduce((total, row) => total + row.netPayablePaise, 0);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44">
            <Label htmlFor="settle-campus">Campus</Label>
            <Select
              id="settle-campus"
              value={campusId}
              onChange={(event) => setCampusId(event.target.value)}
            >
              {campuses.map((campus) => (
                <option key={campus.campusId} value={campus.campusId}>
                  {campus.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="min-w-40">
            <Label htmlFor="settle-date">Campus-local day</Label>
            <Input
              id="settle-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <Button disabled={running || campusId === ""} onClick={() => void run()}>
            {running ? <Loader2 className="animate-spin" /> : <PlayCircle />}
            Run settlement
          </Button>

          {rows.length > 0 ? (
            <Button variant="secondary" onClick={() => downloadCsv(rows, date)}>
              <Download />
              Download payout CSV
            </Button>
          ) : null}

          <p className="ml-auto text-sm text-muted">
            Pending payout{" "}
            <Money paise={totalPayable} exact className="font-semibold text-bone" />
          </p>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Running the same day twice is safe — the second run is a no-op. Cash orders
          contribute nothing here: the token already paid our commission and the cash already
          paid the vendor, so a COD order needs no settlement at all.
        </p>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Banknote}
            title="Nothing settled for this day"
            description="Run the settlement above, or pick another date. Only delivered orders settle; anything still in flight rolls to the next day."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Restaurant</TH>
              <TH>Bank</TH>
              <TH className="text-right">Prepaid</TH>
              <TH className="text-right">Adjustments</TH>
              <TH className="text-right">Opening</TH>
              <TH className="text-right">Net payable</TH>
              <TH className="text-right">Carried</TH>
              <TH>Status</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.settlementId}>
                <TD>
                  <p className="font-medium">{row.restaurantName}</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {row.orderCount} order{row.orderCount === 1 ? "" : "s"} · {row.codOrderCount}{" "}
                    cash
                  </p>
                </TD>
                <TD className="whitespace-nowrap text-xs text-muted">
                  {row.accountLabel}
                  {row.upiId ? <span className="block text-faint">{row.upiId}</span> : null}
                </TD>
                <TD className="text-right">
                  <Money paise={row.grossPrepaidPaise} exact />
                </TD>
                <TD className="text-right">
                  <Signed paise={row.adjustmentsPaise} />
                </TD>
                <TD className="text-right">
                  <Signed paise={row.openingBalancePaise} />
                </TD>
                <TD className="text-right font-semibold">
                  <Money paise={row.netPayablePaise} exact />
                </TD>
                <TD className="text-right text-muted">
                  <Signed paise={row.carriedForwardPaise} />
                </TD>
                <TD>
                  {row.status === "PAID" ? (
                    <span className="inline-flex flex-col gap-0.5">
                      <Badge tone="success">Paid</Badge>
                      {row.utrReference ? (
                        <span className="font-mono text-[10px] text-faint">
                          {row.utrReference}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <Badge tone="warning">Pending</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  {row.status === "PENDING" && row.netPayablePaise > 0 ? (
                    <MarkPaidDialog row={row} />
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

function MarkPaidDialog({ row }: { row: SettlementRow }) {
  const [open, setOpen] = useState(false);
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    const result = await markPaid({ settlementId: row.settlementId, utrReference: utr.trim() });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Mark paid
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Paid <Money paise={row.netPayablePaise} exact /> to {row.restaurantName}?
          </DialogTitle>
          <DialogDescription>
            Enter the UTR your bank gave you. It appears on the vendor&apos;s statement, which
            is what stops the “I never got last Tuesday” conversation.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Label htmlFor={`utr-${row.settlementId}`}>UTR reference</Label>
          <Input
            id={`utr-${row.settlementId}`}
            value={utr}
            onChange={(event) => setUtr(event.target.value)}
            placeholder="N123456789012345"
          />
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={utr.trim().length < 4 || submitting} onClick={() => void submit()}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Confirm paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Signed({ paise }: { paise: number }) {
  if (paise === 0) return <span className="text-faint">—</span>;
  return (
    <span className={paise < 0 ? "text-chili" : "text-mint"}>
      {paise < 0 ? "−" : "+"}
      <Money paise={Math.abs(paise)} exact />
    </span>
  );
}

/**
 * The payout file.
 *
 * Generated in the browser from what is on screen so the admin downloads
 * exactly the rows they are looking at. The canonical formatter lives in
 * `settlement.ts` for the server-side export; this mirrors its columns.
 */
function downloadCsv(rows: SettlementRow[], date: string): void {
  const header = [
    "date",
    "restaurant",
    "bank",
    "upi",
    "prepaidGross",
    "adjustments",
    "opening",
    "netPayable",
    "carried",
    "orders",
    "codOrders",
    "status",
    "utr",
  ].join(",");

  const body = rows.map((row) =>
    [
      row.settlementDate,
      quote(row.restaurantName),
      quote(row.accountLabel),
      quote(row.upiId ?? ""),
      rupees(row.grossPrepaidPaise),
      rupees(row.adjustmentsPaise),
      rupees(row.openingBalancePaise),
      rupees(row.netPayablePaise),
      rupees(row.carriedForwardPaise),
      String(row.orderCount),
      String(row.codOrderCount),
      row.status,
      quote(row.utrReference ?? ""),
    ].join(","),
  );

  const blob = new Blob([[header, ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `trefood-payouts-${formatCampusDate(date).replaceAll(" ", "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Plain rupee decimals, no symbol and no grouping — this is pasted into a bank portal. */
function rupees(paise: number): string {
  return paise < 0 ? `-${formatINRPlain(-paise)}` : formatINRPlain(paise);
}

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
