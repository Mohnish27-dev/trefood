import { describe, expect, it } from "vitest";

import { ORDER_STATUSES, type OrderStatus } from "../src/constants.js";
import { addPaise, formatINR, isWholeRupees, rupees, subtractPaise } from "../src/money.js";
import {
  buildOrderFixture,
  codOrderAtGate,
  menuItems,
  nitPatnaCampus,
  ordersByStatus,
  restaurants,
  studentView,
} from "../src/fixtures/index.js";

/**
 * The Phase 1 exit gate has two testable halves: the fixtures reproduce the worked
 * examples exactly, and no fixture contains a fractional rupee. Both are asserted
 * here, because a fixture that drifts from docs/MONEY_AND_SETTLEMENT.md silently
 * teaches Phase 8 the wrong answer.
 */

describe("Worked Example A — 100% online", () => {
  const { pricing, payment } = ordersByStatus.DELIVERED;

  it("reproduces every line of the table", () => {
    expect(formatINR(pricing.subtotalPaise)).toBe("₹200");
    expect(formatINR(pricing.packagingFeePaise)).toBe("₹10");
    expect(formatINR(pricing.deliveryFeePaise)).toBe("₹15");
    expect(formatINR(pricing.commissionBasePaise)).toBe("₹225");
    expect(formatINR(pricing.platformCommissionPaise)).toBe("₹23");
    expect(formatINR(pricing.vendorReceivablePaise)).toBe("₹202");
    expect(formatINR(pricing.convenienceFeePaise)).toBe("₹6");
    expect(formatINR(pricing.grandTotalPaise)).toBe("₹231");
    expect(formatINR(pricing.refundableAmountPaise)).toBe("₹225");
  });

  it("charges the whole bill online and no cash at the gate", () => {
    expect(payment.onlinePaidPaise).toBe(pricing.grandTotalPaise);
    expect(payment.cashDueOnDeliveryPaise).toBe(0);
  });
});

describe("Worked Example B — hybrid COD", () => {
  const { pricing, payment } = codOrderAtGate;

  it("reproduces every line of the table", () => {
    // The online token IS the commission: ₹23, plus ₹1 of convenience fee.
    expect(formatINR(pricing.platformCommissionPaise)).toBe("₹23");
    expect(formatINR(pricing.convenienceFeePaise)).toBe("₹1");
    expect(formatINR(payment.onlinePaidPaise)).toBe("₹24");
    expect(formatINR(payment.cashDueOnDeliveryPaise)).toBe("₹202");
    // Student's total outlay.
    expect(formatINR(pricing.grandTotalPaise)).toBe("₹226");
  });

  it("refunds only the token, because no cash was ever collected", () => {
    expect(formatINR(pricing.refundableAmountPaise)).toBe("₹23");
  });

  it("holds the invariant that makes COD self-settling", () => {
    // docs/MONEY_AND_SETTLEMENT.md §4. Break this and COD stops settling itself.
    expect(payment.onlinePaidPaise).toBe(
      addPaise(pricing.platformCommissionPaise, pricing.convenienceFeePaise),
    );
    expect(payment.cashDueOnDeliveryPaise).toBe(pricing.vendorReceivablePaise);
  });

  it("is cheaper than prepaid — the known A7 asymmetry, not a bug", () => {
    // ₹226 COD vs ₹231 prepaid, because the fee applies only to the ₹23 token.
    // campus.settings.codHandlingFee is the lever that corrects this. It ships at ₹0.
    expect(codOrderAtGate.pricing.grandTotalPaise).toBeLessThan(
      ordersByStatus.DELIVERED.pricing.grandTotalPaise,
    );
  });
});

