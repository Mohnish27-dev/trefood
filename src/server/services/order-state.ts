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

export const TRANSITIONS: readonly TransitionRule[] = [
  /* ── Payment ──────────────────────────────────────────────────── */
  {
    from: S.PAYMENT_PENDING,
    to: S.PLACED,
    actors: [A.WEBHOOK, A.SYSTEM],
    why: "Razorpay captured the payment. Webhook or reconciliation cron only — never a client.",
  },
  {
    from: S.PAYMENT_PENDING,
    to: S.PAYMENT_FAILED,
    actors: [A.WEBHOOK, A.SYSTEM],
    why: "Gateway declined, or the attempt was abandoned for 15 minutes (F1).",
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
    why: "Vendor rejected. Full refund of refundableAmount (F5).",
    requiresReason: true,
  },
  {
    from: S.PLACED,
    to: S.EXPIRED_NO_ACK,
    actors: [A.SYSTEM],
    why: "Four minutes of silence. Auto-refund (F4). Cron only.",
  },

  /* ── Kitchen ──────────────────────────────────────────────────── */
  {
    from: S.ACCEPTED,
    to: S.PREPARING,
    actors: [A.SYSTEM, A.VENDOR],
    why: "Automatic on accept.",
  },
  {
    from: S.PREPARING,
    to: S.READY,
    actors: [A.VENDOR],
    why: "Packed. The gate code is revealed to the vendor to write on the packet.",
  },

  /* ── The gate handoff (D4) ────────────────────────────────────── */
  {
    from: S.READY,
    to: S.OUT_FOR_DELIVERY,
    actors: [A.VENDOR],
    why: "Rider left. Requires a generated gate code.",
  },
  {
    from: S.OUT_FOR_DELIVERY,
    to: S.AT_GATE,
    actors: [A.VENDOR],
    why: "Rider at gate. The most operationally critical tap in the product: it pushes the student and starts the grace timer.",
  },
  {
    from: S.AT_GATE,
    to: S.DELIVERED,
    actors: [A.STUDENT],
    why: "Student matched the packet code and tapped Confirm Received.",
  },
  {
    from: S.AT_GATE,
    to: S.DELIVERED,
    actors: [A.VENDOR],
    why: "COD fallback: vendor confirms the rider returned with the correct cash.",
  },
  {
    from: S.AT_GATE,
    to: S.DELIVERED,
    actors: [A.SYSTEM],
    why: "F10 — student took the food and never tapped. Auto-close at 15 minutes.",
  },
  {
    from: S.AT_GATE,
    to: S.DELIVERED_TO_SECURITY,
    actors: [A.SYSTEM, A.VENDOR],
    why: "F7 — prepaid, 15-minute grace elapsed. Packet left with the hostel guard.",
  },
  {
    from: S.AT_GATE,
    to: S.NO_SHOW,
    actors: [A.SYSTEM, A.VENDOR],
    why: "F8/F9 — COD student absent or refused the cash. Token forfeited to the vendor. No refund.",
  },

  /* ── Admin override ───────────────────────────────────────────── */
  ...(
    [S.PLACED, S.ACCEPTED, S.PREPARING, S.READY, S.OUT_FOR_DELIVERY, S.AT_GATE] as const
  ).map<TransitionRule>((from) => ({
    from,
    to: S.CANCELLED_BY_ADMIN,
    actors: [A.ADMIN],
    why: "Admin override: power cut, closure, emergency. Full refund.",
    requiresReason: true,
  })),

  /* ── Disputes ─────────────────────────────────────────────────── */
  {
    from: S.DELIVERED,
    to: S.DISPUTED,
    actors: [A.STUDENT],
    why: "Student reported an issue within 30 minutes. Photo evidence mandatory.",
    requiresReason: true,
  },
  {
    from: S.DELIVERED_TO_SECURITY,
    to: S.DISPUTED,
    actors: [A.STUDENT],
    why: "Same window applies to a guard handoff.",
    requiresReason: true,
  },
  {
    from: S.DISPUTED,
    to: S.DISPUTE_UPHELD,
    actors: [A.ADMIN],
    why: "Admin ruled for the student. Refund, and debit the vendor ledger.",
    requiresReason: true,
  },
  {
    from: S.DISPUTED,
    to: S.DISPUTE_REJECTED,
    actors: [A.ADMIN],
    why: "Admin ruled for the vendor.",
    requiresReason: true,
  },

  /* ── Settlement ───────────────────────────────────────────────── */
  {
    from: S.DELIVERED,
    to: S.SETTLED,
    actors: [A.SYSTEM],
    why: "Nightly settlement run.",
  },
  {
    from: S.DELIVERED_TO_SECURITY,
    to: S.SETTLED,
    actors: [A.SYSTEM],
    why: "Nightly settlement run.",
  },
  {
    from: S.DISPUTE_REJECTED,
    to: S.SETTLED,
    actors: [A.SYSTEM],
    why: "Dispute closed in the vendor's favour; the order settles normally.",
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
  /** Mandatory for rejections, cancellations and dispute rulings. */
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
