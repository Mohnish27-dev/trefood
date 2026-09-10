/**
 * ★ THE FINITE STATE MACHINE ★
 *
 * SYSTEM_ARCHITECTURE_AND_FLOWS.md section 3.
 *
 * Nothing else in the codebase may write `order.status`. Every transition goes
 * through `assertTransition` / `transition`, which validates legality, checks
 * the actor's right to fire it, and produces the audit entry. PRD Part 4.7.
 *
 * Pure by design: this module has no DB import and no session import, so the
 * whole transition table is testable without a database. Persistence is the
 * caller's job (`server/services/orders.ts`), which writes the status and the
 * audit entry in one atomic update.
 */

import { ACTOR, ORDER_STATUS, type Actor, type OrderStatus } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* The transition table                                                */
/* ------------------------------------------------------------------ */

export interface TransitionRule {
  from: OrderStatus;
  to: OrderStatus;
  /** Who may fire it. A transition with several legal actors gets several rules. */
  actors: readonly Actor[];
  /** Human-readable reason this edge exists, surfaced in error messages. */
  why: string;
  /** True when a written reason is mandatory. */
  requiresReason?: boolean;
}

const S = ORDER_STATUS;
const A = ACTOR;

/** New orders wait for the student cancellation deadline before vendor acknowledgement. */
export const TRANSITIONS: readonly TransitionRule[] = [
  {
    from: S.PENDING_CONFIRMATION,
    to: S.PLACED,
    actors: [A.SYSTEM],
    why: "The 15-second cancellation window elapsed.",
  },
  {
    from: S.PENDING_CONFIRMATION,
    to: S.CANCELLED_BY_STUDENT,
    actors: [A.STUDENT],
    why: "Student cancelled before the restaurant received the order.",
    requiresReason: true,
  },
  /* ── Vendor acknowledgement ───────────────────────────────────── */
  {
    from: S.PLACED,
    to: S.ACCEPTED,
    actors: [A.VENDOR],
    why: "Vendor accepted and set a prep time of 5-60 minutes.",
  },
  {
    from: S.PLACED,
    to: S.REJECTED_BY_VENDOR,
    actors: [A.VENDOR],
    why: "Vendor rejected. Nothing was paid, so there is nothing to return (F5).",
    requiresReason: true,
  },
  {
    from: S.PLACED,
    to: S.EXPIRED_NO_ACK,
    actors: [A.SYSTEM],
    why: "Four minutes of silence. Nothing was paid (F4). Cron only.",
  },

  /* ── Kitchen & Gate handoff ───────────────────────────────────── */
  {
    from: S.ACCEPTED,
    to: S.PREPARING,
    actors: [A.SYSTEM, A.VENDOR],
    why: "Automatic on accept.",
  },
  {
    from: S.ACCEPTED,
    to: S.DELIVERED,
    actors: [A.STUDENT, A.VENDOR, A.SYSTEM],
    why: "Student confirmed order pickup after accept.",
  },
  {
    from: S.PREPARING,
    to: S.DELIVERED,
    actors: [A.STUDENT, A.VENDOR, A.SYSTEM],
    why: "Student confirmed order pickup.",
  },
  {
    from: S.ACCEPTED,
    to: S.OUT_FOR_DELIVERY,
    actors: [A.VENDOR],
    why: "Rider dispatched / on the way.",
  },
  {
    from: S.PREPARING,
    to: S.OUT_FOR_DELIVERY,
    actors: [A.VENDOR],
    why: "Rider dispatched / on the way.",
  },
  {
    from: S.PREPARING,
    to: S.READY,
    actors: [A.VENDOR],
    why: "Packed. The gate code is revealed to the vendor to write on the packet.",
  },
  {
    from: S.READY,
    to: S.DELIVERED,
    actors: [A.STUDENT, A.VENDOR, A.SYSTEM],
    why: "Student confirmed order pickup.",
  },
  {
    from: S.READY,
    to: S.OUT_FOR_DELIVERY,
    actors: [A.VENDOR],
    why: "Rider left. Requires a generated gate code.",
  },
  {
    from: S.OUT_FOR_DELIVERY,
    to: S.DELIVERED,
    actors: [A.STUDENT, A.VENDOR, A.SYSTEM],
    why: "Student confirmed order pickup.",
  },
  {
    from: S.OUT_FOR_DELIVERY,
    to: S.AT_GATE,
    actors: [A.VENDOR],
    why: "Rider at gate.",
  },
  {
    from: S.AT_GATE,
    to: S.DELIVERED,
    actors: [A.STUDENT, A.VENDOR, A.SYSTEM],
    why: "Student matched the packet code and tapped Confirm Received.",
  },
  // There is no "leave it with the guard" ending any more. That existed only
  // for prepaid orders, where the platform already held the money and the
  // packet was the only thing at risk. Nobody can hand unpaid food to a
  // security desk, so every uncollected order ends the same way: NO_SHOW.
  {
    from: S.ACCEPTED,
    to: S.NO_SHOW,
    actors: [A.SYSTEM, A.VENDOR],
    why: "Student absent, or refused to pay the cash.",
  },
  {
    from: S.PREPARING,
    to: S.NO_SHOW,
    actors: [A.SYSTEM, A.VENDOR],
    why: "Student absent, or refused to pay the cash.",
  },
  {
    from: S.READY,
    to: S.NO_SHOW,
    actors: [A.SYSTEM, A.VENDOR],
    why: "Student absent, or refused to pay the cash.",
  },
  {
    from: S.OUT_FOR_DELIVERY,
    to: S.NO_SHOW,
    actors: [A.SYSTEM, A.VENDOR],
    why: "Student absent, or refused to pay the cash.",
  },
  {
    from: S.AT_GATE,
    to: S.NO_SHOW,
    actors: [A.SYSTEM, A.VENDOR],
    why: "F7/F8/F9 — grace elapsed, or the student refused the cash. The food goes back with the rider and the vendor carries the loss.",
  },

  /* ── Admin override ───────────────────────────────────────────── */
  ...(
    [S.PLACED, S.ACCEPTED, S.PREPARING, S.READY, S.OUT_FOR_DELIVERY, S.AT_GATE] as const
  ).map<TransitionRule>((from) => ({
    from,
    to: S.CANCELLED_BY_ADMIN,
    // F6 — a student who answers "cancel the whole order" when an item runs
    // out mid-cook is exercising a PLATFORM cancellation, not a student one:
    // the fault is the kitchen's, and nothing is owed either way because the
    // food never reached a gate. It is fired by
    // SYSTEM on the student's instruction, and only from the two states where
    // a stockout can actually be discovered. The vendor still cannot cancel
    // from anywhere, which is the rule that matters.
    actors:
      from === S.ACCEPTED || from === S.PREPARING ? [A.ADMIN, A.SYSTEM] : [A.ADMIN],
    why: "Admin override: power cut, closure, emergency. Nothing was paid.",
    requiresReason: true,
  })),

  /* ── Settlement ───────────────────────────────────────────────── */
  {
    from: S.DELIVERED,
    to: S.SETTLED,
    actors: [A.SYSTEM],
    why: "Nightly run: this order is on a vendor's commission statement.",
  },
];

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

