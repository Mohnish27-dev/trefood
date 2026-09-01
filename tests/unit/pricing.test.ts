import { describe, expect, it } from "vitest";

import { computePricing, PricingError, type PricingInput } from "@/server/services/pricing";
import { PAYMENT_METHOD } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";

const R = rupeesToPaise;

/** Worked Example A and B share this order: 200 food + 10 packaging + 15 delivery. */
function baseInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    lines: [{ quantity: 1, unitPricePaise: R(200), addOnPricesPaise: [] }],
    packagingFeePaise: R(10),
    deliveryFeePaise: R(15),
    discountPaise: 0,
    commissionBps: 1_000, // 10%
    gatewayFeeBps: 236, // 2.36%
    codHandlingFeePaise: 0,
    method: PAYMENT_METHOD.ONLINE_100,
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   The two worked examples, to the exact rupee.
   MONEY_AND_SETTLEMENT.md sections 3 and 4.
   ══════════════════════════════════════════════════════════════════════ */

describe("Worked Example A — 100% online", () => {
  const { pricing, onlinePaidPaise, cashDueOnDeliveryPaise } = computePricing(baseInput());

  it("food subtotal is 200", () => expect(pricing.subtotalPaise).toBe(R(200)));
  it("commission base is 225", () => expect(pricing.commissionBasePaise).toBe(R(225)));

  it("platform commission is 23 — CEIL(22.50), not 22", () => {
    expect(pricing.platformCommissionPaise).toBe(R(23));
  });

  it("vendor receivable is 202", () => expect(pricing.vendorReceivablePaise).toBe(R(202)));

  it("convenience fee is 6 — CEIL(2.36% of 225 = 5.31)", () => {
    expect(pricing.convenienceFeePaise).toBe(R(6));
  });

  it("student pays 231 online", () => {
    expect(pricing.grandTotalPaise).toBe(R(231));
    expect(onlinePaidPaise).toBe(R(231));
  });

  it("nothing is due in cash", () => expect(cashDueOnDeliveryPaise).toBe(0));

  it("refundable if the vendor fails is 225, not 231", () => {
    expect(pricing.refundableAmountPaise).toBe(R(225));
  });
});

describe("Worked Example B — hybrid COD", () => {
  const input = baseInput({ method: PAYMENT_METHOD.HYBRID_COD });
  const { pricing, onlinePaidPaise, cashDueOnDeliveryPaise } = computePricing(input);

  it("the online token IS the commission — 23", () => {
    expect(pricing.platformCommissionPaise).toBe(R(23));
  });

  it("convenience fee is 1 — CEIL(2.36% of 23 = 0.54)", () => {
    expect(pricing.convenienceFeePaise).toBe(R(1));
  });

  it("student pays 24 online at checkout", () => expect(onlinePaidPaise).toBe(R(24)));

  it("cash handed over at the gate is 202, exactly the receivable", () => {
    expect(cashDueOnDeliveryPaise).toBe(R(202));
    expect(cashDueOnDeliveryPaise).toBe(pricing.vendorReceivablePaise);
  });

  it("total student outlay is 226", () => {
    expect(onlinePaidPaise + cashDueOnDeliveryPaise).toBe(R(226));
  });

  it("refundable is 23 — the token minus its convenience fee, per MONEY section 5", () => {
    // NOT grandTotal - convenienceFee (225). There is no cash to refund,
    // because no cash was ever collected.
    expect(pricing.refundableAmountPaise).toBe(R(23));
  });

  it("COD is currently cheaper than prepaid — the known A7 asymmetry", () => {
    const prepaid = computePricing(baseInput()).pricing.grandTotalPaise;
    expect(onlinePaidPaise + cashDueOnDeliveryPaise).toBeLessThan(prepaid);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   The COD invariant that makes settlement unnecessary.
   PRD Part 4.12 — "any change that breaks it is rejected".
   ══════════════════════════════════════════════════════════════════════ */

describe("the COD self-settling invariant", () => {
  it("holds across a wide range of order values", () => {
    for (let rupees = 30; rupees <= 2_000; rupees += 7) {
      const { pricing, onlinePaidPaise, cashDueOnDeliveryPaise } = computePricing(
        baseInput({
          method: PAYMENT_METHOD.HYBRID_COD,
          lines: [{ quantity: 1, unitPricePaise: R(rupees), addOnPricesPaise: [] }],
        }),
      );

      // codOnlineToken === platformCommission
      expect(onlinePaidPaise - pricing.convenienceFeePaise).toBe(pricing.platformCommissionPaise);
      // cashDueOnDelivery === vendorReceivable
      expect(cashDueOnDeliveryPaise).toBe(pricing.vendorReceivablePaise);
      // Therefore the platform owes the vendor nothing and vice versa.
      expect(pricing.platformCommissionPaise + cashDueOnDeliveryPaise).toBe(
        pricing.commissionBasePaise,
      );
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════
   All seven invariants, fuzzed.
   ══════════════════════════════════════════════════════════════════════ */

describe("the seven reconciliation invariants under fuzzing", () => {
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

      const method = rand() > 0.5 ? PAYMENT_METHOD.ONLINE_100 : PAYMENT_METHOD.HYBRID_COD;

      const input: PricingInput = {
        lines,
        packagingFeePaise: randInt(0, 3_000),
        deliveryFeePaise: randInt(0, 5_000),
        discountPaise: rand() > 0.7 ? randInt(0, 4_000) : 0,
        commissionBps: randInt(0, 3_000),
        gatewayFeeBps: randInt(0, 500),
        codHandlingFeePaise: 0,
        method,
      };

      // computePricing asserts all seven internally and throws on violation.
      const { pricing, onlinePaidPaise, cashDueOnDeliveryPaise } = computePricing(input);

      // Restate the two that matter most, so a regression names itself.
      expect(pricing.platformCommissionPaise + pricing.vendorReceivablePaise).toBe(
        pricing.commissionBasePaise,
      );

      if (method === PAYMENT_METHOD.HYBRID_COD) {
        expect(cashDueOnDeliveryPaise).toBe(pricing.vendorReceivablePaise);
      } else {
        expect(onlinePaidPaise).toBe(pricing.grandTotalPaise);
      }
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

describe("coupons (A1 — platform-funded)", () => {
  it("do not reduce what the vendor is paid", () => {
    const without = computePricing(baseInput()).pricing;
    const withCoupon = computePricing(baseInput({ discountPaise: R(20) })).pricing;

    expect(withCoupon.vendorReceivablePaise).toBe(without.vendorReceivablePaise);
    expect(withCoupon.commissionBasePaise).toBe(without.commissionBasePaise);
    // The student pays 20 less; TREFOOD absorbs it out of its own commission.
    expect(withCoupon.grandTotalPaise).toBeLessThan(without.grandTotalPaise);
  });

  it("cannot drive a total below zero", () => {
    const { pricing } = computePricing(baseInput({ discountPaise: R(10_000) }));
    expect(pricing.grandTotalPaise).toBeGreaterThanOrEqual(0);
    expect(pricing.discountPaise).toBe(pricing.commissionBasePaise);
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
