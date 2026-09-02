import { describe, expect, it } from "vitest";

import {
  allowedStatusesFor,
  assertTransition,
  canTransition,
  isTerminal,
  nextStatuses,
  TRANSITIONS,
  TransitionError,
  type TransitionSubject,
} from "@/server/services/order-state";
import { ACTOR, ORDER_STATUS, type OrderStatus } from "@/lib/constants";

const S = ORDER_STATUS;
const A = ACTOR;

function subject(status: OrderStatus, overrides: Partial<TransitionSubject> = {}): TransitionSubject {
  return { status, gateCode: "4821", prepMinutes: 20, ...overrides };
}

/* ══════════════════════════════════════════════════════════════════════
   Every legal transition succeeds
   ══════════════════════════════════════════════════════════════════════ */

describe("every rule in the table is firable by its declared actors", () => {
  for (const rule of TRANSITIONS) {
    for (const actor of rule.actors) {
      it(`${rule.from} -> ${rule.to} by ${actor}`, () => {
        const plan = assertTransition(subject(rule.from), {
          to: rule.to,
          actor,
          reason: "test reason",
          prepMinutes: 20,
        });
        expect(plan.from).toBe(rule.from);
        expect(plan.to).toBe(rule.to);
        expect(plan.actor).toBe(actor);
      });
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════
   The two the spec calls out by name.
   PROJECT_STRUCTURE.md section 7.2.
   ══════════════════════════════════════════════════════════════════════ */

describe("the transitions the spec forbids explicitly", () => {
  it("a student cannot confirm before ACCEPTED", () => {
    expect(() =>
      assertTransition(subject(S.PLACED), { to: S.DELIVERED, actor: A.STUDENT }),
    ).toThrow(TransitionError);

    for (const from of [S.ACCEPTED, S.PREPARING, S.READY, S.OUT_FOR_DELIVERY, S.AT_GATE] as const) {
      expect(() =>
        assertTransition(subject(from), { to: S.DELIVERED, actor: A.STUDENT }),
      ).not.toThrow();
    }
  });

  it("a vendor cannot cancel after ACCEPTED", () => {
    // Vendor-initiated cancellation post-acceptance creates a refund path
    // vendors could abuse to dodge bad orders. Only admin may cancel.
    for (const from of [S.ACCEPTED, S.PREPARING, S.READY, S.OUT_FOR_DELIVERY] as const) {
      const result = canTransition(subject(from), {
        to: S.CANCELLED_BY_ADMIN,
        actor: A.VENDOR,
        reason: "changed my mind",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("WRONG_ACTOR");
    }

    // An admin may.
    expect(() =>
      assertTransition(subject(S.PREPARING), {
        to: S.CANCELLED_BY_ADMIN,
        actor: A.ADMIN,
        reason: "power cut at the canteen",
      }),
    ).not.toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Illegal transitions throw
   ══════════════════════════════════════════════════════════════════════ */

describe("illegal transitions", () => {
  it("rejects skipping the kitchen entirely", () => {
    expect(() => assertTransition(subject(S.PLACED), { to: S.DELIVERED, actor: A.VENDOR })).toThrow(
      /not a legal transition/,
    );
  });

  it("rejects going backwards", () => {
    expect(() => assertTransition(subject(S.READY), { to: S.PLACED, actor: A.VENDOR })).toThrow(
      /not a legal transition/,
    );
  });

  it("rejects a client promoting its own order to PLACED", () => {
    // Only the gateway webhook or the reconciliation cron may do this.
    // A student who could fire it would get free food.
    const result = canTransition(subject(S.PAYMENT_PENDING), { to: S.PLACED, actor: A.STUDENT });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WRONG_ACTOR");
  });

  it("rejects anything out of a terminal state", () => {
    for (const from of [S.DELIVERED_TO_SECURITY, S.NO_SHOW, S.SETTLED] as const) {
      if (!isTerminal(from)) continue;
      expect(() => assertTransition(subject(from), { to: S.DELIVERED, actor: A.ADMIN })).toThrow(
        /terminal/,
      );
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Guards
   ══════════════════════════════════════════════════════════════════════ */

describe("guards", () => {
  it("accepting requires prep minutes in 5..60", () => {
    for (const prep of [undefined, 0, 4, 61, 20.5]) {
      const result = canTransition(subject(S.PLACED), {
        to: S.ACCEPTED,
        actor: A.VENDOR,
        prepMinutes: prep,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("PREP_MINUTES_INVALID");
    }

    for (const prep of [5, 15, 20, 30, 60]) {
      expect(
        canTransition(subject(S.PLACED), { to: S.ACCEPTED, actor: A.VENDOR, prepMinutes: prep }).ok,
      ).toBe(true);
    }
  });

  it("a rider cannot be dispatched without a gate code on the packet", () => {
    const result = canTransition(subject(S.READY, { gateCode: null }), {
      to: S.OUT_FOR_DELIVERY,
      actor: A.VENDOR,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GATE_CODE_MISSING");
  });

  it("rejections, cancellations and dispute rulings demand a written reason", () => {
    const needsReason: ReadonlyArray<[OrderStatus, OrderStatus, typeof A.VENDOR | typeof A.ADMIN]> =
      [
        [S.PLACED, S.REJECTED_BY_VENDOR, A.VENDOR],
        [S.PREPARING, S.CANCELLED_BY_ADMIN, A.ADMIN],
        [S.DISPUTED, S.DISPUTE_UPHELD, A.ADMIN],
        [S.DISPUTED, S.DISPUTE_REJECTED, A.ADMIN],
      ];

    for (const [from, to, actor] of needsReason) {
      const blank = canTransition(subject(from), { to, actor, reason: "   " });
      expect(blank.ok).toBe(false);
      if (!blank.ok) expect(blank.code).toBe("REASON_REQUIRED");

      expect(canTransition(subject(from), { to, actor, reason: "out of paneer" }).ok).toBe(true);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Shape of the machine
   ══════════════════════════════════════════════════════════════════════ */

describe("machine shape", () => {
  it("AT_GATE has exactly the four documented outcomes", () => {
    expect(new Set(nextStatuses(S.AT_GATE))).toEqual(
      new Set([S.DELIVERED, S.DELIVERED_TO_SECURITY, S.NO_SHOW, S.CANCELLED_BY_ADMIN]),
    );
  });

  it("a vendor sees only its own affordances at AT_GATE", () => {
    // The vendor can close a COD order or report a no-show, but the normal
    // close belongs to the student.
    expect(new Set(allowedStatusesFor(S.AT_GATE, A.VENDOR))).toEqual(
      new Set([S.DELIVERED, S.DELIVERED_TO_SECURITY, S.NO_SHOW]),
    );
    expect(allowedStatusesFor(S.AT_GATE, A.STUDENT)).toEqual([S.DELIVERED]);
  });

  it("no rule names a rider — there is no rider actor, by design (D4)", () => {
    const actors = new Set(TRANSITIONS.flatMap((r) => r.actors));
    expect(actors.has("RIDER" as never)).toBe(false);
    expect([...actors].sort()).toEqual(["ADMIN", "STUDENT", "SYSTEM", "VENDOR", "WEBHOOK"]);
  });

  it("every terminal status is genuinely a dead end", () => {
    for (const status of [
      S.PAYMENT_FAILED,
      S.REJECTED_BY_VENDOR,
      S.EXPIRED_NO_ACK,
      S.CANCELLED_BY_ADMIN,
      S.NO_SHOW,
      S.DISPUTE_UPHELD,
      S.SETTLED,
    ] as const) {
      expect(isTerminal(status)).toBe(true);
    }
  });

  it("every status except the entry point is reachable", () => {
    const reachable = new Set(TRANSITIONS.map((r) => r.to));
    for (const status of Object.values(S)) {
      if (status === S.PAYMENT_PENDING) continue; // the entry point
      expect(reachable.has(status)).toBe(true);
    }
  });
});
