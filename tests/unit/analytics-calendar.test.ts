import { describe, expect, it } from "vitest";

import {
  computePeakHour,
  datesOfMonth,
  datesOfWeek,
  dayOfWeekName,
  emptyBucket,
  formatHourRange,
  lastNDates,
  shiftDate,
  shiftMonth,
  sumBuckets,
  weekendOf,
  type EarningsBucket,
  type HourlyStat,
} from "@/server/services/analytics";

/**
 * The calendar arithmetic behind the earnings dashboard.
 *
 * These look like trivia and they are not. Every one of them decides which
 * orders land in which tile, so an off-by-one here is a wrong revenue figure
 * on a screen somebody makes decisions from — and it would look completely
 * plausible while being wrong.
 *
 * All of it is pure string arithmetic on campus-local dates. Nothing reads a
 * clock, which is exactly why it can be tested this directly.
 */

describe("weekendOf", () => {
  // 2026-09-09 is a Wednesday. The weekend it belongs to is the one just gone:
  // Saturday the 5th and Sunday the 6th.
  it("returns the Saturday and Sunday of the week containing the date", () => {
    expect(weekendOf("2026-09-09")).toEqual(["2026-09-05", "2026-09-06"]);
  });

  it("keeps a Saturday and its Sunday in the same weekend", () => {
    expect(weekendOf("2026-09-05")).toEqual(["2026-09-05", "2026-09-06"]);
    // The Sunday must look BACK to its Saturday, not forward to the next one.
    // Getting this wrong is what makes a Sunday tile read zero all morning.
    expect(weekendOf("2026-09-06")).toEqual(["2026-09-05", "2026-09-06"]);
  });

  it("crosses a month boundary rather than clamping inside it", () => {
    // Wednesday 2026-10-01. Its weekend is the previous September one.
    expect(weekendOf("2026-10-01")).toEqual(["2026-09-26", "2026-09-27"]);
  });

  it("crosses a year boundary", () => {
    // Friday 2027-01-01 belongs to the weekend of 26-27 December.
    expect(weekendOf("2027-01-01")).toEqual(["2026-12-26", "2026-12-27"]);
  });
});

describe("datesOfMonth", () => {
  it("covers a 30-day month exactly, with no neighbours", () => {
    const days = datesOfMonth("2026-09");
    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-09-01");
    expect(days.at(-1)).toBe("2026-09-30");
  });

  it("covers a 31-day month", () => {
    expect(datesOfMonth("2026-01")).toHaveLength(31);
  });

  it("gets February right in a common year and a leap year", () => {
    expect(datesOfMonth("2026-02")).toHaveLength(28);
    expect(datesOfMonth("2028-02")).toHaveLength(29);
    expect(datesOfMonth("2028-02").at(-1)).toBe("2028-02-29");
  });

  it("zero-pads every day, so the strings sort as dates", () => {
    const days = datesOfMonth("2026-09");
    expect(days[8]).toBe("2026-09-09");
    expect([...days].sort()).toEqual(days);
  });
});