const byEdge = new Map<string, TransitionRule[]>();
for (const rule of TRANSITIONS) {
  const key = `${rule.from}>${rule.to}`;
  const existing = byEdge.get(key);
  if (existing) existing.push(rule);
  else byEdge.set(key, [rule]);
}

/** Every status reachable from `from`, regardless of actor. For UI affordances. */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return [...new Set(TRANSITIONS.filter((r) => r.from === from).map((r) => r.to))];
}

/** Every status `actor` may move an order to from `from`. Drives which buttons render. */
export function allowedStatusesFor(from: OrderStatus, actor: Actor): OrderStatus[] {
  return [
    ...new Set(
      TRANSITIONS.filter((r) => r.from === from && r.actors.includes(actor)).map((r) => r.to),
    ),
  ];
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS.every((r) => r.from !== status);
}

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

/** Everything the FSM needs to know about an order, without importing the DB. */
export interface TransitionSubject {
  status: OrderStatus;
  gateCode: string | null;
  prepMinutes: number | null;
}

export interface TransitionRequest {
  to: OrderStatus;
  actor: Actor;
  /** Mandatory for rejections and cancellations. */
  reason?: string | undefined;
  /** Required when moving PLACED -> ACCEPTED. */
  prepMinutes?: number | undefined;
}

