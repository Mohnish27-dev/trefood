import "server-only";

import * as db from "@/server/db/collections";
import { ORDER_STATUS } from "@/lib/constants";
import { campusDateString } from "@/lib/campus-time";
import type { Bps, Paise } from "@/lib/money";
import type { Campus } from "@/types/campus";

/**
 * Read-only analytics for the admin earnings dashboard.
 *
 * ★ MONEY FLOWS VENDOR -> TREFOOD. NOTHING ON THIS SCREEN IS A PAYOUT. ★
 *
 * Every order is cash on delivery. The vendor's own staff came back from the
 * gate holding the full bill, so "revenue" here is the vendor's, and TREFOOD's
 * income is the commission line inside it. A column called "payable" would be
 * the wrong shape entirely; what a vendor has is a balance they owe us.
 *
 * Two independent sources, deliberately not merged:
 *
 *   ORDERS      — what was actually delivered. Live to the second, so today's
 *                 numbers exist hours before the nightly run writes anything.
 *                 This is the ACCRUAL view: commission earned.
 *   STATEMENTS  — what has been invoiced and what has been handed over. Only
 *                 exists after the run. This is the CASH view: commission
 *                 collected, and commission still outstanding.
 *
 * Holding them apart is the point. The gap between "earned" and "invoiced" is
 * exactly where money goes missing, and `unbilled` below measures it: orders
 * that were delivered, and are therefore owed on, but that no statement has
 * ever picked up. On a healthy system it is only today's orders. Anything
 * older sitting in there is commission nobody has billed.
 *
 * Nothing in this file writes. An analytics screen that can mutate money is a
 * screen that will, eventually, mutate money by accident.
 */

/* ══════════════════════════════════════════════════════════════════════
   Shapes
   ══════════════════════════════════════════════════════════════════════ */

/** One additive bundle of delivered-order money. Every total is a sum of these. */
export interface EarningsBucket {
  orderCount: number;
  /**
   * What the student was billed: `pricing.grandTotalPaise`. THE REVENUE LINE.
   *
   * Deliberately not `cashCollected`. Both should be identical on a delivered
   * order, but `grandTotal` is written once at creation and never touched
   * again, while `cashCollected` is stamped at handover and is empty on every
   * order predating the cash-on-delivery rewrite. Fourteen of the first
   * forty-seven delivered orders on this system carry a real bill and a zero
   * in that field, so driving revenue off it understates the business by a
   * quarter — silently, and in the direction that looks like failure.
   */
  billedPaise: Paise;
  /**
   * What the vendor's staff recorded taking at the gate. Reconciliation only.
   *
   * Where this trails `billedPaise` the money was almost certainly collected
   * and never recorded, so the gap measures bookkeeping rather than loss. It
   * is shown as its own figure and never mixed into revenue.
   */
  cashCollectedPaise: Paise;
  /** subtotal + packaging + delivery, before the vendor-absorbed discount. */
  grossPaise: Paise;
  /** TREFOOD's income. What the vendor owes us on these orders. */
  commissionPaise: Paise;
  /** Vendor-absorbed coupon spend. Costs the vendor, never TREFOOD. */
  discountPaise: Paise;
}

export interface DailyPoint extends EarningsBucket {
  /** Campus-local "YYYY-MM-DD". */
  date: string;
}

/** Delivered, owed on, and never invoiced by any settlement run. */
export interface UnbilledSlice {
  orderCount: number;
  commissionPaise: Paise;
  /** Campus-local day of the oldest one. Null when there are none. */
  oldestDate: string | null;
}

export interface RestaurantEarnings {
  restaurantId: string;
  name: string;
  campusName: string;
  /** The rate actually applied to this vendor: their override, else the campus rate. */
  commissionBps: Bps;

  today: EarningsBucket;
  month: EarningsBucket;
  lifetime: EarningsBucket;

  /** Invoiced, not yet handed over. The chase list. */
  outstandingPaise: Paise;
  /** Invoiced and handed over. */
  collectedPaise: Paise;
  /** Rolling in or out of the next invoice. Signed against the vendor's due. */
  carriedForwardPaise: number;

  unbilled: UnbilledSlice;
  lastStatementDate: string | null;
}

