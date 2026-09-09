import { describe, expect, it } from "vitest";

import {
  datesOfMonth,
  emptyBucket,
  lastNDates,
  shiftMonth,
  sumBuckets,
  weekendOf,
  type EarningsBucket,
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
