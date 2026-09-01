import { describe, expect, it } from "vitest";

import { checkCurfew, curfewMessage, formatClock, minutesFromMidnightIn } from "../src/curfew.js";

const at = (hour: number, minute = 0) => hour * 60 + minute;

/** NIT Canteen's 20-minute prep plus the campus's 8-minute transit. */
const TRAVEL = { prepMinutes: 20, transitMinutes: 8 };

describe("the 10-minute buffer", () => {
  it("blocks a 21:25 order against a 21:30 curfew", () => {
    // docs/PROJECT_STRUCTURE.md §7.4 states this case explicitly. The order would
    // arrive at 21:53 — after the gate has shut — so it must never be taken.
    const result = checkCurfew({
      nowMinutes: at(21, 25),
      curfewMinutes: at(21, 30),
      ...TRAVEL,
    });
    expect(result.isBlocked).toBe(true);
    expect(formatClock(result.estimatedArrivalMinutes)).toBe("21:53");
  });

  it("allows an order that lands comfortably before the buffer", () => {
    const result = checkCurfew({
      nowMinutes: at(20, 30),
      curfewMinutes: at(21, 30),
      ...TRAVEL,
    });
    expect(result.isBlocked).toBe(false);
    expect(formatClock(result.estimatedArrivalMinutes)).toBe("20:58");
  });

  it("blocks arrival inside the buffer, even though the gate is technically open", () => {
    // Arrival 21:23, curfew 21:30. The gate is open — but seven minutes of margin is
    // not enough for a student to walk down, and a late handover cannot happen at all.
    const result = checkCurfew({
      nowMinutes: at(20, 55),
      curfewMinutes: at(21, 30),
      ...TRAVEL,
    });
    expect(formatClock(result.estimatedArrivalMinutes)).toBe("21:23");
    expect(result.isBlocked).toBe(true);
  });

  it("reports the last moment an order could still be placed", () => {
    const result = checkCurfew({
      nowMinutes: at(19, 0),
      curfewMinutes: at(21, 30),
      ...TRAVEL,
    });
    // 21:30 − 10 buffer − 28 travel = 20:52
    expect(formatClock(result.lastOrderMinutes ?? 0)).toBe("20:52");
    expect(result.minutesRemaining).toBe(112);
  });
});

describe("curfews that cross midnight", () => {
  /**
   * A 01:00 curfew means one in the MORNING OF THE NEXT DAY. Getting this wrong
   * would block every late-night order — and 22:30–02:30 is one of the two demand
   * clusters TREFOOD exists to serve.
   */
  it("treats a 01:00 curfew as tomorrow, so a 23:00 order is fine", () => {
    const result = checkCurfew({
      nowMinutes: at(23, 0),
      curfewMinutes: at(1, 0),
      ...TRAVEL,
    });
    expect(result.isBlocked).toBe(false);
    expect(formatClock(result.estimatedArrivalMinutes)).toBe("23:28");
  });

  it("blocks a 00:45 order against the same 01:00 curfew", () => {
    const result = checkCurfew({
      nowMinutes: at(0, 45),
      curfewMinutes: at(1, 0),
      ...TRAVEL,
    });
    expect(result.isBlocked).toBe(true);
    expect(formatClock(result.estimatedArrivalMinutes)).toBe("01:13");
  });

  it("still allows a 00:10 order against a 01:00 curfew", () => {
    const result = checkCurfew({
      nowMinutes: at(0, 10),
      curfewMinutes: at(1, 0),
      ...TRAVEL,
    });
    expect(result.isBlocked).toBe(false);
  });

  it("handles an arrival that itself crosses midnight", () => {
    const result = checkCurfew({
      nowMinutes: at(23, 50),
      curfewMinutes: at(1, 0),
      ...TRAVEL,
    });
    expect(formatClock(result.estimatedArrivalMinutes)).toBe("00:18");
    expect(result.isBlocked).toBe(false);
  });
});

describe("a curfew already in the past", () => {
  it("blocks, rather than silently rolling to tomorrow", () => {
    // 22:00 against a 21:30 curfew. Rolling forward a day would wrongly allow this.
    const result = checkCurfew({
      nowMinutes: at(22, 0),
      curfewMinutes: at(21, 30),
      ...TRAVEL,
    });
    expect(result.isBlocked).toBe(true);
  });

  it("blocks the academic block after 19:00", () => {
    const result = checkCurfew({
      nowMinutes: at(19, 30),
      curfewMinutes: at(19, 0),
      ...TRAVEL,
    });
    expect(result.isBlocked).toBe(true);
  });
});

describe("24×7 zones", () => {
  it("are never blocked, at any hour", () => {
    for (const hour of [0, 3, 9, 14, 21, 23]) {
      const result = checkCurfew({ nowMinutes: at(hour), curfewMinutes: undefined, ...TRAVEL });
      expect(result.isBlocked).toBe(false);
      expect(result.lastOrderMinutes).toBeUndefined();
    }
  });
});

describe("prep time affects the window", () => {
  it("a slower kitchen closes the window earlier", () => {
    const fast = checkCurfew({
      nowMinutes: at(20, 45),
      curfewMinutes: at(21, 30),
      prepMinutes: 15,
      transitMinutes: 8,
    });
    const slow = checkCurfew({
      nowMinutes: at(20, 45),
      curfewMinutes: at(21, 30),
      prepMinutes: 30,
      transitMinutes: 8,
    });
    expect(fast.isBlocked).toBe(false);
    expect(slow.isBlocked).toBe(true);
  });
});

describe("curfewMessage()", () => {
  it("gives the closing time, the deadline, and a way forward", () => {
    const result = checkCurfew({
      nowMinutes: at(19, 0),
      curfewMinutes: at(21, 30),
      ...TRAVEL,
    });
    const message = curfewMessage(
      "Kaveri Girls Hostel",
      at(21, 30),
      result,
      "Main Campus Gate",
    );
    expect(message).toContain("closes at 21:30");
    expect(message).toContain("Order by 20:52");
    // A blocked zone with no alternative is a dead end.
    expect(message).toContain("Main Campus Gate");
  });
});

describe("formatClock()", () => {
  it("pads to a 24-hour clock", () => {
    expect(formatClock(at(21, 30))).toBe("21:30");
    expect(formatClock(at(1, 5))).toBe("01:05");
    expect(formatClock(0)).toBe("00:00");
  });

  it("wraps a timeline value past midnight back onto the wall clock", () => {
    expect(formatClock(1500)).toBe("01:00"); // 25:00 -> 01:00
  });
});

describe("minutesFromMidnightIn()", () => {
  it("reads the campus clock, not the server clock", () => {
    // 18:30 UTC is midnight IST — the exact moment a naive UTC comparison would
    // place on the wrong day, and the reason curfews are never compared in UTC.
    const instant = new Date("2026-09-01T18:30:00.000Z");
    expect(minutesFromMidnightIn(instant, "Asia/Kolkata")).toBe(0);
    expect(minutesFromMidnightIn(instant, "UTC")).toBe(at(18, 30));
  });
});