export interface CollectionHealth {
  collectedPaise: Paise;
  outstandingPaise: Paise;
  pendingStatementCount: number;
  paidStatementCount: number;
  /** Campus-local day of the oldest unpaid statement. What ages the debt. */
  oldestPendingDate: string | null;
  unbilled: UnbilledSlice;
}

export interface EarningsAnalytics {
  /** Campus-local today, in the scope's timezone. */
  todayDate: string;
  /** "YYYY-MM" the month figures cover. */
  month: string;
  previousMonth: string;
  year: string;

  today: EarningsBucket;
  yesterday: EarningsBucket;
  /** Saturday and Sunday of the week containing today, combined. */
  weekend: EarningsBucket;
  monthTotal: EarningsBucket;
  previousMonthTotal: EarningsBucket;
  yearTotal: EarningsBucket;
  lifetime: EarningsBucket;

  /** Every day of the selected month, gap-filled. Drives the trend chart. */
  monthDaily: DailyPoint[];
  /** The 30 campus-local days ending today, gap-filled. */
  trailingDaily: DailyPoint[];

  restaurants: RestaurantEarnings[];
  collection: CollectionHealth;
}

/* ══════════════════════════════════════════════════════════════════════
   Entry point
   ══════════════════════════════════════════════════════════════════════ */

export async function getEarningsAnalytics(params: {
  /** One campus, or every campus when the caller passes them all. */
  campuses: Campus[];
  /** "YYYY-MM". Defaults to the campus-local current month. */
  month?: string;
  now?: Date;
}): Promise<EarningsAnalytics> {
  const now = params.now ?? new Date();
  // With no campus there is no campus-local anything, so fall back to the zone
  // every campus in this system actually uses rather than the server's UTC.
  const timezone = params.campuses[0]?.timezone ?? "Asia/Kolkata";

  const todayDate = campusDateString(now, timezone);
  const month = params.month ?? todayDate.slice(0, 7);
  const year = todayDate.slice(0, 4);

  const campusIds = params.campuses.map((campus) => campus._id);
  const restaurantsById = await restaurantIndex(campusIds);

  // One pass per campus, because `$dateToString` takes a single timezone and
  // two campuses can legitimately sit in two of them. Merged on the way out.
  const perDay = new Map<string, Map<string, EarningsBucket>>();
  const unbilledByRestaurant = new Map<string, UnbilledSlice>();

  await Promise.all(
    params.campuses.flatMap((campus) => [
      collectDelivered({ campus, into: perDay }),
      collectUnbilled({ campus, into: unbilledByRestaurant }),
    ]),
  );

  const statementRollup = await collectStatements(campusIds);

  /* ---- Period totals ------------------------------------------------ */

  const inPeriod = (matches: (date: string) => boolean): EarningsBucket =>
    sumBuckets(datesMatching(perDay, matches));

  const yesterdayDate = campusDateString(new Date(now.getTime() - 86_400_000), timezone);
  const weekendDates = weekendOf(todayDate);
  const previousMonth = shiftMonth(month, -1);

  const analytics: EarningsAnalytics = {
    todayDate,
    month,
    previousMonth,
    year,

    today: inPeriod((date) => date === todayDate),
    yesterday: inPeriod((date) => date === yesterdayDate),
    weekend: inPeriod((date) => weekendDates.includes(date)),
    monthTotal: inPeriod((date) => date.startsWith(month)),
    previousMonthTotal: inPeriod((date) => date.startsWith(previousMonth)),
    yearTotal: inPeriod((date) => date.startsWith(year)),
    lifetime: inPeriod(() => true),

    monthDaily: gapFill(perDay, datesOfMonth(month)),
    trailingDaily: gapFill(perDay, lastNDates(todayDate, 30)),

    restaurants: [],
    collection: {
      ...statementRollup.totals,
      unbilled: mergeUnbilled([...unbilledByRestaurant.values()]),
    },
  };

  /* ---- Per-restaurant ----------------------------------------------- */

  const noUnbilled: UnbilledSlice = { orderCount: 0, commissionPaise: 0, oldestDate: null };

  analytics.restaurants = [...restaurantsById.values()]
    .map((restaurant) => {
      const byDate = perDay.get(restaurant.restaurantId) ?? new Map<string, EarningsBucket>();
      const statement = statementRollup.byRestaurant.get(restaurant.restaurantId);

      return {
        ...restaurant,
        today: byDate.get(todayDate) ?? emptyBucket(),
        month: sumBuckets(
          [...byDate.entries()]
            .filter(([date]) => date.startsWith(month))
            .map(([, bucket]) => bucket),
        ),
        lifetime: sumBuckets([...byDate.values()]),
        outstandingPaise: statement?.outstandingPaise ?? 0,
        collectedPaise: statement?.collectedPaise ?? 0,
        carriedForwardPaise: statement?.carriedForwardPaise ?? 0,
        unbilled: unbilledByRestaurant.get(restaurant.restaurantId) ?? noUnbilled,
        lastStatementDate: statement?.lastStatementDate ?? null,
      };
    })
    // Biggest earner first: the list is read top-down and the top is where the
    // money is. Ties break by name so the order never jitters between loads.
    .sort(
      (a, b) => b.month.commissionPaise - a.month.commissionPaise || a.name.localeCompare(b.name),
    );

  return analytics;
}