describe("lastNDates", () => {
  it("ends on the given day and runs oldest first", () => {
    const days = lastNDates("2026-09-09", 30);
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toBe("2026-09-09");
    expect(days[0]).toBe("2026-08-11");
  });

  it("walks back across a month boundary", () => {
    expect(lastNDates("2026-10-02", 3)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("returns just the day itself for a window of one", () => {
    expect(lastNDates("2026-09-09", 1)).toEqual(["2026-09-09"]);
  });
});

describe("shiftMonth", () => {
  it("steps backwards and forwards within a year", () => {
    expect(shiftMonth("2026-09", -1)).toBe("2026-08");
    expect(shiftMonth("2026-09", 1)).toBe("2026-10");
  });

  it("wraps across a year boundary in both directions", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("zero-pads the month, so the result feeds straight back in", () => {
    expect(shiftMonth("2026-10", -1)).toBe("2026-09");
    expect(shiftMonth(shiftMonth("2026-01", -1), 1)).toBe("2026-01");
  });
});

describe("sumBuckets", () => {
  const bucket = (overrides: Partial<EarningsBucket>): EarningsBucket => ({
    ...emptyBucket(),
    ...overrides,
  });

  it("is zero for no buckets, so an empty day renders rather than throwing", () => {
    expect(sumBuckets([])).toEqual(emptyBucket());
  });

  it("adds every money field independently", () => {
    const total = sumBuckets([
      bucket({ orderCount: 2, cashCollectedPaise: 30_000, commissionPaise: 3_000 }),
      bucket({ orderCount: 1, cashCollectedPaise: 15_000, commissionPaise: 1_500 }),
    ]);

    expect(total.orderCount).toBe(3);
    expect(total.cashCollectedPaise).toBe(45_000);
    expect(total.commissionPaise).toBe(4_500);
  });

  it("stays in integer paise — a float here means money took a wrong turn", () => {
    const total = sumBuckets([
      bucket({ cashCollectedPaise: 12_345, commissionPaise: 1_235 }),
      bucket({ cashCollectedPaise: 67, commissionPaise: 7 }),
    ]);

    expect(Number.isSafeInteger(total.cashCollectedPaise)).toBe(true);
    expect(Number.isSafeInteger(total.commissionPaise)).toBe(true);
  });
});

describe("datesOfWeek", () => {
  it("returns 7 days from Monday to Sunday for any day of the week", () => {
    // 2026-10-31 is a Saturday
    const days = datesOfWeek("2026-10-31");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-10-26"); // Monday
    expect(days[1]).toBe("2026-10-27"); // Tuesday
    expect(days[2]).toBe("2026-10-28"); // Wednesday
    expect(days[3]).toBe("2026-10-29"); // Thursday
    expect(days[4]).toBe("2026-10-30"); // Friday
    expect(days[5]).toBe("2026-10-31"); // Saturday
    expect(days[6]).toBe("2026-11-01"); // Sunday
  });

  it("returns the exact same week when called with Monday or Sunday of that week", () => {
    const fromMonday = datesOfWeek("2026-10-26");
    const fromWednesday = datesOfWeek("2026-10-28");
    const fromSunday = datesOfWeek("2026-11-01");

    expect(fromMonday).toEqual(fromWednesday);
    expect(fromSunday).toEqual(fromWednesday);
  });

  it("crosses a year boundary correctly", () => {
    // 2026-01-01 is Thursday. Monday is 2025-12-29.
    const days = datesOfWeek("2026-01-01");
    expect(days[0]).toBe("2025-12-29");
    expect(days[3]).toBe("2026-01-01");
    expect(days[6]).toBe("2026-01-04");
  });
});

describe("shiftDate", () => {
  it("steps forward and backward by days", () => {
    expect(shiftDate("2026-10-26", 1)).toBe("2026-10-27");
    expect(shiftDate("2026-10-26", -7)).toBe("2026-10-19");
  });

  it("walks across month boundaries", () => {
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("walks across year boundaries", () => {
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("dayOfWeekName", () => {
  it("resolves full and short names correctly", () => {
    expect(dayOfWeekName("2026-10-26")).toEqual({ full: "Monday", short: "Mon" });
    expect(dayOfWeekName("2026-10-31")).toEqual({ full: "Saturday", short: "Sat" });
    expect(dayOfWeekName("2026-11-01")).toEqual({ full: "Sunday", short: "Sun" });
  });
});

describe("formatHourRange", () => {
  it("formats standard clock hours in 12-hour AM/PM notation", () => {
    expect(formatHourRange(0)).toBe("12:00 AM – 1:00 AM");
    expect(formatHourRange(11)).toBe("11:00 AM – 12:00 PM");
    expect(formatHourRange(12)).toBe("12:00 PM – 1:00 PM");
    expect(formatHourRange(20)).toBe("8:00 PM – 9:00 PM");
    expect(formatHourRange(23)).toBe("11:00 PM – 12:00 AM");
  });
});

describe("computePeakHour", () => {
  it("returns no orders when map is empty or undefined", () => {
    expect(computePeakHour(undefined)).toEqual({
      hour: null,
      label: "No orders",
      orderCount: 0,
      billedPaise: 0,
    });
    expect(computePeakHour(new Map())).toEqual({
      hour: null,
      label: "No orders",
      orderCount: 0,
      billedPaise: 0,
    });
  });

  it("selects the hour with highest order count as rush hour", () => {
    const map = new Map<number, HourlyStat>([
      [12, { orderCount: 5, billedPaise: 50_000 }],
      [13, { orderCount: 15, billedPaise: 120_000 }],
      [20, { orderCount: 25, billedPaise: 200_000 }],
      [21, { orderCount: 10, billedPaise: 80_000 }],
    ]);

    const peak = computePeakHour(map);
    expect(peak.hour).toBe(20);
    expect(peak.label).toBe("8:00 PM – 9:00 PM");
    expect(peak.orderCount).toBe(25);
    expect(peak.billedPaise).toBe(200_000);
  });

  it("breaks ties with higher billed revenue", () => {
    const map = new Map<number, HourlyStat>([
      [13, { orderCount: 12, billedPaise: 80_000 }],
      [20, { orderCount: 12, billedPaise: 110_000 }],
    ]);

    const peak = computePeakHour(map);
    expect(peak.hour).toBe(20);
    expect(peak.billedPaise).toBe(110_000);
  });
});
