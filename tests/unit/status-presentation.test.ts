import { describe, expect, it } from "vitest";

import { statusBlurb, statusLabel, stepIndexFor } from "@/components/shared/status";
import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";

/**
 * Status rendering must be total.
 *
 * `PRESENTATION` is exhaustive over `OrderStatus` at compile time, but Mongo is
 * the one boundary the type system does not reach: a row written by an older
 * deploy is cast to `OrderStatus` on the way in and can name a state that has
 * since been removed from the enum — the retired DISPUTED family, for one.
 *
 * An unguarded lookup turns such a row into a TypeError, which is a 500 on the
 * student's tracker and, because the admin radar filters by exclusion, on the
 * whole live ops screen. So the contract is: degrade to a dull badge, never
 * throw.
 */
describe("status presentation is total", () => {
  const retired = ["DISPUTED", "DISPUTE_UPHELD", "DISPUTE_REJECTED"] as const;

  it("every live status still has its own copy", () => {
    for (const status of Object.values(ORDER_STATUS)) {
      expect(statusLabel(status)).toBeTruthy();
      expect(statusBlurb(status)).toBeTruthy();
    }
  });

  it("a status the enum no longer knows renders instead of throwing", () => {
    for (const stale of [...retired, "SOME_FUTURE_STATUS"]) {
      const status = stale as OrderStatus;
      expect(() => statusLabel(status)).not.toThrow();
      expect(() => statusBlurb(status)).not.toThrow();
      expect(statusLabel(status)).toBe("Closed");
      expect(statusBlurb(status)).toBeTruthy();
    }
  });

  it("a retired status derails the stepper rather than indexing into it", () => {
    for (const stale of retired) {
      expect(stepIndexFor(stale as OrderStatus)).toBe(-1);
    }
  });
});