/* ══════════════════════════════════════════════════════════════════════
   Aggregations
   ══════════════════════════════════════════════════════════════════════ */

/** Delivered money, grouped by restaurant and campus-local day. */
async function collectDelivered(params: {
  campus: Campus;
  into: Map<string, Map<string, EarningsBucket>>;
}): Promise<void> {
  interface Row {
    _id: { restaurantId: string; date: string };
    orderCount: number;
    billedPaise: number;
    cashCollectedPaise: number;
    grossPaise: number;
    commissionPaise: number;
    discountPaise: number;
  }

  const rows = await (await db.orders())
    .aggregate<Row>([
      {
        $match: {
          campusId: params.campus._id,
          // SETTLED as well as DELIVERED: an invoiced order is still a
          // delivered one. Dropping it would make every historical day read as
          // zero the morning after it was settled.
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.SETTLED] },
          "timestamps.deliveredAt": { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            restaurantId: "$restaurantId",
            date: {
              $dateToString: {
                date: "$timestamps.deliveredAt",
                format: "%Y-%m-%d",
                // The bucket boundary is the campus's midnight, never the
                // server's. On Vercel the server is UTC, which would push
                // every order after 18:30 IST into the following day.
                timezone: params.campus.timezone,
              },
            },
          },
          orderCount: { $sum: 1 },
          billedPaise: { $sum: "$pricing.grandTotalPaise" },
          cashCollectedPaise: { $sum: "$payment.cashCollectedPaise" },
          grossPaise: { $sum: "$pricing.commissionBasePaise" },
          commissionPaise: { $sum: "$pricing.platformCommissionPaise" },
          discountPaise: { $sum: "$pricing.discountPaise" },
        },
      },
    ])
    .toArray();

  for (const row of rows) {
    const byDate = params.into.get(row._id.restaurantId) ?? new Map<string, EarningsBucket>();
    // += rather than =: a restaurant cannot span campuses today, but summing
    // costs nothing and keeps this correct if one ever does.
    const existing = byDate.get(row._id.date) ?? emptyBucket();
    byDate.set(row._id.date, {
      orderCount: existing.orderCount + row.orderCount,
      billedPaise: existing.billedPaise + row.billedPaise,
      cashCollectedPaise: existing.cashCollectedPaise + row.cashCollectedPaise,
      grossPaise: existing.grossPaise + row.grossPaise,
      commissionPaise: existing.commissionPaise + row.commissionPaise,
      discountPaise: existing.discountPaise + row.discountPaise,
    });
    params.into.set(row._id.restaurantId, byDate);
  }
}

/**
 * Delivered, owed on, and never invoiced.
 *
 * DELIVERED means the money is earned; SETTLED means a statement has picked it
 * up. So anything still sitting in DELIVERED is commission we have not billed.
 * Today's orders are supposed to be here — they are billed tonight. Anything
 * dated before today is a genuine leak, and the dashboard says so out loud.
 */
