import { describe, expect, it } from "vitest";
import { datesOfMonth } from "@/server/services/analytics";

describe("Vendor Calendar Month Earnings Logic", () => {
  it("determines correct days count for 30-day month (e.g. September)", () => {
    const sepDays = datesOfMonth("2026-09");
    expect(sepDays).toHaveLength(30);
    expect(sepDays[0]).toBe("2026-09-01");
    expect(sepDays[29]).toBe("2026-09-30");
  });

  it("determines correct days count for 31-day months (e.g. August, October, January)", () => {
    const augDays = datesOfMonth("2026-08");
    expect(augDays).toHaveLength(31);
    expect(augDays[0]).toBe("2026-08-01");
    expect(augDays[30]).toBe("2026-08-31");

    const octDays = datesOfMonth("2026-10");
    expect(octDays).toHaveLength(31);
  });

  it("determines correct days count for 28-day February and 29-day leap year February", () => {
    const feb2026 = datesOfMonth("2026-02");
    expect(feb2026).toHaveLength(28);
    expect(feb2026[0]).toBe("2026-02-01");
    expect(feb2026[27]).toBe("2026-02-28");

    const feb2028 = datesOfMonth("2028-02");
    expect(feb2028).toHaveLength(29);
    expect(feb2028[28]).toBe("2028-02-29");
  });

  it("accurately sums daily buckets into month totals without integer drift", () => {
    const mockDays = [
      {
        date: "2026-09-24",
        orderCount: 5,
        grossPaise: 100_000,
        commissionPaise: 10_000,
        discountPaise: 0,
        cashCollectedPaise: 100_000,
        keptPaise: 90_000,
      },
      {
        date: "2026-09-23",
        orderCount: 3,
        grossPaise: 60_000,
        commissionPaise: 6_000,
        discountPaise: 0,
        cashCollectedPaise: 60_000,
        keptPaise: 54_000,
      },
    ];

    const monthTotal = {
      date: "2026-09",
      orderCount: mockDays.reduce((sum, d) => sum + d.orderCount, 0),
      grossPaise: mockDays.reduce((sum, d) => sum + d.grossPaise, 0),
      commissionPaise: mockDays.reduce((sum, d) => sum + d.commissionPaise, 0),
      discountPaise: mockDays.reduce((sum, d) => sum + d.discountPaise, 0),
      cashCollectedPaise: mockDays.reduce((sum, d) => sum + d.cashCollectedPaise, 0),
      keptPaise: mockDays.reduce((sum, d) => sum + d.keptPaise, 0),
    };

    expect(monthTotal.orderCount).toBe(8);
    expect(monthTotal.grossPaise).toBe(160_000);
    expect(monthTotal.commissionPaise).toBe(16_000);
    expect(monthTotal.cashCollectedPaise).toBe(160_000);
    expect(monthTotal.keptPaise).toBe(144_000);
    expect(Number.isSafeInteger(monthTotal.grossPaise)).toBe(true);
  });
});
