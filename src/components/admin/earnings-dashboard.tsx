"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeIndianRupee,
  Download,
  CalendarDays,
  Minus,
  Store,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import {
  CollectionMeter,
  RankedBars,
  Sparkline,
  TrendChart,
  type MeterSegment,
  type RankedBar,
  type TrendPoint,
} from "@/components/admin/earnings-charts";
import { bpsToPct, formatINRCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The earnings and settlement dashboard.
 *
 * ★ EVERY RUPEE ON THIS SCREEN FLOWS VENDOR -> TREFOOD. ★
 *
 * There is no payout here and no "payable" column, because TREFOOD never holds
 * the money: the vendor's own staff collected the full bill in cash at the
 * gate. What a vendor has is a BALANCE THEY OWE US, and the whole screen is
 * built around answering three questions about it, in this order:
 *
 *   1. What did we earn?        — the tiles and the trend, from ORDERS
 *   2. What did we invoice?     — the collection meter, from STATEMENTS
 *   3. What is still missing?   — the unbilled banner, the gap between the two
 *
 * Question three is the one that pays for this screen. Commission is earned the
 * moment an order is delivered but only becomes collectable when the nightly
 * run writes a statement for it, and anything that falls between those two
 * events is money nobody is chasing because nobody knows it exists. The banner
 * at the top exists to make that impossible to miss.
 *
 * The table at the bottom is not decoration either — it is the accessible twin
 * of every chart above it. No value on this screen is reachable only by hover.
 */

/**
 * Percentage labels. Formatters rather than `toFixed`, which this codebase
 * bans outright so that no habit of hand-rounding ever reaches a money path.
 * A change under half a percent gets a decimal, because "0%" beside a "flat"
 * arrow reads as broken rather than as steady.
 */
const WHOLE_PERCENT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const ONE_DECIMAL_PERCENT = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/* ══════════════════════════════════════════════════════════════════════
   Props — plain data, mirroring services/analytics.ts structurally
   ══════════════════════════════════════════════════════════════════════ */

export interface DashboardBucket {
  orderCount: number;
  /** What students were billed. The revenue line. */
  billedPaise: number;
  /** What was recorded as taken at the gate. Reconciliation only. */
  cashCollectedPaise: number;
  grossPaise: number;
  commissionPaise: number;
  discountPaise: number;
}

export interface DashboardDaily extends DashboardBucket {
  date: string;
}

export interface DashboardUnbilled {
  orderCount: number;
  commissionPaise: number;
  oldestDate: string | null;
}

export interface DashboardRestaurant {
  restaurantId: string;
  name: string;
  campusName: string;
  commissionBps: number;
  today: DashboardBucket;
  month: DashboardBucket;
  lifetime: DashboardBucket;
  outstandingPaise: number;
  collectedPaise: number;
  carriedForwardPaise: number;
  unbilled: DashboardUnbilled;
  lastStatementDate: string | null;
}

/** One vendor on one day. Mirrors `DailyVendorRow` in services/daily-vendor-report.ts. */
export interface DashboardDailyVendor {
  date: string;
  restaurantId: string;
  name: string;
  campusName: string;
  phone: string;
  commissionBps: number;
  ordersTaken: number;
  ordersCancelled: number;
  ordersDelivered: number;
  billedPaise: number;
  cashCollectedPaise: number;
  discountPaise: number;
  commissionPaise: number;
  vendorKeepsPaise: number;
  statement: {
    orderCount: number;
    commissionDuePaise: number;
    adjustmentsPaise: number;
    openingBalancePaise: number;
    netDuePaise: number;
    carriedForwardPaise: number;
    status: "PENDING" | "PAID";
    paidAt: string | null;
    collectionMethod: "CASH" | "UPI" | "BANK_TRANSFER" | null;
    paymentReference: string | null;
  } | null;
  submittedPaise: number;
  balancePaise: number;
}

export interface DashboardCampus {
  campusId: string;
  name: string;
}

export interface EarningsDashboardProps {
  todayDate: string;
  month: string;
  previousMonth: string;
  year: string;

  today: DashboardBucket;
  yesterday: DashboardBucket;
  weekend: DashboardBucket;
  monthTotal: DashboardBucket;
  previousMonthTotal: DashboardBucket;
  yearTotal: DashboardBucket;
  lifetime: DashboardBucket;

  monthDaily: DashboardDaily[];
  trailingDaily: DashboardDaily[];

  restaurants: DashboardRestaurant[];
  /** Campus-local "YYYY-MM-DD" the daily vendor report covers. */
  reportDay: string;
  /** Every vendor in scope on `reportDay`, idle ones included. */
  dailyReport: DashboardDailyVendor[];
  collection: {
    collectedPaise: number;
    outstandingPaise: number;
    pendingStatementCount: number;
    paidStatementCount: number;
    oldestPendingDate: string | null;
    unbilled: DashboardUnbilled;
  };

  campuses: DashboardCampus[];
  /** Empty string means every campus. */
  selectedCampusId: string;
}

/* ══════════════════════════════════════════════════════════════════════
   The screen
   ══════════════════════════════════════════════════════════════════════ */

export function EarningsDashboard(props: EarningsDashboardProps) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();

  const go = (next: { campus?: string; month?: string; day?: string }): void => {
    const params = new URLSearchParams();
    const campus = next.campus ?? props.selectedCampusId;
    // Picking a day pulls the month along with it, so the charts and the day
    // report never describe two different months. Picking a month drops the
    // day and lets the server choose the nearest one inside it.
    const month = next.day?.slice(0, 7) ?? next.month ?? props.month;
    const day = next.day ?? (next.month === undefined ? props.reportDay : undefined);
    if (campus !== "") params.set("campus", campus);
    params.set("month", month);
    if (day !== undefined) params.set("day", day);
    startNavigation(() => router.push(`/admin/earnings?${params.toString()}`));
  };

  const exportHref = (from: string, to: string): string => {
    const params = new URLSearchParams({ from, to });
    if (props.selectedCampusId !== "") params.set("campus", props.selectedCampusId);
    return `/api/admin/earnings/export?${params.toString()}`;
  };

  // The month export runs to today at the latest: days that have not happened
  // yet have nothing on them. A future month has no range at all.
  const monthStart = props.monthDaily[0]?.date ?? `${props.month}-01`;
  const monthEnd = props.monthDaily.at(-1)?.date ?? monthStart;
  const monthExportEnd = monthEnd < props.todayDate ? monthEnd : props.todayDate;

  /* ---- Derived views ------------------------------------------------ */

  const trend: TrendPoint[] = useMemo(
    () =>
      props.monthDaily.map((day) => ({
        date: day.date,
        valuePaise: day.commissionPaise,
        orderCount: day.orderCount,
      })),
    [props.monthDaily],
  );

  const bars: RankedBar[] = useMemo(
    () =>
      props.restaurants
        .filter((restaurant) => restaurant.month.commissionPaise > 0)
        .map((restaurant) => ({
          id: restaurant.restaurantId,
          name: restaurant.name,
          valuePaise: restaurant.month.commissionPaise,
          caption: `${restaurant.month.orderCount} order${
            restaurant.month.orderCount === 1 ? "" : "s"
          } · ${formatINRCompact(restaurant.month.billedPaise)} billed`,
        })),
    [props.restaurants],
  );

  // Twelve points of shape for the hero tile. The last is today.
  const sparkValues = props.trailingDaily.slice(-12).map((day) => day.commissionPaise);

  const meter: MeterSegment[] = [
    {
      key: "collected",
      label: "Collected",
      paise: props.collection.collectedPaise,
      tone: "collected",
      hint: `${props.collection.paidStatementCount} statement${
        props.collection.paidStatementCount === 1 ? "" : "s"
      } settled and referenced.`,
    },
    {
      key: "outstanding",
      label: "Invoiced, still owed",
      paise: props.collection.outstandingPaise,
      tone: "outstanding",
      hint:
        props.collection.oldestPendingDate === null
          ? "Nothing pending. Every statement written has been collected."
          : `${props.collection.pendingStatementCount} statement${
              props.collection.pendingStatementCount === 1 ? "" : "s"
            } pending, oldest ${formatDay(props.collection.oldestPendingDate)}.`,
    },
    {
      key: "unbilled",
      label: "Earned, not yet invoiced",
      paise: props.collection.unbilled.commissionPaise,
      tone: "unbilled",
      hint: `${props.collection.unbilled.orderCount} delivered order${
        props.collection.unbilled.orderCount === 1 ? "" : "s"
      } no statement has picked up. Today's are billed tonight.`,
    },
  ];

  // Delivered orders whose cash was never stamped at the gate. Legacy rows
  // predating the cash-on-delivery rewrite mostly, but a growing figure would
  // mean delivery staff are closing orders without recording the money.
  const unrecordedCashPaise = Math.max(
    props.lifetime.billedPaise - props.lifetime.cashCollectedPaise,
    0,
  );

  // Anything unbilled from BEFORE today has missed at least one run. Today's
  // orders are supposed to be sitting here, so they are not a warning.
  const staleUnbilled =
    props.collection.unbilled.oldestDate !== null &&
    props.collection.unbilled.oldestDate < props.todayDate;

  const monthLabel = formatMonth(props.month);

  return (
    <div className={cn("space-y-5", navigating && "opacity-60 transition-opacity")}>
      <header>
        <h1 className="font-display text-xl font-semibold text-bone">Earnings</h1>
        <p className="mt-1 text-sm text-muted">
          What every vendor sold, what they owe TREFOOD on it, and how much of that has actually
          come in. Money on this screen flows towards us — there is nothing to pay out.
        </p>
      </header>

      {/* One filter row above everything it scopes. Never inside a card. */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44">
            <Label htmlFor="earnings-campus">Campus</Label>
            <Select
              id="earnings-campus"
              value={props.selectedCampusId}
              onChange={(event) => go({ campus: event.target.value })}
            >
              <option value="">All campuses</option>
              {props.campuses.map((campus) => (
                <option key={campus.campusId} value={campus.campusId}>
                  {campus.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="min-w-40">
            <Label htmlFor="earnings-month">Month</Label>
            <Input
              id="earnings-month"
              type="month"
              value={props.month}
              onChange={(event) => {
                if (event.target.value !== "") go({ month: event.target.value });
              }}
            />
          </div>

          <div className="min-w-40">
            <Label htmlFor="earnings-day">Day</Label>
            <Input
              id="earnings-day"
              type="date"
              value={props.reportDay}
              max={props.todayDate}
              onChange={(event) => {
                if (event.target.value !== "") go({ day: event.target.value });
              }}
            />
          </div>

          <Button variant="secondary" asChild>
            <a href={exportHref(props.reportDay, props.reportDay)} download>
              <Download />
              Export day
            </a>
          </Button>

          {monthStart <= monthExportEnd ? (
            <Button variant="ghost" asChild>
              <a href={exportHref(monthStart, monthExportEnd)} download>
                <Download />
                Month, day by day
              </a>
            </Button>
          ) : null}

          <Button variant="ghost" asChild className="ml-auto">
            <Link href="/admin/settlements">Go to collections</Link>
          </Button>
        </div>
      </Card>

      {staleUnbilled ? (
        <Card className="border-chili/40 bg-chili-wash p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-chili" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-bone">
                Commission earned before today has never been invoiced
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {props.collection.unbilled.orderCount} delivered order
                {props.collection.unbilled.orderCount === 1 ? "" : "s"} worth{" "}
                <Money paise={props.collection.unbilled.commissionPaise} exact /> in commission are
                still waiting for a statement, the oldest from{" "}
                {formatDay(props.collection.unbilled.oldestDate ?? "")}. A settlement run bills
                every delivered order up to the end of its day, so running the missed day, or
                simply today, will sweep them up.
              </p>
              <Button size="sm" variant="secondary" asChild className="mt-3">
                <Link href="/admin/settlements">Run the statements</Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ---- The hero: what TREFOOD actually earns ---------------------- */}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-2">
            <BadgeIndianRupee className="size-4 text-saffron" />
            <p className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
              TREFOOD commission
            </p>
          </div>

          {/* The one hero figure on this view. Proportional digits, not tabular:
              tabular-nums makes a large standalone number look gappy. */}
          <p className="mt-3 text-5xl leading-none font-semibold text-bone">
            {formatINRCompact(props.monthTotal.commissionPaise)}
          </p>
          <p className="mt-2 text-xs text-muted">
            Earned in {monthLabel} on {props.monthTotal.orderCount.toLocaleString("en-IN")}{" "}
            delivered order
            {props.monthTotal.orderCount === 1 ? "" : "s"}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <Delta
              current={props.monthTotal.commissionPaise}
              previous={props.previousMonthTotal.commissionPaise}
              periodLabel={formatMonth(props.previousMonth)}
            />
            <Sparkline values={sparkValues} className="ml-auto text-saffron" />
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <CardTitle className="text-sm">Where that commission stands</CardTitle>
          <CardDescription className="mt-0.5 mb-4 text-xs">
            Commission we can collect, by state. These will not add up to commission earned, and
            are not meant to: a due under the ₹100 floor rolls into the next statement instead of
            being invoiced, and a ledger credit lowers a due without changing what was earned.
          </CardDescription>
          <CollectionMeter segments={meter} />
        </Card>
      </div>

      {/* ---- Volume tiles ---------------------------------------------- */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile
          label="Today"
          paise={props.today.billedPaise}
          caption={`${props.today.orderCount} order${props.today.orderCount === 1 ? "" : "s"}`}
          delta={{
            current: props.today.billedPaise,
            previous: props.yesterday.billedPaise,
            periodLabel: "yesterday",
          }}
        />
        <Tile
          label="Weekend"
          paise={props.weekend.billedPaise}
          caption="Saturday and Sunday combined"
        />
        <Tile
          label={monthLabel}
          paise={props.monthTotal.billedPaise}
          caption="All vendors in scope"
          delta={{
            current: props.monthTotal.billedPaise,
            previous: props.previousMonthTotal.billedPaise,
            periodLabel: formatMonth(props.previousMonth),
          }}
        />
        <Tile
          label={props.year}
          paise={props.yearTotal.billedPaise}
          caption="Calendar year to date"
        />
        <Tile
          label="Lifetime"
          paise={props.lifetime.billedPaise}
          caption={`${props.lifetime.orderCount.toLocaleString("en-IN")} orders since launch`}
        />
      </div>

      <p className="-mt-1 text-[11px] leading-relaxed text-faint">
        Tiles show what students were billed on delivered orders — the value flowing through
        TREFOOD, not TREFOOD&apos;s income. Our share of it is the commission figure above.
        {unrecordedCashPaise > 0 ? (
          <>
            {" "}
            Of the lifetime figure, <Money paise={unrecordedCashPaise} /> was never stamped as
            collected at the gate. The food was delivered and the money almost certainly changed
            hands, so this is a bookkeeping gap rather than a loss — and it does not affect
            commission, which is billed from the order, not from the cash field.
          </>
        ) : null}
      </p>

      {/* ---- Charts ----------------------------------------------------- */}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Commission earned per day</CardTitle>
            <CardDescription className="text-xs">
              {monthLabel}, by campus-local day. Empty days are drawn as zero rather than skipped.
            </CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <TrendChart
              points={trend}
              label={`Commission earned per day in ${monthLabel}`}
              emptyMessage="No delivered orders in this month yet."
            />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Commission by vendor</CardTitle>
            <CardDescription className="text-xs">
              {monthLabel}, ranked. Share is against the largest vendor, not the total.
            </CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <RankedBars bars={bars} emptyMessage="No vendor has delivered an order this month." />
          </div>
        </Card>
      </div>

      {/* ---- The day: every vendor, what they took, owe and handed over -- */}

      <DailyVendorReport day={props.reportDay} rows={props.dailyReport} />

      {/* ---- The table: every value above, reachable without hover ------ */}

      <div>
        <div className="mb-2.5 flex items-baseline gap-2">
          <Store className="size-4 shrink-0 self-center text-faint" />
          <h2 className="font-display text-base font-semibold text-bone">Vendor ledger</h2>
          <p className="text-xs text-muted">
            {monthLabel}. Every figure charted above, in full.
          </p>
        </div>

        {props.restaurants.length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-muted">
            No vendors on this campus yet.
          </Card>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Vendor</TH>
                <TH className="text-right">Today</TH>
                <TH className="text-right">Month billed</TH>
                <TH className="text-right">Rate</TH>
                <TH className="text-right">Commission</TH>
                <TH className="text-right">Owes us</TH>
                <TH className="text-right">Unbilled</TH>
                <TH>Last statement</TH>
              </tr>
            </THead>
            <TBody>
              {props.restaurants.map((restaurant) => {
                const stale =
                  restaurant.unbilled.oldestDate !== null &&
                  restaurant.unbilled.oldestDate < props.todayDate;

                return (
                  <TR key={restaurant.restaurantId}>
                    <TD>
                      <p className="font-medium">{restaurant.name}</p>
                      <p className="mt-0.5 text-[11px] text-faint">
                        {restaurant.campusName} · {restaurant.month.orderCount} order
                        {restaurant.month.orderCount === 1 ? "" : "s"} this month
                      </p>
                    </TD>
                    <TD className="text-right text-muted">
                      <Money paise={restaurant.today.billedPaise} />
                    </TD>
                    <TD className="text-right">
                      <Money paise={restaurant.month.billedPaise} />
                    </TD>
                    <TD className="text-right text-xs text-muted tabular">
                      {bpsToPct(restaurant.commissionBps)}%
                    </TD>
                    <TD className="text-right font-semibold text-saffron">
                      <Money paise={restaurant.month.commissionPaise} exact />
                    </TD>
                    <TD className="text-right">
                      {restaurant.outstandingPaise > 0 ? (
                        <span className="font-semibold text-amber">
                          <Money paise={restaurant.outstandingPaise} exact />
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </TD>
                    <TD className="text-right">
                      {restaurant.unbilled.commissionPaise > 0 ? (
                        <span className={stale ? "font-semibold text-chili" : "text-muted"}>
                          <Money paise={restaurant.unbilled.commissionPaise} exact />
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {restaurant.lastStatementDate === null ? (
                        <Badge tone="neutral">Never run</Badge>
                      ) : (
                        <span className="text-xs text-muted">
                          {formatDay(restaurant.lastStatementDate)}
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Pieces
   ══════════════════════════════════════════════════════════════════════ */

const COLLECTION_METHOD_LABEL: Record<"CASH" | "UPI" | "BANK_TRANSFER", string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
};

/**
 * One day, every vendor: what they took, what they made, what they owe us on
 * it, and what they have handed over.
 *
 * Orders taken are counted by when they reached the vendor; every money column
 * is counted by when the order was delivered, which is how the nightly
 * statement bills it. That is why "taken" and "delivered" can disagree across
 * midnight, and why the statement column can carry more than the day's own
 * commission — it sweeps up anything an earlier run missed, plus credits and
 * carry-forward.
 */
function DailyVendorReport({ day, rows }: { day: string; rows: DashboardDailyVendor[] }) {
  const totals = useMemo(
    () =>
      rows.reduce(
        (total, row) => ({
          ordersTaken: total.ordersTaken + row.ordersTaken,
          ordersDelivered: total.ordersDelivered + row.ordersDelivered,
          ordersCancelled: total.ordersCancelled + row.ordersCancelled,
          billedPaise: total.billedPaise + row.billedPaise,
          commissionPaise: total.commissionPaise + row.commissionPaise,
          vendorKeepsPaise: total.vendorKeepsPaise + row.vendorKeepsPaise,
          netDuePaise: total.netDuePaise + (row.statement?.netDuePaise ?? 0),
          submittedPaise: total.submittedPaise + row.submittedPaise,
          balancePaise: total.balancePaise + row.balancePaise,
          notRun: total.notRun + (row.statement === null && row.ordersDelivered > 0 ? 1 : 0),
        }),
        {
          ordersTaken: 0,
          ordersDelivered: 0,
          ordersCancelled: 0,
          billedPaise: 0,
          commissionPaise: 0,
          vendorKeepsPaise: 0,
          netDuePaise: 0,
          submittedPaise: 0,
          balancePaise: 0,
          notRun: 0,
        },
      ),
    [rows],
  );

  const dayLabel = formatDay(day);

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <CalendarDays className="size-4 shrink-0 self-center text-faint" />
        <h2 className="font-display text-base font-semibold text-bone">Vendors on {dayLabel}</h2>
        <p className="text-xs text-muted">
          Orders taken, what each vendor made, the commission they owe on it, and what they have
          handed over. Pick another day above.
        </p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Vendors made"
          paise={totals.billedPaise}
          caption={`${totals.ordersTaken} taken · ${totals.ordersDelivered} delivered · ${totals.ordersCancelled} cancelled`}
        />
        <Tile
          label="Commission owed"
          paise={totals.commissionPaise}
          caption="On this day's deliveries"
        />
        <Tile
          label="Handed over"
          paise={totals.submittedPaise}
          caption="Net due on statements marked collected"
        />
        <Tile
          label="Still owed"
          paise={totals.balancePaise}
          caption={
            totals.notRun > 0
              ? `${totals.notRun} vendor${totals.notRun === 1 ? "" : "s"} with no statement yet`
              : "Net due on statements not yet collected"
          }
        />
      </div>

      {rows.length === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-muted">
          No vendors on this campus yet.
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Vendor</TH>
              <TH className="text-right">Orders</TH>
              <TH className="text-right">Made</TH>
              <TH className="text-right">Commission</TH>
              <TH className="text-right">Vendor keeps</TH>
              <TH className="text-right">Statement due</TH>
              <TH>Handed over</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => {
              const idle = row.ordersTaken === 0 && row.ordersDelivered === 0;

              return (
                <TR key={`${row.restaurantId}-${row.date}`} className={cn(idle && "opacity-60")}>
                  <TD>
                    <p className="font-medium">{row.name}</p>
                    <p className="mt-0.5 text-[11px] text-faint">
                      {row.campusName}
                      {row.phone !== "" ? ` · ${row.phone}` : ""}
                    </p>
                  </TD>
                  <TD className="text-right">
                    <p className="font-medium tabular">{row.ordersTaken}</p>
                    <p className="mt-0.5 text-[11px] whitespace-nowrap text-faint">
                      {row.ordersDelivered} delivered · {row.ordersCancelled} cancelled
                    </p>
                  </TD>
                  <TD className="text-right">
                    <Money paise={row.billedPaise} exact />
                  </TD>
                  <TD className="text-right">
                    <p className="font-semibold text-saffron">
                      <Money paise={row.commissionPaise} exact />
                    </p>
                    <p className="mt-0.5 text-[11px] text-faint tabular">
                      {bpsToPct(row.commissionBps)}%
                    </p>
                  </TD>
                  <TD className="text-right text-muted">
                    <Money paise={row.vendorKeepsPaise} exact />
                  </TD>
                  <TD className="text-right">
                    {row.statement === null ? (
                      row.ordersDelivered > 0 ? (
                        <Badge tone="warning">Not run</Badge>
                      ) : (
                        <span className="text-faint">—</span>
                      )
                    ) : (
                      <Money paise={row.statement.netDuePaise} exact />
                    )}
                  </TD>
                  <TD className="whitespace-nowrap">
                    <HandedOver statement={row.statement} />
                  </TD>
                </TR>
              );
            })}

            <TR className="bg-surface-raised/40 font-semibold">
              <TD>Total</TD>
              <TD className="text-right tabular">{totals.ordersTaken}</TD>
              <TD className="text-right">
                <Money paise={totals.billedPaise} exact />
              </TD>
              <TD className="text-right text-saffron">
                <Money paise={totals.commissionPaise} exact />
              </TD>
              <TD className="text-right text-muted">
                <Money paise={totals.vendorKeepsPaise} exact />
              </TD>
              <TD className="text-right">
                <Money paise={totals.netDuePaise} exact />
              </TD>
              <TD>
                <span className="text-mint">
                  <Money paise={totals.submittedPaise} exact />
                </span>
                {totals.balancePaise > 0 ? (
                  <span className="ml-2 text-xs text-amber">
                    <Money paise={totals.balancePaise} exact /> owed
                  </span>
                ) : null}
              </TD>
            </TR>
          </TBody>
        </Table>
      )}
    </div>
  );
}

function HandedOver({ statement }: { statement: DashboardDailyVendor["statement"] }) {
  if (statement === null) return <span className="text-faint">—</span>;

  if (statement.netDuePaise <= 0) {
    return <span className="text-xs text-muted">Nothing due</span>;
  }

  if (statement.status === "PENDING") {
    return <Badge tone="warning">Pending</Badge>;
  }

  return (
    <div>
      <p className="font-medium text-mint">
        <Money paise={statement.netDuePaise} exact />
      </p>
      <p className="mt-0.5 text-[11px] text-faint">
        {statement.collectionMethod ? COLLECTION_METHOD_LABEL[statement.collectionMethod] : "Paid"}
        {statement.paymentReference ? ` · ${statement.paymentReference}` : ""}
      </p>
    </div>
  );
}

function Tile({
  label,
  paise,
  caption,
  delta,
}: {
  label: string;
  paise: number;
  caption: string;
  delta?: { current: number; previous: number; periodLabel: string };
}) {
  return (
    <Card className="p-3.5">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">{label}</p>
      {/* Proportional figures, not tabular — these are standalone values, and
          equal-width digits make them look loose at this size. */}
      <p className="mt-1.5 text-xl leading-none font-semibold text-bone">
        {formatINRCompact(paise)}
      </p>
      <p className="mt-1.5 text-[10px] leading-relaxed text-faint">{caption}</p>
      {delta ? (
        <div className="mt-2">
          <Delta {...delta} compact />
        </div>
      ) : null}
    </Card>
  );
}

/**
 * A signed change against a NAMED period.
 *
 * Naming the comparison is the whole point: "+12%" on its own is unreadable,
 * because the reader cannot tell whether it beat yesterday or last year. Up is
 * good here — every figure this sits under is money coming towards us.
 */
function Delta({
  current,
  previous,
  periodLabel,
  compact = false,
}: {
  current: number;
  previous: number;
  periodLabel: string;
  compact?: boolean;
}) {
  // No baseline means no comparison. Rendering "+100%" against zero would be
  // arithmetically true and completely meaningless.
  if (previous <= 0) {
    return (
      <p className={cn("text-faint", compact ? "text-[10px]" : "text-xs")}>
        No {periodLabel} figure to compare
      </p>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const flat = Math.abs(change) < 0.5;
  const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1",
        compact ? "text-[10px]" : "text-xs",
        flat ? "text-muted" : change > 0 ? "text-mint" : "text-chili",
      )}
    >
      <Icon className={compact ? "size-3" : "size-3.5"} />
      <span className="font-medium tabular">
        {change > 0 ? "+" : ""}
        {(flat ? ONE_DECIMAL_PERCENT : WHOLE_PERCENT).format(change)}%
      </span>
      <span className="text-faint">vs {periodLabel}</span>
    </p>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Date labels — string arithmetic, never a Date, so nothing can drift into
   the browser's timezone on its way to the screen.
   ══════════════════════════════════════════════════════════════════════ */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "September 2026" from "2026-09". */
function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${MONTH_NAMES[Number(monthNumber) - 1] ?? month} ${year ?? ""}`.trim();
}

/** "09 Sep 2026" from "2026-09-09". */
function formatDay(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day} ${MONTH_NAMES[Number(month) - 1]?.slice(0, 3) ?? month} ${year}`;
}