async function collectUnbilled(params: {
  campus: Campus;
  into: Map<string, UnbilledSlice>;
}): Promise<void> {
  interface Row {
    _id: string;
    orderCount: number;
    commissionPaise: number;
    oldestAt: Date | null;
  }

  const rows = await (await db.orders())
    .aggregate<Row>([
      {
        $match: {
          campusId: params.campus._id,
          status: ORDER_STATUS.DELIVERED,
          "timestamps.deliveredAt": { $ne: null },
        },
      },
      {
        $group: {
          _id: "$restaurantId",
          orderCount: { $sum: 1 },
          commissionPaise: { $sum: "$pricing.platformCommissionPaise" },
          oldestAt: { $min: "$timestamps.deliveredAt" },
        },
      },
    ])
    .toArray();

  for (const row of rows) {
    const existing = params.into.get(row._id);
    const oldestDate = row.oldestAt ? campusDateString(row.oldestAt, params.campus.timezone) : null;

    params.into.set(row._id, {
      orderCount: (existing?.orderCount ?? 0) + row.orderCount,
      commissionPaise: (existing?.commissionPaise ?? 0) + row.commissionPaise,
      oldestDate: earlierDate(existing?.oldestDate ?? null, oldestDate),
    });
  }
}

interface StatementSlice {
  outstandingPaise: Paise;
  collectedPaise: Paise;
  carriedForwardPaise: number;
  lastStatementDate: string | null;
}

/**
 * The cash view: what has been invoiced, and what has actually come in.
 *
 * `netDuePaise` is the only figure that means "hand this over" — commissionDue
 * is pre-adjustment and pre-carry, so summing that instead would overstate
 * collections by every credit ever issued.
 */
async function collectStatements(campusIds: string[]): Promise<{
  byRestaurant: Map<string, StatementSlice>;
  totals: Omit<CollectionHealth, "unbilled">;
}> {
  const statements = await (await db.commissionStatements())
    .find({ campusId: { $in: campusIds } })
    .toArray();

  const byRestaurant = new Map<string, StatementSlice>();
  const totals = {
    collectedPaise: 0,
    outstandingPaise: 0,
    pendingStatementCount: 0,
    paidStatementCount: 0,
    oldestPendingDate: null as string | null,
  };

  for (const row of statements) {
    const slice = byRestaurant.get(row.restaurantId) ?? {
      outstandingPaise: 0,
      collectedPaise: 0,
      carriedForwardPaise: 0,
      lastStatementDate: null,
    };

    if (row.status === "PAID") {
      slice.collectedPaise += row.netDuePaise;
      totals.collectedPaise += row.netDuePaise;
      totals.paidStatementCount += 1;
    } else {
      slice.outstandingPaise += row.netDuePaise;
      totals.outstandingPaise += row.netDuePaise;
      // A zero-due statement is a real statement, but it is not a debt and
      // must never age the oldest-pending marker.
      if (row.netDuePaise > 0) {
        totals.pendingStatementCount += 1;
        totals.oldestPendingDate = earlierDate(totals.oldestPendingDate, row.statementDate);
      }
    }

    // The newest statement's carry is the live balance; earlier ones were
    // already absorbed into the statements that followed them.
    if (slice.lastStatementDate === null || row.statementDate > slice.lastStatementDate) {
      slice.lastStatementDate = row.statementDate;
      slice.carriedForwardPaise = row.carriedForwardPaise;
    }

    byRestaurant.set(row.restaurantId, slice);
  }

  return { byRestaurant, totals };
}

/** Name, campus and effective commission rate for every vendor in scope. */
async function restaurantIndex(
  campusIds: string[],
): Promise<
  Map<string, { restaurantId: string; name: string; campusName: string; commissionBps: Bps }>
