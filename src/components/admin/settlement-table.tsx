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
import { markCollected, runSettlementNow } from "@/server/actions/admin";
import { formatCampusDate } from "@/lib/campus-time";
import { formatINRPlain } from "@/lib/money";

export interface StatementRow {
  statementId: string;
  statementDate: string;
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
  todayDate: string;
}

const METHOD_LABEL: Record<NonNullable<StatementRow["collectionMethod"]>, string> = {
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
 * every gate holding the full bill. TREFOOD never touched it. What this screen
 * shows is the invoice: our commission on the day's deliveries, which the
 * vendor hands over the next morning. Run the day, work down the list, and
 * stamp each row as the money arrives.
 *
 * Re-running a day is safe and expected. The unique index on
 * `(restaurantId, statementDate)` makes the second run a no-op, so the button
 * can be pressed twice by a nervous human without invoicing anyone twice.
 */
export function SettlementTable({
  rows,
  campuses,
  selectedDate,
}: {
  rows: StatementRow[];
  campuses: CampusOption[];
  selectedDate: string;
}) {
  const [campusId, setCampusId] = useState(campuses[0]?.campusId ?? "");
  const [date, setDate] = useState(selectedDate);
  const [running, setRunning] = useState(false);

  const run = async (): Promise<void> => {
    setRunning(true);
    const result = await runSettlementNow({ campusId, statementDate: date });
    setRunning(false);

    if (result.status === "error") toast.error(result.message);
    else toast.success(result.message);
  };

  const totalDue = rows
    .filter((row) => row.status === "PENDING")
    .reduce((total, row) => total + row.netDuePaise, 0);

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
            Run statements
          </Button>

          {rows.length > 0 ? (
            <Button variant="secondary" onClick={() => downloadCsv(rows, date)}>
              <Download />
              Download collections CSV
            </Button>
          ) : null}

          <p className="ml-auto text-sm text-muted">
            Still to collect{" "}
            <Money paise={totalDue} exact className="font-semibold text-bone" />
          </p>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Running the same day twice is safe — the second run is a no-op. Only delivered orders
          carry commission: a rejection, an expiry or a no-show means no food changed hands and
          no cash was collected, so there is nothing to bill for it.
        </p>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Banknote}
            title="No statements for this day"
            description="Run the statements above, or pick another date. Anything still in flight rolls to the next day."
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
              <TH className="text-right">Adjustments</TH>
              <TH className="text-right">Opening</TH>
              <TH className="text-right">Owes us</TH>
              <TH className="text-right">Carried</TH>
              <TH>Status</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.statementId}>
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
                  <Signed paise={row.adjustmentsPaise} />
                </TD>
                <TD className="text-right">
                  <Signed paise={row.openingBalancePaise} />
                </TD>
                <TD className="text-right font-semibold">
                  <Money paise={row.netDuePaise} exact />
                </TD>
                <TD className="text-right text-muted">
                  <Signed paise={row.carriedForwardPaise} />
                </TD>
                <TD>
                  {row.status === "PAID" ? (
                    <span className="inline-flex flex-col gap-0.5">
                      <Badge tone="success">Collected</Badge>
                      {row.paymentReference ? (
                        <span className="font-mono text-[10px] text-faint">
                          {row.collectionMethod ? `${METHOD_LABEL[row.collectionMethod]} · ` : ""}
                          {row.paymentReference}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <Badge tone="warning">Pending</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  {row.status === "PENDING" && row.netDuePaise > 0 ? (
                    <MarkCollectedDialog row={row} />
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

function MarkCollectedDialog({ row }: { row: StatementRow }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<NonNullable<StatementRow["collectionMethod"]>>("CASH");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    const result = await markCollected({
      statementId: row.statementId,
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
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Mark collected
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Collected <Money paise={row.netDuePaise} exact /> from {row.restaurantName}?
          </DialogTitle>
          <DialogDescription>
            Record how the money came in and against what reference. It appears on the
            vendor&apos;s statement, which is what stops the “I already paid for last Tuesday”
            conversation.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div>
            <Label htmlFor={`method-${row.statementId}`}>How it was paid</Label>
            <Select
              id={`method-${row.statementId}`}
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as NonNullable<StatementRow["collectionMethod"]>)
              }
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
            </Select>
          </div>

          <div>
            <Label htmlFor={`ref-${row.statementId}`}>Reference</Label>
            <Input
              id={`ref-${row.statementId}`}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder={
                method === "CASH" ? "Receipt number, or who collected it" : "UPI id or bank UTR"
              }
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={reference.trim().length < 3 || submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Confirm collected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Signed({ paise }: { paise: number }) {
  if (paise === 0) return <span className="text-faint">—</span>;
  // Positive adds to what the vendor owes us; negative credits them.
  return (
    <span className={paise < 0 ? "text-mint" : "text-chili"}>
      {paise < 0 ? "−" : "+"}
      <Money paise={Math.abs(paise)} exact />
    </span>
  );
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
      row.statementDate,
      quote(row.restaurantName),
      quote(row.contactPhone),
      String(row.orderCount),
      rupees(row.cashCollectedPaise),
      rupees(row.commissionDuePaise),
      rupees(row.adjustmentsPaise),
      rupees(row.openingBalancePaise),
      rupees(row.netDuePaise),
      rupees(row.carriedForwardPaise),
      row.status,
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