describe("reconciliation invariants across every fixture", () => {
  const everyOrder = [...ORDER_STATUSES.map((s) => ordersByStatus[s]), codOrderAtGate];

  it("commissionBase === subtotal + packaging + delivery", () => {
    for (const { pricing } of everyOrder) {
      expect(pricing.commissionBasePaise).toBe(
        addPaise(pricing.subtotalPaise, pricing.packagingFeePaise, pricing.deliveryFeePaise),
      );
    }
  });

  it("commission + vendorReceivable === commissionBase, with no drift", () => {
    for (const { pricing } of everyOrder) {
      expect(addPaise(pricing.platformCommissionPaise, pricing.vendorReceivablePaise)).toBe(
        pricing.commissionBasePaise,
      );
    }
  });

  it("grandTotal === commissionBase − discount + convenienceFee", () => {
    for (const { pricing } of everyOrder) {
      expect(pricing.grandTotalPaise).toBe(
        addPaise(
          subtractPaise(pricing.commissionBasePaise, pricing.discountPaise),
          pricing.convenienceFeePaise,
        ),
      );
    }
  });

  it("the item lines add up to the subtotal", () => {
    for (const order of everyOrder) {
      const lines = order.items.map((item) => item.lineTotalPaise);
      expect(addPaise(...lines)).toBe(order.pricing.subtotalPaise);
    }
  });

  it("every money value is a non-negative integer", () => {
    for (const { pricing } of everyOrder) {
      for (const [field, value] of Object.entries(pricing)) {
        if (!field.endsWith("Paise")) continue;
        expect(Number.isInteger(value)).toBe(true);
        expect(value as number).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("no fixture contains a fractional rupee", () => {
  /**
   * docs/MONEY_AND_SETTLEMENT.md §1 rule 2: all student-facing totals are whole
   * rupees. This is not aesthetic — it is what makes cash work at a dark hostel gate,
   * where nobody is counting out 50 paise.
   */
  it("holds for every amount a student sees", () => {
    for (const order of [...ORDER_STATUSES.map((s) => ordersByStatus[s]), codOrderAtGate]) {
      const studentFacing = {
        grandTotal: order.pricing.grandTotalPaise,
        subtotal: order.pricing.subtotalPaise,
        deliveryFee: order.pricing.deliveryFeePaise,
        packagingFee: order.pricing.packagingFeePaise,
        convenienceFee: order.pricing.convenienceFeePaise,
        refundable: order.pricing.refundableAmountPaise,
        onlinePaid: order.payment.onlinePaidPaise,
        cashDue: order.payment.cashDueOnDeliveryPaise,
      };
      for (const [label, amount] of Object.entries(studentFacing)) {
        expect(isWholeRupees(amount), `${order.orderNumber} ${label}`).toBe(true);
      }
    }
  });

  it("holds for every menu price and campus fee", () => {
    for (const item of menuItems) {
      expect(isWholeRupees(item.pricePaise), item.name).toBe(true);
      for (const group of item.addOnGroups) {
        for (const option of group.options) {
          expect(isWholeRupees(option.pricePaise), option.name).toBe(true);
        }
      }
    }
    for (const restaurant of restaurants) {
      expect(isWholeRupees(restaurant.packagingFeePaise)).toBe(true);
      expect(isWholeRupees(restaurant.minOrderPaise)).toBe(true);
    }
    expect(isWholeRupees(nitPatnaCampus.settings.deliveryFeePaise)).toBe(true);
  });
});

describe("one fixture per FSM state", () => {
  it("covers every status, so every screen has something to render", () => {
    for (const status of ORDER_STATUSES) {
      expect(ordersByStatus[status]?.status).toBe(status);
    }
    expect(Object.keys(ordersByStatus)).toHaveLength(ORDER_STATUSES.length);
  });

  it("gives each order a distinct, gate-quotable order number", () => {
    const numbers = ORDER_STATUSES.map((s) => ordersByStatus[s]?.orderNumber);
    expect(new Set(numbers).size).toBe(ORDER_STATUSES.length);
    for (const number of numbers) {
      expect(number).toMatch(/^TRF-NITP-\d{4}$/);
    }
  });
});

describe("the gate code is withheld until AT_GATE", () => {
  /**
   * The anti-fraud property of D4. A student cannot pre-confirm from their room
   * because the code is not in their payload — not masked, ABSENT.
   */
  it("is present on the order from READY onward, for the vendor to write on the packet", () => {
    expect(ordersByStatus.READY.gateCode).toBe("4821");
    expect(ordersByStatus.OUT_FOR_DELIVERY.gateCode).toBe("4821");
    expect(ordersByStatus.AT_GATE.gateCode).toBe("4821");
  });

  it("does not exist before the food is packed", () => {
    expect(ordersByStatus.PLACED.gateCode).toBeUndefined();
    expect(ordersByStatus.PREPARING.gateCode).toBeUndefined();
  });

  it("is stripped from the student's view at every status except AT_GATE", () => {
    for (const status of ORDER_STATUSES) {
      const order = ordersByStatus[status];
      const view = studentView(order);
      if (status === "AT_GATE") {
        expect(view.gateCode).toBe("4821");
      } else {
        expect("gateCode" in view && view.gateCode !== undefined).toBe(false);
      }
    }
  });

  it("is four digits only — no letters, so no 0/O confusion in marker at 1 AM", () => {
    expect(ordersByStatus.AT_GATE.gateCode).toMatch(/^\d{4}$/);
  });
});

describe("campus fixture", () => {
  it("has the four curfew shapes the product must handle", () => {
    const curfews = nitPatnaCampus.zones.map((z) => z.curfewMinutes);
    expect(curfews).toContain(undefined); // 24×7 main gate — the fallback
    expect(curfews).toContain(21 * 60 + 30); // girls' hostel
    expect(curfews).toContain(22 * 60); // boys' hostel
    expect(curfews).toContain(19 * 60); // academic block
  });

  it("names a fallback zone that is genuinely 24×7", () => {
    const fallback = nitPatnaCampus.zones.find(
      (z) => z.zoneId === nitPatnaCampus.settings.fallbackZoneId,
    );
    // A fallback with a curfew would be useless: F11 reroutes to it *because* a gate shut.
    expect(fallback?.curfewMinutes).toBeUndefined();
  });

  it("has five zones", () => {
    expect(nitPatnaCampus.zones).toHaveLength(5);
  });
});

describe("restaurant fixtures", () => {
  it("includes a closed one, so the list has a greyed row to render", () => {
    expect(restaurants.some((r) => !r.isOpen)).toBe(true);
  });

  it("includes one that does not serve every zone, so the filter has work to do", () => {
    const zoneCounts = restaurants.map((r) => r.servedZoneIds.length);
    expect(new Set(zoneCounts).size).toBeGreaterThan(1);
  });

  it("includes 86-ed items, which must render struck through and never hidden", () => {
    expect(menuItems.some((item) => !item.isAvailable)).toBe(true);
  });

  it("includes add-on groups with both a required and an optional rule", () => {
    const groups = menuItems.flatMap((item) => item.addOnGroups);
    expect(groups.some((g) => g.minSelect === 1 && g.maxSelect === 1)).toBe(true);
    expect(groups.some((g) => g.minSelect === 0 && g.maxSelect > 1)).toBe(true);
  });
});

describe("buildOrderFixture()", () => {
  it("produces a COD order whose cash due equals the vendor receivable", () => {
    const order = buildOrderFixture("AT_GATE", "HYBRID_COD");
    expect(order.payment.cashDueOnDeliveryPaise).toBe(order.pricing.vendorReceivablePaise);
    expect(formatINR(order.payment.cashDueOnDeliveryPaise)).toBe("₹202");
  });

  it("leaves an unpaid order with nothing collected", () => {
    const order = buildOrderFixture("PAYMENT_PENDING");
    expect(order.payment.onlinePaidPaise).toBe(rupees(0));
    expect(order.payment.status).toBe("PENDING");
  });
});
