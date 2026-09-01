import { describe, expect, it } from "vitest";

import {
  MoneyError,
  addPaise,
  ceilPercentToRupee,
  ceilToRupee,
  formatINR,
  isWholeRupees,
  multiplyPaise,
  negatePaise,
  paise,
  paiseToRupees,
  percentToBasisPoints,
  rupees,
  subtractPaise,
} from "../src/money.js";

describe("paise()", () => {
  it("accepts integers", () => {
    expect(paise(22500)).toBe(22500);
    expect(paise(0)).toBe(0);
    expect(paise(-531)).toBe(-531);
  });

  it("rejects a fractional paise, because that means a float entered the chain", () => {
    expect(() => paise(22.5)).toThrow(MoneyError);
    expect(() => paise(0.1 + 0.2)).toThrow(MoneyError);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => paise(Number.NaN)).toThrow(MoneyError);
    expect(() => paise(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
});

describe("rupees()", () => {
  it("converts whole rupees to paise", () => {
    expect(rupees(225)).toBe(22500);
    expect(rupees(0)).toBe(0);
  });

  it("refuses fractional rupees and points at the alternative", () => {
    expect(() => rupees(22.5)).toThrow(/use paise\(2250\)/);
  });
});

describe("arithmetic", () => {
  it("adds, subtracts, multiplies and negates", () => {
    expect(addPaise(rupees(200), rupees(10), rupees(15))).toBe(22500);
    expect(subtractPaise(rupees(225), rupees(23))).toBe(20200);
    expect(multiplyPaise(paise(6000), 3)).toBe(18000);
    expect(negatePaise(paise(531))).toBe(-531);
  });

  it("refuses a fractional quantity", () => {
    expect(() => multiplyPaise(paise(6000), 1.5)).toThrow(MoneyError);
  });

  it("refuses a negative quantity", () => {
    expect(() => multiplyPaise(paise(6000), -1)).toThrow(MoneyError);
  });
});

describe("ceilToRupee()", () => {
  it("rounds up to the next whole rupee", () => {
    expect(ceilToRupee(paise(2250))).toBe(2300); // ₹22.50 -> ₹23
    expect(ceilToRupee(paise(2201))).toBe(2300); // ₹22.01 -> ₹23
    expect(ceilToRupee(paise(2299))).toBe(2300);
  });

  it("leaves a whole rupee alone", () => {
    expect(ceilToRupee(paise(2300))).toBe(2300);
    expect(ceilToRupee(paise(0))).toBe(0);
  });
});

describe("percentToBasisPoints()", () => {
  it("converts the two rates TREFOOD actually uses", () => {
    expect(percentToBasisPoints(10)).toBe(1000);
    expect(percentToBasisPoints(2.36)).toBe(236);
  });

  it("handles 0", () => {
    expect(percentToBasisPoints(0)).toBe(0);
  });

  it("rejects precision finer than basis points", () => {
    expect(() => percentToBasisPoints(2.365)).toThrow(MoneyError);
  });

  it("rejects a negative rate", () => {
    expect(() => percentToBasisPoints(-1)).toThrow(MoneyError);
  });
});

describe("ceilPercentToRupee()", () => {
  /**
   * These three assertions are the worked examples from
   * docs/MONEY_AND_SETTLEMENT.md §3 and §4, to the exact rupee. If any of them moves,
   * the money model has changed and the docs are now wrong.
   */
  it("commission: 10% of ₹225 is ₹23 (Worked Example A)", () => {
    expect(ceilPercentToRupee(rupees(225), 10)).toBe(2300);
  });

  it("convenience fee: 2.36% of ₹225 is ₹6 (Worked Example A)", () => {
    expect(ceilPercentToRupee(rupees(225), 2.36)).toBe(600);
  });

  it("convenience fee on a COD token: 2.36% of ₹23 is ₹1 (Worked Example B)", () => {
    expect(ceilPercentToRupee(rupees(23), 2.36)).toBe(100);
  });

  it("stays exact where the naive float path would overcharge by a whole rupee", () => {
    // This is not hypothetical. At 5.9% on a ₹7,000 base the exact answer is ₹413,
    // but 700000 × 5.9 evaluates to 4130000.0000000005 in binary floating point, so
    // a float pipeline ceilings to ₹414 and bills the student a rupee that does not
    // exist. Basis points keep every step integral.
    expect(ceilPercentToRupee(rupees(7000), 5.9)).toBe(rupees(413));

    const naive = Math.ceil((700000 * 5.9) / 100 / 100) * 100;
    expect(naive).toBe(rupees(414)); // documents WHY the basis-point path exists
  });

  it("a 0% rate costs nothing", () => {
    expect(ceilPercentToRupee(rupees(225), 0)).toBe(0);
  });

  it("never charges a fraction of a rupee", () => {
    for (let base = 100; base <= 500_00; base += 137) {
      const fee = ceilPercentToRupee(paise(base), 2.36);
      expect(isWholeRupees(fee)).toBe(true);
    }
  });
});

describe("the invariant that makes settlement drift-free", () => {
  /**
   * docs/MONEY_AND_SETTLEMENT.md §7 invariant 2. Commission rounds up and the vendor
   * takes the remainder, so the two always reconstitute the base exactly — for any
   * cart, at any rate. Phase 8 asserts this again against the real pricing engine;
   * asserting it here proves the primitives it will be built from are sound.
   */
  it("commission + vendorReceivable === commissionBase, for every base", () => {
    for (let base = 0; base <= 5_000_00; base += 997) {
      const commissionBase = paise(base);
      const commission = ceilPercentToRupee(commissionBase, 10);
      const vendorReceivable = subtractPaise(commissionBase, commission);
      expect(addPaise(commission, vendorReceivable)).toBe(commissionBase);
    }
  });

  it("holds at other commission rates too", () => {
    for (const rate of [0, 5, 7.5, 10, 12.25, 15]) {
      for (let base = 100; base <= 100_000; base += 3_331) {
        const commissionBase = paise(base);
        const commission = ceilPercentToRupee(commissionBase, rate);
        const vendorReceivable = subtractPaise(commissionBase, commission);
        expect(addPaise(commission, vendorReceivable)).toBe(commissionBase);
      }
    }
  });
});

describe("formatINR()", () => {
  it("drops the decimals on whole rupees", () => {
    expect(formatINR(rupees(231))).toBe("₹231");
    expect(formatINR(rupees(0))).toBe("₹0");
  });

  it("shows paise when they exist — the refund case", () => {
    // The worked micro-example: student paid ₹3.18, refund is ₹3.00.
    expect(formatINR(paise(318))).toBe("₹3.18");
    expect(formatINR(paise(300))).toBe("₹3");
  });

  it("pads a single-digit paise remainder", () => {
    expect(formatINR(paise(305))).toBe("₹3.05");
  });

  it("can be forced to show paise", () => {
    expect(formatINR(rupees(231), { showPaise: true })).toBe("₹231.00");
  });

  it("groups the Indian way, not the Western way", () => {
    expect(formatINR(rupees(1_234_567))).toBe("₹12,34,567");
    expect(formatINR(rupees(1_00_000))).toBe("₹1,00,000");
    expect(formatINR(rupees(1_000))).toBe("₹1,000");
    expect(formatINR(rupees(100))).toBe("₹100");
  });

  it("renders a negative ledger adjustment with a real minus sign", () => {
    // Gateway-fee recovery debits (D3) are the reason negatives are formatted at all.
    expect(formatINR(paise(-531))).toBe("−₹5.31");
  });
});

describe("paiseToRupees()", () => {
  it("converts for display", () => {
    expect(paiseToRupees(rupees(231))).toBe(231);
    expect(paiseToRupees(paise(318))).toBe(3.18);
  });
});
