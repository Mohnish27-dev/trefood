import { describe, expect, it } from "vitest";

import { ceilPaiseOfBps, ceilRupeeOfBps, formatINR, rupeesToPaise } from "@/lib/money";

/**
 * `ceilPaiseOfBps` — the sub-rupee helper added for D3.
 *
 * Everything a student or a vendor sees is whole rupees (A4), which is what
 * `ceilRupeeOfBps` enforces. This one exists for the single place a sub-rupee
 * amount is genuinely real: the ledger entry recording the gateway fee
 * the provider keeps on a refund. Rounding that to a rupee would over- or
 * under-charge the vendor on every single refund.
 */

const R = rupeesToPaise;

describe("ceilPaiseOfBps", () => {
  it("reproduces the worked ledger entry from MONEY section 5 exactly", () => {
    // "Gateway fee not returned on refund of TRF-NITP-8921": -531 paise,
    // which is 2.36% of the 225-rupee refundable amount.
    expect(ceilPaiseOfBps(R(225), 236)).toBe(531);
  });

  it("stays in paise where the rupee helper would round away the fee", () => {
    // A 23-rupee COD token: the real fee is 54.28 paise. Ceiling to a rupee
    // would book a whole rupee against the vendor, nearly double the truth.
    expect(ceilPaiseOfBps(R(23), 236)).toBe(55);
    expect(ceilRupeeOfBps(R(23), 236)).toBe(100);
  });

  it("returns integers for every rate, never a float", () => {
    for (let rupees = 1; rupees <= 500; rupees += 1) {
      for (const bps of [0, 1, 100, 236, 1_000, 10_000]) {
        const result = ceilPaiseOfBps(R(rupees), bps);
        expect(Number.isSafeInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never charges less than the true fee, and never more than a paisa over", () => {
    for (let paise = 1; paise <= 50_000; paise += 37) {
      const exact = (paise * 236) / 10_000;
      const booked = ceilPaiseOfBps(paise, 236);
      expect(booked).toBeGreaterThanOrEqual(exact);
      expect(booked - exact).toBeLessThan(1);
    }
  });

  it("charges nothing at a zero rate", () => {
    expect(ceilPaiseOfBps(R(1_000), 0)).toBe(0);
  });

  it("refuses a fractional base rather than silently truncating it", () => {
    expect(() => ceilPaiseOfBps(22_500.5, 236)).toThrow(/integer paise/);
  });
});

describe("formatINR on ledger amounts", () => {
  it("shows paise for a signed recovery entry, because the fee is sub-rupee", () => {
    // The ledger is the one place `exact` matters: -531 paise is a real
    // number a vendor will query, not a rounding artefact.
    expect(formatINR(-531, { exact: true })).toBe("-₹5.31");
  });

  it("still renders whole rupees for a student-facing total", () => {
    expect(formatINR(R(231))).toBe("₹231");
  });
});
