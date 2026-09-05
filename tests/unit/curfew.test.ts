import { describe, expect, it } from "vitest";

import {
  campusLocalMinutes,
  checkCampusCurfews,
  checkCurfew,
  curfewMessageWithFallback,
  formatMinutes,
  formatTime12h,
  getEffectiveMinOrderPaise,
  isGateOpenAt,
  minutesUntilClose,
  parseMinutes,
} from "@/server/services/curfew";
import { ZONE_TYPE } from "@/lib/constants";
import type { DeliveryZone } from "@/types/campus";

const IST = "Asia/Kolkata";

function zone(overrides: Partial<DeliveryZone> = {}): DeliveryZone {
  return {
    id: "ganga-girls",
    name: "Kaveri Girls Hostel",
    zoneType: ZONE_TYPE.HOSTEL_GIRLS,
    curfewMinutes: 21 * 60 + 30, // 21:30
    opensMinutes: 6 * 60,
    lat: 25.62,
    lng: 85.17,
    instructions: "Hand over at the guard cabin.",
    isActive: true,
    isFallback: false,
    ...overrides,
  };
}

/** A Date whose IST wall-clock reads exactly hh:mm. IST is UTC+5:30. */
function istAt(hh: number, mm: number): Date {
  return new Date(Date.UTC(2026, 8, 1, hh, mm) - (5 * 60 + 30) * 60_000);
}

/* ══════════════════════════════════════════════════════════════════════
   The clock — campus timezone, never the server clock
   ══════════════════════════════════════════════════════════════════════ */