export type TransitionErrorCode =
  | "ILLEGAL_TRANSITION"
  | "WRONG_ACTOR"
  | "REASON_REQUIRED"
  | "PREP_MINUTES_INVALID"
  | "GATE_CODE_MISSING"
  | "ALREADY_TERMINAL";

export class TransitionError extends Error {
  readonly code: TransitionErrorCode;
  readonly from: OrderStatus;
  readonly to: OrderStatus;

  constructor(code: TransitionErrorCode, message: string, from: OrderStatus, to: OrderStatus) {
    super(message);
    this.name = "TransitionError";
    this.code = code;
    this.from = from;
    this.to = to;
  }
}

export interface TransitionPlan {
  from: OrderStatus;
  to: OrderStatus;
  actor: Actor;
  reason: string | null;
  rule: TransitionRule;
}

const PREP_MIN = 5;
const PREP_MAX = 60;

/**
 * Validate a transition and return the plan the caller must persist.
 *
 * Throws rather than returning a boolean, because every caller of this function
 * is a write path, and a silently-ignored false is how an order ends up in an
 * impossible state.
 */
export function assertTransition(
  subject: TransitionSubject,
  request: TransitionRequest,
): TransitionPlan {
  const { status: from } = subject;
  const { to, actor } = request;

  if (isTerminal(from)) {
    throw new TransitionError(
      "ALREADY_TERMINAL",
      `${from} is terminal; nothing can follow it.`,
      from,
      to,
    );
  }

  const candidates = byEdge.get(`${from}>${to}`);
  if (!candidates || candidates.length === 0) {
    throw new TransitionError(
      "ILLEGAL_TRANSITION",
      `${from} -> ${to} is not a legal transition.`,
      from,
      to,
    );
  }

  const rule = candidates.find((r) => r.actors.includes(actor));
  if (!rule) {
    const permitted = [...new Set(candidates.flatMap((r) => r.actors))].join(", ");
    throw new TransitionError(
      "WRONG_ACTOR",
      `${actor} may not fire ${from} -> ${to}. Permitted: ${permitted}.`,
      from,
      to,
    );
  }

  const reason = request.reason?.trim() ?? "";
  if (rule.requiresReason === true && reason.length === 0) {
    throw new TransitionError(
      "REASON_REQUIRED",
      `${from} -> ${to} requires a written reason. It is shown to the student and written to the audit log.`,
      from,
      to,
    );
  }

  if (to === ORDER_STATUS.ACCEPTED) {
    const prep = request.prepMinutes;
    if (prep === undefined || !Number.isSafeInteger(prep) || prep < PREP_MIN || prep > PREP_MAX) {
      throw new TransitionError(
        "PREP_MINUTES_INVALID",
        `Accepting requires prep minutes between ${PREP_MIN} and ${PREP_MAX}, received ${String(prep)}.`,
        from,
        to,
      );
    }
  }

  // A rider cannot leave with a packet that has no code written on it — the
  // student would have nothing to match at the gate, and D4's whole anti-fraud
  // property rests on that match.
  if (to === ORDER_STATUS.OUT_FOR_DELIVERY && !subject.gateCode) {
    throw new TransitionError(
      "GATE_CODE_MISSING",
      "The gate code must be generated before the rider is dispatched.",
      from,
      to,
    );
  }

  return { from, to, actor, reason: reason.length > 0 ? reason : null, rule };
}

/** Non-throwing probe, for rendering a disabled button rather than crashing. */
export function canTransition(
  subject: TransitionSubject,
  request: TransitionRequest,
): { ok: true } | { ok: false; code: TransitionErrorCode; message: string } {
  try {
    assertTransition(subject, request);
    return { ok: true };
  } catch (error: unknown) {
    if (error instanceof TransitionError) {
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  }
}
