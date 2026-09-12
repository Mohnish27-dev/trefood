import { describe, expect, it } from "vitest";

import { computePricing, PricingError, type PricingInput } from "@/server/services/pricing";
import { rupeesToPaise } from "@/lib/money";

const R = rupeesToPaise;

/** The worked example: 200 food + 10 packaging + 15 delivery. */
function baseInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    lines: [{ quantity: 1, unitPricePaise: R(200), addOnPricesPaise: [] }],
    packagingFeePaise: R(10),
    deliveryFeePaise: R(15),
    discountPaise: 0,
    commissionBps: 1_000, // 10%
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   The worked example, to the exact rupee.
   MONEY_AND_SETTLEMENT.md sections 3 and 4.
   ══════════════════════════════════════════════════════════════════════ */

describe("Worked Example — cash on delivery", () => {
  const { pricing, cashDuePaise } = computePricing(baseInput());

  it("food subtotal is 200", () => expect(pricing.subtotalPaise).toBe(R(200)));
  it("commission base is 225", () => expect(pricing.commissionBasePaise).toBe(R(225)));

  it("platform commission is 23 — CEIL(22.50), not 22", () => {
    expect(pricing.platformCommissionPaise).toBe(R(23));
  });

  it("the vendor's share is 202", () => expect(pricing.vendorReceivablePaise).toBe(R(202)));

  it("the student pays 225 in cash — nothing is added to the bill", () => {
    expect(pricing.grandTotalPaise).toBe(R(225));
    expect(cashDuePaise).toBe(R(225));
  });

  it("the vendor collects the whole bill and owes us the commission on it", () => {
    expect(cashDuePaise - pricing.platformCommissionPaise).toBe(pricing.vendorReceivablePaise);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   The invariant the reversed settlement rests on.
   ══════════════════════════════════════════════════════════════════════ */

describe("the collection invariant", () => {
  it("holds across a wide range of order values", () => {
    for (let rupees = 30; rupees <= 2_000; rupees += 7) {
      const { pricing, cashDuePaise } = computePricing(
        baseInput({ lines: [{ quantity: 1, unitPricePaise: R(rupees), addOnPricesPaise: [] }] }),
      );

      // The cash collected is the whole bill.
      expect(cashDuePaise).toBe(pricing.grandTotalPaise);
      // What the vendor keeps, plus what they owe us, is exactly what they took.
      expect(pricing.platformCommissionPaise + pricing.vendorReceivablePaise).toBe(
        pricing.commissionBasePaise,
      );
      // And they can always cover what they owe out of what they collected.
      expect(cashDuePaise).toBeGreaterThanOrEqual(pricing.platformCommissionPaise);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════
   All the invariants, fuzzed.
   ══════════════════════════════════════════════════════════════════════ */

describe("the reconciliation invariants under fuzzing", () => {
  // Deterministic PRNG, so a failure is reproducible rather than a ghost.
  let seed = 0x5eed;
  const rand = (): number => {
    seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const randInt = (min: number, max: number): number =>
    min + Math.trunc(rand() * (max - min + 1));

  it("never drifts across 10,000 random carts", () => {
    for (let n = 0; n < 10_000; n += 1) {
      const lineCount = randInt(1, 6);
      const lines = Array.from({ length: lineCount }, () => ({
        quantity: randInt(1, 5),
        unitPricePaise: randInt(1, 60_000),
        addOnPricesPaise: Array.from({ length: randInt(0, 3) }, () => randInt(0, 5_000)),
      }));

      const input: PricingInput = {
        lines,
        packagingFeePaise: randInt(0, 3_000),
        deliveryFeePaise: randInt(0, 5_000),
        discountPaise: rand() > 0.7 ? randInt(0, 4_000) : 0,
        commissionBps: randInt(0, 3_000),
      };

      // computePricing asserts every invariant internally and throws on violation.
      const { pricing, cashDuePaise } = computePricing(input);

      // Restate the two that matter most, so a regression names itself.
      expect(pricing.platformCommissionPaise + pricing.vendorReceivablePaise).toBe(
        pricing.commissionBasePaise,
      );
      expect(cashDuePaise).toBe(pricing.grandTotalPaise);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Rounding, add-ons, discounts and rejections
   ══════════════════════════════════════════════════════════════════════ */

describe("rounding", () => {
  it("commission rounds UP, never to nearest", () => {
    // base 100.01 -> 10% is 10.001 -> must be 11, not 10
    const { pricing } = computePricing(
      baseInput({
        lines: [{ quantity: 1, unitPricePaise: 10_001, addOnPricesPaise: [] }],
        packagingFeePaise: 0,
        deliveryFeePaise: 0,
      }),
    );
    expect(pricing.commissionBasePaise).toBe(10_001);
    expect(pricing.platformCommissionPaise).toBe(R(11));
    expect(pricing.vendorReceivablePaise).toBe(10_001 - R(11));
  });

  it("an exact rupee boundary does not over-ceil", () => {
    // base 200 -> 10% is exactly 20. Must stay 20, not tip to 21 on float dust.
    const { pricing } = computePricing(
      baseInput({
        lines: [{ quantity: 1, unitPricePaise: R(200), addOnPricesPaise: [] }],
        packagingFeePaise: 0,
        deliveryFeePaise: 0,
      }),
    );
    expect(pricing.platformCommissionPaise).toBe(R(20));
  });

  it("every output is a non-negative safe integer", () => {
    const { pricing } = computePricing(baseInput());
    for (const value of Object.values(pricing)) {
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("add-ons", () => {
  it("are charged per unit, so 2 rolls with cheese pay for cheese twice", () => {
    const { pricing, lineTotalsPaise } = computePricing(
      baseInput({
        lines: [{ quantity: 2, unitPricePaise: R(50), addOnPricesPaise: [R(10), R(5)] }],
        packagingFeePaise: 0,
        deliveryFeePaise: 0,
      }),
    );
    expect(lineTotalsPaise[0]).toBe(R(130)); // (50 + 15) x 2
    expect(pricing.subtotalPaise).toBe(R(130));
  });
});

describe("per-item packing fees", () => {
  it("are charged per unit and billed as packaging, not as food", () => {
    const { pricing, lineTotalsPaise, linePackingFeesPaise, itemPackingFeePaise } = computePricing(
      baseInput({
        lines: [
          { quantity: 2, unitPricePaise: R(120), addOnPricesPaise: [], packingFeePaise: R(10) },
          { quantity: 3, unitPricePaise: R(15), addOnPricesPaise: [] }, // switched off
        ],
        packagingFeePaise: 0,
        deliveryFeePaise: 0,
      }),
    );

    expect(lineTotalsPaise).toEqual([R(240), R(45)]); // packing never inflates the line
    expect(linePackingFeesPaise).toEqual([R(20), 0]); // 10 x 2 containers
    expect(itemPackingFeePaise).toBe(R(20));
    expect(pricing.subtotalPaise).toBe(R(285));
    expect(pricing.packagingFeePaise).toBe(R(20));
    expect(pricing.grandTotalPaise).toBe(R(305));
  });

  it("add to the restaurant-wide fee and sit inside the commission base (D6)", () => {
    const { pricing } = computePricing(
      baseInput({
        lines: [{ quantity: 1, unitPricePaise: R(200), addOnPricesPaise: [], packingFeePaise: R(5) }],
      }),
    );

    expect(pricing.packagingFeePaise).toBe(R(15)); // 10 restaurant + 5 item
    expect(pricing.commissionBasePaise).toBe(R(230)); // 200 + 15 + 15
    expect(pricing.platformCommissionPaise).toBe(R(23)); // CEIL(23.00)
  });

  it("do not count towards the minimum-order subtotal", () => {
    const { pricing } = computePricing(
      baseInput({
        lines: [{ quantity: 4, unitPricePaise: R(20), addOnPricesPaise: [], packingFeePaise: R(10) }],
      }),
    );
    expect(pricing.subtotalPaise).toBe(R(80));
  });

  it("reject a negative packing fee", () => {
    expect(() =>
      computePricing(
        baseInput({
          lines: [
            { quantity: 1, unitPricePaise: R(50), addOnPricesPaise: [], packingFeePaise: -100 },
          ],
        }),
      ),
    ).toThrow(/packingFeePaise must be >= 0/);
  });
});

describe("coupons — vendor-absorbed", () => {
  it("do not reduce the commission the vendor owes", () => {
    const without = computePricing(baseInput()).pricing;
    const withCoupon = computePricing(baseInput({ discountPaise: R(20) })).pricing;

    expect(withCoupon.commissionBasePaise).toBe(without.commissionBasePaise);
    expect(withCoupon.platformCommissionPaise).toBe(without.platformCommissionPaise);
    // The student hands over 20 less, and that 20 comes out of the vendor's share.
    expect(withCoupon.grandTotalPaise).toBe(without.grandTotalPaise - R(20));
  });

  it("cannot leave the vendor owing more than they collected", () => {
    const { pricing, cashDuePaise } = computePricing(baseInput({ discountPaise: R(10_000) }));
    expect(pricing.grandTotalPaise).toBeGreaterThanOrEqual(pricing.platformCommissionPaise);
    // The discount is capped at the vendor's own share, never past it.
    expect(pricing.discountPaise).toBe(pricing.vendorReceivablePaise);
    expect(cashDuePaise).toBe(pricing.platformCommissionPaise);
  });
});

describe("input rejection", () => {
  it("rejects an empty cart", () => {
    expect(() => computePricing(baseInput({ lines: [] }))).toThrow(PricingError);
  });

  it("rejects zero quantity", () => {
    expect(() =>
      computePricing(
        baseInput({ lines: [{ quantity: 0, unitPricePaise: R(50), addOnPricesPaise: [] }] }),
      ),
    ).toThrow(/quantity/);
  });

  it("rejects a fractional price — a float in a money path", () => {
    expect(() =>
      computePricing(
        baseInput({ lines: [{ quantity: 1, unitPricePaise: 50.5, addOnPricesPaise: [] }] }),
      ),
    ).toThrow(/integer paise/);
  });

  it("rejects a rate above 100%", () => {
    expect(() => computePricing(baseInput({ commissionBps: 10_001 }))).toThrow(/basis points/);
  });
});