describe("campus-local clock", () => {
  it("reads IST wall time, not UTC", () => {
    // Vercel runs in UTC. Reading the server clock here would be 5h30m wrong,
    // which is the difference between an open gate and a locked one.
    const t = istAt(21, 25);
    expect(campusLocalMinutes(t, IST)).toBe(21 * 60 + 25);
    expect(campusLocalMinutes(t, "UTC")).toBe(15 * 60 + 55);
  });

  it("handles midnight as 0, not 24:00", () => {
    expect(campusLocalMinutes(istAt(0, 0), IST)).toBe(0);
  });

  it("round-trips HH:MM", () => {
    expect(formatMinutes(1_290)).toBe("21:30");
    expect(parseMinutes("21:30")).toBe(1_290);
    expect(formatMinutes(0)).toBe("00:00");
    expect(parseMinutes("00:00")).toBe(0);
    expect(() => parseMinutes("25:00")).toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════════════
   The case the spec names: a 21:30 curfew blocks a 21:25 arrival.
   PROJECT_STRUCTURE.md section 7.4.
   ══════════════════════════════════════════════════════════════════════ */

describe("the 10-minute buffer", () => {
  const base = { timezone: IST, transitMinutes: 8, bufferMinutes: 10, zone: zone() };

  it("blocks an order arriving at 21:25 against a 21:30 curfew", () => {
    // now 21:10 + prep 7 + transit 8 = arrival 21:25, which is inside the
    // 21:20 cutoff. A coin flip at a hostel gate is a refund and an angry student.
    const verdict = checkCurfew({ ...base, now: istAt(21, 10), prepMinutes: 7 });

    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe("ARRIVES_TOO_LATE");
    expect(verdict.estimatedArrivalMinutes).toBe(21 * 60 + 25);
    expect(verdict.message).toContain("21:30");
    expect(verdict.message).toContain("21:25");
  });

  it("allows an order arriving at 21:19, just inside the cutoff", () => {
    const verdict = checkCurfew({ ...base, now: istAt(21, 1), prepMinutes: 7 });
    expect(verdict.estimatedArrivalMinutes).toBe(21 * 60 + 16);
    expect(verdict.available).toBe(true);
  });

  it("is exact at the boundary — arrival + buffer === curfew is allowed", () => {
    // arrival 21:20 + 10 buffer === 21:30. Not "too close", exactly at the line.
    const verdict = checkCurfew({ ...base, now: istAt(21, 5), prepMinutes: 7 });
    expect(verdict.estimatedArrivalMinutes).toBe(21 * 60 + 20);
    expect(verdict.available).toBe(true);
  });

  it("blocks one minute past the boundary", () => {
    const verdict = checkCurfew({ ...base, now: istAt(21, 6), prepMinutes: 7 });
    expect(verdict.estimatedArrivalMinutes).toBe(21 * 60 + 21);
    expect(verdict.available).toBe(false);
  });

  it("tells the student the last minute they could have ordered", () => {
    const verdict = checkCurfew({ ...base, now: istAt(20, 0), prepMinutes: 15 });
    // 21:30 - 10 buffer - 15 prep - 8 transit = 20:57
    expect(verdict.orderByMinutes).toBe(20 * 60 + 57);
    expect(verdict.available).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Curfews that cross midnight — a 01:00 cutoff means NEXT DAY
   ══════════════════════════════════════════════════════════════════════ */

describe("a curfew crossing midnight", () => {
  // Opens 06:00, shuts 01:00 the following morning.
  const lateGate = zone({ id: "boys", name: "Ganga Boys Hostel", curfewMinutes: 60, opensMinutes: 360 });

  it("is open at 23:00, which is before the 01:00 cutoff of the NEXT day", () => {
    expect(isGateOpenAt(lateGate, 23 * 60)).toBe(true);
    expect(minutesUntilClose(lateGate, 23 * 60)).toBe(120);
  });

  it("is still open at 00:30", () => {
    expect(isGateOpenAt(lateGate, 30)).toBe(true);
    expect(minutesUntilClose(lateGate, 30)).toBe(30);
  });

  it("is shut at 03:00, between the 01:00 close and the 06:00 open", () => {
    expect(isGateOpenAt(lateGate, 3 * 60)).toBe(false);
    expect(minutesUntilClose(lateGate, 3 * 60)).toBe(0);
  });

  it("allows a 23:30 order that lands at 23:53", () => {
    const verdict = checkCurfew({
      now: istAt(23, 30),
      timezone: IST,
      zone: lateGate,
      prepMinutes: 15,
      transitMinutes: 8,
      bufferMinutes: 10,
    });
    expect(verdict.available).toBe(true);
    expect(verdict.estimatedArrivalMinutes).toBe(23 * 60 + 53);
  });

  it("blocks a 00:45 order that would land after the 01:00 cutoff", () => {
    const verdict = checkCurfew({
      now: istAt(0, 45),
      timezone: IST,
      zone: lateGate,
      prepMinutes: 15,
      transitMinutes: 8,
      bufferMinutes: 10,
    });
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe("ARRIVES_TOO_LATE");
    // Arrival wraps past midnight into the next day.
    expect(verdict.estimatedArrivalMinutes).toBe(68);
  });

  it("refuses entirely at 04:00 when the gate is simply shut", () => {
    const verdict = checkCurfew({
      now: istAt(4, 0),
      timezone: IST,
      zone: lateGate,
      prepMinutes: 15,
      transitMinutes: 8,
      bufferMinutes: 10,
    });
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe("GATE_SHUT_NOW");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   24x7 gates and the fallback offer
   ══════════════════════════════════════════════════════════════════════ */

describe("the 24x7 main gate", () => {
  const mainGate = zone({
    id: "main",
    name: "Main Campus Gate",
    zoneType: ZONE_TYPE.MAIN_GATE,
    curfewMinutes: null,
    isFallback: true,
  });

  it("is never blocked, at any hour", () => {
    for (const hour of [0, 3, 12, 21, 23]) {
      const verdict = checkCurfew({
        now: istAt(hour, 0),
        timezone: IST,
        zone: mainGate,
        prepMinutes: 30,
        transitMinutes: 15,
        bufferMinutes: 10,
      });
      expect(verdict.available).toBe(true);
      expect(verdict.minutesUntilClose).toBeNull();
    }
  });

  it("is offered by name whenever another zone is blocked", () => {
    const report = checkCampusCurfews({
      now: istAt(21, 10),
      timezone: IST,
      zones: [zone(), mainGate],
      prepMinutes: 7,
      transitMinutes: 8,
      bufferMinutes: 10,
    });

    expect(report.fallbackZone?.id).toBe("main");

    const blocked = report.verdicts.find((v) => v.zoneId === "ganga-girls");
    expect(blocked).toBeDefined();
    if (!blocked) return;
    expect(blocked.available).toBe(false);

    const message = curfewMessageWithFallback(blocked, report.fallbackZone);
    // The plain-language sentence the student actually reads at checkout.
    expect(message).toContain("21:30");
    expect(message).toContain("Main Campus Gate");
    expect(message).toContain("24x7");
  });

  it("says nothing for an available zone", () => {
    const report = checkCampusCurfews({
      now: istAt(12, 0),
      timezone: IST,
      zones: [zone(), mainGate],
      prepMinutes: 15,
      transitMinutes: 8,
      bufferMinutes: 10,
    });
    for (const verdict of report.verdicts) {
      expect(verdict.available).toBe(true);
      expect(curfewMessageWithFallback(verdict, report.fallbackZone)).toBeNull();
    }
  });
});

describe("an academic block with an early 19:00 curfew", () => {
  const academic = zone({
    id: "academic",
    name: "Academic Block",
    zoneType: ZONE_TYPE.ACADEMIC,
    curfewMinutes: 19 * 60,
    opensMinutes: 8 * 60,
  });

  it("is open for a 16:00 post-lecture order", () => {
    const verdict = checkCurfew({
      now: istAt(16, 0),
      timezone: IST,
      zone: academic,
      prepMinutes: 20,
      transitMinutes: 8,
      bufferMinutes: 10,
    });
    expect(verdict.available).toBe(true);
  });

  it("is shut for a 22:30 late-night order", () => {
    const verdict = checkCurfew({
      now: istAt(22, 30),
      timezone: IST,
      zone: academic,
      prepMinutes: 20,
      transitMinutes: 8,
      bufferMinutes: 10,
    });
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe("GATE_SHUT_NOW");
  });
});

describe("an inactive zone", () => {
  it("is refused regardless of the clock", () => {
    const verdict = checkCurfew({
      now: istAt(12, 0),
      timezone: IST,
      zone: zone({ isActive: false }),
      prepMinutes: 15,
      transitMinutes: 8,
      bufferMinutes: 10,
    });
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe("ZONE_INACTIVE");
  });
});

describe("formatTime12h", () => {
  it("formats 24-hour minutes to 12-hour AM/PM string", () => {
    expect(formatTime12h(630)).toBe("10:30 AM");
    expect(formatTime12h(60)).toBe("1:00 AM");
    expect(formatTime12h(1320)).toBe("10:00 PM");
    expect(formatTime12h(1380)).toBe("11:00 PM");
    expect(formatTime12h(0)).toBe("12:00 AM");
    expect(formatTime12h(720)).toBe("12:00 PM");
  });
});

describe("getEffectiveMinOrderPaise", () => {
  const csbRestaurant = {
    minOrderPaise: 4000, // ₹40
    lateNightMinOrderPaise: 30000, // ₹300
    lateNightStartMinutes: 0, // 12:00 AM
    lateNightEndMinutes: 60, // 1:00 AM
    closesMinutes: 60,
  };

  it("returns regular daytime minimum order before midnight", () => {
    // 11:30 AM (690 min)
    const resultDay = getEffectiveMinOrderPaise(csbRestaurant, 690);
    expect(resultDay.minOrderPaise).toBe(4000);
    expect(resultDay.isLateNight).toBe(false);

    // 11:45 PM (1425 min)
    const resultNight = getEffectiveMinOrderPaise(csbRestaurant, 1425);
    expect(resultNight.minOrderPaise).toBe(4000);
    expect(resultNight.isLateNight).toBe(false);
  });

  it("returns late-night minimum order after 12:00 AM", () => {
    // Exactly 12:00 AM (0 min)
    const resultMidnight = getEffectiveMinOrderPaise(csbRestaurant, 0);
    expect(resultMidnight.minOrderPaise).toBe(30000);
    expect(resultMidnight.isLateNight).toBe(true);

    // 12:30 AM (30 min)
    const resultHalfPast = getEffectiveMinOrderPaise(csbRestaurant, 30);
    expect(resultHalfPast.minOrderPaise).toBe(30000);
    expect(resultHalfPast.isLateNight).toBe(true);

    // 12:59 AM (59 min)
    const resultBeforeClose = getEffectiveMinOrderPaise(csbRestaurant, 59);
    expect(resultBeforeClose.minOrderPaise).toBe(30000);
    expect(resultBeforeClose.isLateNight).toBe(true);
  });

  it("returns standard min order when no late-night rule is configured", () => {
    const kolkataBiryani = {
      minOrderPaise: 5000,
    };
    const afternoon = getEffectiveMinOrderPaise(kolkataBiryani, 840);
    expect(afternoon.minOrderPaise).toBe(5000);
    expect(afternoon.isLateNight).toBe(false);

    const evening = getEffectiveMinOrderPaise(kolkataBiryani, 1260);
    expect(evening.minOrderPaise).toBe(5000);
    expect(evening.isLateNight).toBe(false);
  });
});