> {
  const [restaurants, campuses] = await Promise.all([
    (await db.restaurants())
      .find({ campusId: { $in: campusIds } })
      .sort({ name: 1 })
      .toArray(),
    (await db.campuses()).find({ _id: { $in: campusIds } }).toArray(),
  ]);

  const campusById = new Map(campuses.map((campus) => [campus._id, campus]));

  return new Map(
    restaurants.map((restaurant) => {
      const campus = campusById.get(restaurant.campusId);
      return [
        restaurant._id,
        {
          restaurantId: restaurant._id,
          name: restaurant.name,
          campusName: campus?.name ?? "Unknown campus",
          // Mirrors pricing: the override wins, the campus rate is the default.
          commissionBps: restaurant.commissionBpsOverride ?? campus?.settings.commissionBps ?? 0,
        },
      ];
    }),
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Bucket arithmetic and calendar helpers

   All string dates, all campus-local. Nothing below reads a clock, so none of
   it can drift into the server's timezone.
   ══════════════════════════════════════════════════════════════════════ */

export function emptyBucket(): EarningsBucket {
  return {
    orderCount: 0,
    billedPaise: 0,
    cashCollectedPaise: 0,
    grossPaise: 0,
    commissionPaise: 0,
    discountPaise: 0,
  };
}

export function sumBuckets(buckets: readonly EarningsBucket[]): EarningsBucket {
  return buckets.reduce<EarningsBucket>(
    (total, bucket) => ({
      orderCount: total.orderCount + bucket.orderCount,
      billedPaise: total.billedPaise + bucket.billedPaise,
      cashCollectedPaise: total.cashCollectedPaise + bucket.cashCollectedPaise,
      grossPaise: total.grossPaise + bucket.grossPaise,
      commissionPaise: total.commissionPaise + bucket.commissionPaise,
      discountPaise: total.discountPaise + bucket.discountPaise,
    }),
    emptyBucket(),
  );
}

function datesMatching(
  perDay: Map<string, Map<string, EarningsBucket>>,
  matches: (date: string) => boolean,
): EarningsBucket[] {
  const out: EarningsBucket[] = [];
  for (const byDate of perDay.values()) {
    for (const [date, bucket] of byDate) {
      if (matches(date)) out.push(bucket);
    }
  }
  return out;
}

/**
 * One point per date, zero where nothing was delivered.
 *
 * A chart that silently drops empty days draws a busy Tuesday and a dead
 * Wednesday as neighbours of equal width, which reads as "steady" when it was
 * anything but. The zeros are the story.
 */
function gapFill(
  perDay: Map<string, Map<string, EarningsBucket>>,
  dates: readonly string[],
): DailyPoint[] {
  const totals = new Map<string, EarningsBucket[]>();
  for (const byDate of perDay.values()) {
    for (const [date, bucket] of byDate) {
      const list = totals.get(date);
      if (list) list.push(bucket);
      else totals.set(date, [bucket]);
    }
  }

  return dates.map((date) => ({ date, ...sumBuckets(totals.get(date) ?? []) }));
}

/** "YYYY-MM" split into its two numbers. Anything malformed reads as month one. */
function monthParts(month: string): { year: number; monthNumber: number } {
  const [year, monthNumber] = month.split("-");
  return { year: Number(year), monthNumber: Number(monthNumber) };
}

/** Every "YYYY-MM-DD" in a "YYYY-MM", in order. */
export function datesOfMonth(month: string): string[] {
  const { year, monthNumber } = monthParts(month);
  // Day 0 of the NEXT month is the last day of this one — the only leap-year
  // rule worth trusting is the one the Date constructor already implements.
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: dayCount }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** The N campus-local days ending at `endDate`, oldest first. */
export function lastNDates(endDate: string, count: number): string[] {
  const end = Date.parse(`${endDate}T12:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * Saturday and Sunday of the week containing `date`.
 *
 * Anchored to the week rather than to "the last two days", so on a Wednesday
 * the tile shows the weekend just gone rather than half of it.
 */
export function weekendOf(date: string): string[] {
  const at = new Date(`${date}T12:00:00Z`);
  // getUTCDay: 0 is Sunday, 6 is Saturday. (day + 1) % 7 is the number of days
  // back to the most recent Saturday, and it maps Sunday to 1 rather than 0 —
  // which is what keeps a Sunday attached to the weekend it belongs to.
  const saturday = new Date(at.getTime() - ((at.getUTCDay() + 1) % 7) * 86_400_000);
  return [
    saturday.toISOString().slice(0, 10),
    new Date(saturday.getTime() + 86_400_000).toISOString().slice(0, 10),
  ];
}

export function shiftMonth(month: string, delta: number): string {
  const { year, monthNumber } = monthParts(month);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Lexicographic works because every date here is a zero-padded ISO day. */
function earlierDate(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a < b ? a : b;
}

function mergeUnbilled(slices: readonly UnbilledSlice[]): UnbilledSlice {
  return slices.reduce<UnbilledSlice>(
    (total, slice) => ({
      orderCount: total.orderCount + slice.orderCount,
      commissionPaise: total.commissionPaise + slice.commissionPaise,
      oldestDate: earlierDate(total.oldestDate, slice.oldestDate),
    }),
    { orderCount: 0, commissionPaise: 0, oldestDate: null },
  );
}
