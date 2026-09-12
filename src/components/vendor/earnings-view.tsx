"use client";

import { Banknote, Download, Landmark, Receipt, TrendingUp, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/states";
import { formatINRPlain } from "@/lib/money";
import { useVendorLanguage } from "@/context/vendor-language-context";
import {
  localizeLedgerNote,
  localizeLedgerType,
  formatCampusDateLocalized,
} from "@/lib/i18n/vendor-dictionary";

export interface EarningsDayView {
  date: string;
  orderCount: number;
  grossPaise: number;
  commissionPaise: number;
  discountPaise: number;
  cashCollectedPaise: number;
  keptPaise: number;
}

export interface LedgerRowView {
  id: string;
  createdAt: string;
  type: string;
  note: string;
  amountPaise: number;
}

export interface StatementRowView {
  id: string;
  statementDate: string;
  commissionDuePaise: number;
  adjustmentsPaise: number;
  netDuePaise: number;
  carriedForwardPaise: number;
  status: "PENDING" | "PAID";
  paymentReference: string | null;
}

/**
 * Vendor earnings.
 *
 * Money flows one way here, and the screen has to be honest about which way.
 * The vendor's own staff collected the full bill in cash at every gate, so
 * every rupee of it is already in their till. Nothing is owed TO them. What
 * they need to see is the other side of that:
 *
 *   · **Cash collected today**, which is theirs and already in hand.
 *   · **What they owe TREFOOD** — the commission on those deliveries, raised
 *     as a statement each night and settled with us the next morning.
 *   · **Adjustments**, usually credits: commission refunded on food a stockout
 *     meant they never delivered.
 *
 * Showing the commission as a "payout pending" would be exactly backwards, and
 * a vendor who misreads it once will be short when we come to collect.
 */
export function EarningsView({
  days,
  today,
  ledger,
  ledgerTotalPaise,
  statements,
  outstandingDuePaise,
  platformFeePaise,
}: {
  days: EarningsDayView[];
  today: EarningsDayView;
  ledger: LedgerRowView[];
  ledgerTotalPaise: number;
  statements: StatementRowView[];
  outstandingDuePaise: number;
  /** Admin-set TREFOOD platform fee for this vendor. 0 when none. */
  platformFeePaise: number;
  commissionPct?: string;
}) {
  const { t, lang } = useVendorLanguage();

  return (
    <div className="space-y-6">
      <header className="mb-5">
        <h1 className="font-display text-xl font-semibold text-bone">{t("earningsPageTitle")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("earningsPageSubtitle")}
        </p>
      </header>

      {/* ── Today ────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={TrendingUp}
          label={t("todayGross")}
          paise={today.grossPaise}
          hint={`${today.orderCount} ${today.orderCount === 1 ? t("deliveredOrder") : t("deliveredOrders")}`}
        />
        <Stat
          icon={Banknote}
          label={t("cashWithYou")}
          paise={today.cashCollectedPaise}
          hint={t("cashCollectedHint")}
          tone="mint"
        />
        <Stat
          icon={Wallet}
          label={t("commissionOwed")}
          paise={outstandingDuePaise}
          hint={t("commissionOwedHint")}
          tone="saffron"
        />
        <Stat
          icon={Landmark}
          label={t("platformFee")}
          paise={platformFeePaise}
          hint={t("platformFeeHint")}
        />
      </section>

      {/* ── Last seven days ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-2.5 font-display text-sm font-semibold text-bone">{t("lastSevenDays")}</h2>
        <Table>
          <THead>
            <tr>
              <TH>{t("day")}</TH>
              <TH className="text-right">{t("ordersCount")}</TH>
              <TH className="text-right">{t("gross")}</TH>
              <TH className="text-right">{t("commission")}</TH>
              <TH className="text-right">{t("cashCollected")}</TH>
              <TH className="text-right">{t("youKeep")}</TH>
            </tr>
          </THead>
          <TBody>
            {days.map((day) => (
              <TR key={day.date}>
                <TD className="whitespace-nowrap">{formatCampusDateLocalized(day.date, lang)}</TD>
                <TD className="text-right tabular">{day.orderCount}</TD>
                <TD className="text-right">
                  <Money paise={day.grossPaise} />
                </TD>
                <TD className="text-right text-muted">
                  <Money paise={day.commissionPaise} />
                </TD>
                <TD className="text-right text-mint">
                  <Money paise={day.cashCollectedPaise} />
                </TD>
                <TD className="text-right font-semibold">
                  <Money paise={day.keptPaise} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>

      {/* ── Adjustments ──────────────────────────────────────────── */}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-bone">{t("adjustments")}</h2>
          {ledger.length > 0 ? (
            <span className="text-sm">
              {t("adjustmentsTotal")}{" "}
              <SignedMoney paise={ledgerTotalPaise} className="font-semibold" />
            </span>
          ) : null}
        </div>

        {ledger.length === 0 ? (
          <Card>
            <EmptyState
              icon={Receipt}
              title={t("noAdjustments")}
              description={t("noAdjustmentsDesc")}
            />
          </Card>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>{t("when")}</TH>
                <TH>{t("reason")}</TH>
                <TH className="text-right">{t("amount")}</TH>
              </tr>
            </THead>
            <TBody>
              {ledger.map((entry) => (
                <TR key={entry.id}>
                  <TD className="whitespace-nowrap text-muted">
                    {new Date(entry.createdAt).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </TD>
                  <TD>
                    <p className="text-sm">{localizeLedgerNote(entry.note, lang)}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-faint">
                      {localizeLedgerType(entry.type, lang)}
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
          <h2 className="font-display text-sm font-semibold text-bone">{t("statements")}</h2>
          {statements.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => downloadCsv(statements)}>
              <Download />
              {t("downloadCsv")}
            </Button>
          ) : null}
        </div>

        {statements.length === 0 ? (
          <Card>
            <EmptyState
              icon={Download}
              title={t("noStatementsYet")}
              description={t("noStatementsDesc")}
            />
          </Card>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>{t("day")}</TH>
                <TH className="text-right">{t("commissionDue")}</TH>
                <TH className="text-right">{t("adjustments")}</TH>
                <TH className="text-right">{t("netDue")}</TH>
                <TH className="text-right">{t("carriedForward")}</TH>
                <TH>{t("status")}</TH>
              </tr>
            </THead>
            <TBody>
              {statements.map((row) => (
                <TR key={row.id}>
                  <TD className="whitespace-nowrap">{formatCampusDateLocalized(row.statementDate, lang)}</TD>
                  <TD className="text-right">
                    <Money paise={row.commissionDuePaise} exact />
                  </TD>
                  <TD className="text-right">
                    <SignedMoney paise={row.adjustmentsPaise} />
                  </TD>
                  <TD className="text-right font-semibold">
                    <Money paise={row.netDuePaise} exact />
                  </TD>
                  <TD className="text-right text-muted">
                    <SignedMoney paise={row.carriedForwardPaise} />
                  </TD>
                  <TD>
                    {row.status === "PAID" ? (
                      <span className="inline-flex flex-col gap-0.5">
                        <Badge tone="success">{t("paid")}</Badge>
                        {row.paymentReference ? (
                          <span className="font-mono text-[10px] text-faint">
                            {row.paymentReference}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <Badge tone="warning">{t("pending")}</Badge>
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

/**
 * Adjustments are the one place a minus sign is meaningful, so it is shown.
 *
 * The sign is against what the vendor OWES: negative is a credit in their
 * favour, so it is the green one.
 */
function SignedMoney({ paise, className }: { paise: number; className?: string }) {
  if (paise === 0) return <span className={className}>—</span>;
  return (
    <span className={paise < 0 ? `text-mint ${className ?? ""}` : `text-chili ${className ?? ""}`}>
      {paise < 0 ? "−" : "+"}
      <Money paise={Math.abs(paise)} exact />
    </span>
  );
}

function downloadCsv(rows: StatementRowView[]): void {
  const header = [
    "date",
    "commissionDue",
    "adjustments",
    "netDue",
    "carriedForward",
    "status",
    "reference",
  ];
  const body = rows.map((row) =>
    [
      row.statementDate,
      formatINRPlain(row.commissionDuePaise),
      signed(row.adjustmentsPaise),
      formatINRPlain(row.netDuePaise),
      signed(row.carriedForwardPaise),
      row.status,
      row.paymentReference ?? "",
    ].join(","),
  );

  const blob = new Blob([[header.join(","), ...body].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `trefood-statements-${rows[0]?.statementDate ?? "export"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function signed(paise: number): string {
  return paise < 0 ? `-${formatINRPlain(-paise)}` : formatINRPlain(paise);
}
