"use client";

import { Banknote, Download, Receipt, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/states";
import { formatCampusDate } from "@/lib/campus-time";
import { formatINRPlain } from "@/lib/money";

export interface EarningsDayView {
  date: string;
  orderCount: number;
  codOrderCount: number;
  grossPaise: number;
  commissionPaise: number;
  receivablePaise: number;
  codCashPaise: number;
}

export interface LedgerRowView {
  id: string;
  createdAt: string;
  type: string;
  note: string;
  amountPaise: number;
}

export interface SettlementRowView {
  id: string;
  settlementDate: string;
  grossPrepaidPaise: number;
  adjustmentsPaise: number;
  netPayablePaise: number;
  carriedForwardPaise: number;
  status: "PENDING" | "PAID";
  utrReference: string | null;
}

/**
 * Vendor earnings.
 *
 * The number a restaurant owner actually wants is "what will land in my bank",
 * and the honest answer has three parts that this screen keeps visibly
 * separate:
 *
 *   · **Cash already in the till** from COD orders. It never appears in a
 *     payout because it was settled at the gate — the token paid our
 *     commission and the cash paid them. Showing it as "pending" would be a
 *     lie that makes every statement look wrong.
 *   · **Bank transfer** for prepaid orders, once the nightly run closes the day.
 *   · **Adjustments**, which are almost always negative: the gateway fee lost
 *     on a refund they caused, or a dispute ruled against them.
 */
export function EarningsView({
  days,
  today,
  ledger,
  ledgerTotalPaise,
  settlements,
  pendingPayoutPaise,
  commissionPct,
}: {
  days: EarningsDayView[];
  today: EarningsDayView;
  ledger: LedgerRowView[];
  ledgerTotalPaise: number;
  settlements: SettlementRowView[];
  pendingPayoutPaise: number;
  commissionPct: string;
}) {
  return (
    <div className="space-y-6">
      {/* ── Today ────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={TrendingUp}
          label="Today, gross"
          paise={today.grossPaise}
          hint={`${today.orderCount} delivered order${today.orderCount === 1 ? "" : "s"}`}
        />
        <Stat
          icon={Receipt}
          label={`TREFOOD commission (${commissionPct}%)`}
          paise={today.commissionPaise}
          hint="Charged on food, packaging and delivery"
        />
        <Stat
          icon={Banknote}
          label="Cash already with you"
          paise={today.codCashPaise}
          hint={`${today.codOrderCount} cash order${today.codOrderCount === 1 ? "" : "s"}, settled at the gate`}
          tone="mint"
        />
        <Stat
          icon={Download}
          label="Awaiting bank transfer"
          paise={pendingPayoutPaise}
          hint="Statements written but not yet paid"
          tone="saffron"
        />
      </section>

      {/* ── Last seven days ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-2.5 font-display text-sm font-semibold text-bone">Last seven days</h2>
        <Table>
          <THead>
            <tr>
              <TH>Day</TH>
              <TH className="text-right">Orders</TH>
              <TH className="text-right">Gross</TH>
              <TH className="text-right">Commission</TH>
              <TH className="text-right">Your share</TH>
              <TH className="text-right">Of which cash</TH>
            </tr>
          </THead>
          <TBody>
            {days.map((day) => (
              <TR key={day.date}>
                <TD className="whitespace-nowrap">{formatCampusDate(day.date)}</TD>
                <TD className="text-right tabular">{day.orderCount}</TD>
                <TD className="text-right">
                  <Money paise={day.grossPaise} />
                </TD>
                <TD className="text-right text-muted">
                  <Money paise={day.commissionPaise} />
                </TD>
                <TD className="text-right font-semibold">
                  <Money paise={day.receivablePaise} />
                </TD>
                <TD className="text-right text-mint">
                  <Money paise={day.codCashPaise} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>

      {/* ── Adjustments ──────────────────────────────────────────── */}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-bone">Adjustments</h2>
          {ledger.length > 0 ? (
            <span className="text-sm">
              Total{" "}
              <SignedMoney paise={ledgerTotalPaise} className="font-semibold" />
            </span>
          ) : null}
        </div>

        {ledger.length === 0 ? (
          <Card>
            <EmptyState
              icon={Receipt}
              title="No adjustments"
              description="Refund gateway fees and dispute debits would appear here. An empty list is a good list."
            />
          </Card>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Reason</TH>
                <TH className="text-right">Amount</TH>
              </tr>
            </THead>
            <TBody>
              {ledger.map((entry) => (
                <TR key={entry.id}>
                  <TD className="whitespace-nowrap text-muted">
                    {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </TD>
                  <TD>
                    <p className="text-sm">{entry.note}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-faint">
                      {entry.type.replaceAll("_", " ").toLowerCase()}
                    </p>
                  </TD>
                  <TD className="text-right">
                    <SignedMoney paise={entry.amountPaise} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      {/* ── Statements ───────────────────────────────────────────── */}
      <section>
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-bone">Statements</h2>
          {settlements.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => downloadCsv(settlements)}>
              <Download />
              Download CSV
            </Button>
          ) : null}
        </div>

        {settlements.length === 0 ? (
          <Card>
            <EmptyState
              icon={Download}
              title="No statements yet"
              description="One is written for you every night at 23:59. Cash orders are already settled and never appear on it."
            />
          </Card>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Day</TH>
                <TH className="text-right">Prepaid orders</TH>
                <TH className="text-right">Adjustments</TH>
                <TH className="text-right">Net payable</TH>
                <TH className="text-right">Carried forward</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {settlements.map((row) => (
                <TR key={row.id}>
                  <TD className="whitespace-nowrap">{formatCampusDate(row.settlementDate)}</TD>
                  <TD className="text-right">
                    <Money paise={row.grossPrepaidPaise} exact />
                  </TD>
                  <TD className="text-right">
                    <SignedMoney paise={row.adjustmentsPaise} />
                  </TD>
                  <TD className="text-right font-semibold">
                    <Money paise={row.netPayablePaise} exact />
                  </TD>
                  <TD className="text-right text-muted">
                    <SignedMoney paise={row.carriedForwardPaise} />
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
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stat({
  icon: Icon,
  label,
  paise,
  hint,
  tone = "bone",
}: {
  icon: typeof TrendingUp;
  label: string;
  paise: number;
  hint: string;
  tone?: "bone" | "mint" | "saffron";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-faint">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p
        className={
          tone === "mint"
            ? "mt-2 text-2xl font-semibold text-mint"
            : tone === "saffron"
              ? "mt-2 text-2xl font-semibold text-saffron"
              : "mt-2 text-2xl font-semibold text-bone"
        }
      >
        <Money paise={paise} />
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
    </Card>
  );
}

/** Adjustments are the one place a minus sign is meaningful, so it is shown. */
function SignedMoney({ paise, className }: { paise: number; className?: string }) {
  if (paise === 0) return <span className={className}>—</span>;
  return (
    <span className={paise < 0 ? `text-chili ${className ?? ""}` : `text-mint ${className ?? ""}`}>
      {paise < 0 ? "−" : "+"}
      <Money paise={Math.abs(paise)} exact />
    </span>
  );
}

function downloadCsv(rows: SettlementRowView[]): void {
  const header = ["date", "prepaidGross", "adjustments", "netPayable", "carriedForward", "status", "utr"];
  const body = rows.map((row) =>
    [
      row.settlementDate,
      formatINRPlain(row.grossPrepaidPaise),
      signed(row.adjustmentsPaise),
      formatINRPlain(row.netPayablePaise),
      signed(row.carriedForwardPaise),
      row.status,
      row.utrReference ?? "",
    ].join(","),
  );

  const blob = new Blob([[header.join(","), ...body].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `trefood-statements-${rows[0]?.settlementDate ?? "export"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function signed(paise: number): string {
  return paise < 0 ? `-${formatINRPlain(-paise)}` : formatINRPlain(paise);
}
