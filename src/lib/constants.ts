/**
 * Enums, status lists and timers.
 *
 * PROJECT_STRUCTURE.md section 4: enums are SCREAMING_SNAKE string literals,
 * never numbers, so a database dump is readable by a human at 2 AM.
 */

/* ══════════════════════════════════════════════════════════════════════
   Order lifecycle — SYSTEM_ARCHITECTURE_AND_FLOWS.md section 3
   ══════════════════════════════════════════════════════════════════════ */

export const ORDER_STATUS = {
  PLACED: "PLACED",
  ACCEPTED: "ACCEPTED",
  PREPARING: "PREPARING",
  READY: "READY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  AT_GATE: "AT_GATE",
  DELIVERED: "DELIVERED",
  NO_SHOW: "NO_SHOW",
  REJECTED_BY_VENDOR: "REJECTED_BY_VENDOR",
  EXPIRED_NO_ACK: "EXPIRED_NO_ACK",
  CANCELLED_BY_ADMIN: "CANCELLED_BY_ADMIN",
  SETTLED: "SETTLED",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** Statuses from which nothing further can happen without an admin. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.REJECTED_BY_VENDOR,
  ORDER_STATUS.EXPIRED_NO_ACK,
  ORDER_STATUS.CANCELLED_BY_ADMIN,
  ORDER_STATUS.NO_SHOW,
  ORDER_STATUS.SETTLED,
];

/** Statuses that appear on the vendor's live board. */
export const VENDOR_ACTIVE_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.PLACED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.AT_GATE,
];

/**
 * Statuses visible in a customer's order history.
 *
 * Every order a student places is real from the moment it is placed — there is
 * no payment step in front of it any more — so every status a customer can
 * reach belongs in their history.
 */
export const CUSTOMER_VISIBLE_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.PLACED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.AT_GATE,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.NO_SHOW,
  ORDER_STATUS.REJECTED_BY_VENDOR,
  ORDER_STATUS.EXPIRED_NO_ACK,
  ORDER_STATUS.CANCELLED_BY_ADMIN,
  ORDER_STATUS.SETTLED,
];

/**
 * The steps a student sees on the tracker.
 */
export const STUDENT_STEPPER: readonly {
  key: string;
  label: string;
  statuses: readonly OrderStatus[];
}[] = [
  { key: "placed", label: "Placed", statuses: [ORDER_STATUS.PLACED] },
  {
    key: "accepted",
    label: "Preparing",
    statuses: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY],
  },
  {
    key: "on_the_way",
    label: "On the way",
    statuses: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.AT_GATE],
  },
  {
    key: "delivered",
    label: "Delivered",
    statuses: [ORDER_STATUS.DELIVERED, ORDER_STATUS.SETTLED],
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Actors & roles — ARCH section 2
   ══════════════════════════════════════════════════════════════════════ */

export const ROLE = {
  STUDENT: "STUDENT",
  VENDOR_STAFF: "VENDOR_STAFF",
  VENDOR_OWNER: "VENDOR_OWNER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

/** Who fired a transition. Broader than Role: the cron sweeps act too. */
export const ACTOR = {
  STUDENT: "STUDENT",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
  SYSTEM: "SYSTEM",
} as const;

export type Actor = (typeof ACTOR)[keyof typeof ACTOR];

/* ══════════════════════════════════════════════════════════════════════
   Payment — MONEY_AND_SETTLEMENT.md sections 3 and 4

   TREFOOD is cash on delivery, end to end. The student pays NOTHING to place
   an order; the whole bill is handed to the delivery partner at the gate, in
   cash, on the packet changing hands. There is no gateway, no token, no
   convenience fee and no refund path, because no money ever moves before the
   food does.

   That reverses the direction money settles in. The vendor ends the day
   holding every rupee their orders were worth, and owes TREFOOD the
   commission on them. `services/settlement.ts` collects; it does not pay out.
   ══════════════════════════════════════════════════════════════════════ */

export const PAYMENT_METHOD = {
  /** The only method. The student pays the full bill in cash, at handover. */
  COD: "COD",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_STATUS = {
  /** Placed and in flight. The cash has not changed hands yet. */
  DUE: "DUE",
  /** The delivery partner took the cash at the gate. */
  COLLECTED: "COLLECTED",
  /** The order ended without the food being handed over: rejected, expired,
      cancelled, or a no-show. Nobody owes anybody anything. */
  UNCOLLECTED: "UNCOLLECTED",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/* ══════════════════════════════════════════════════════════════════════
   Delivery zones — the physical reality the product is built around
   ══════════════════════════════════════════════════════════════════════ */

export const ZONE_TYPE = {
  HOSTEL_BOYS: "HOSTEL_BOYS",
  HOSTEL_GIRLS: "HOSTEL_GIRLS",
  ACADEMIC: "ACADEMIC",
  MAIN_GATE: "MAIN_GATE",
  RESIDENTIAL: "RESIDENTIAL",
} as const;

export type ZoneType = (typeof ZONE_TYPE)[keyof typeof ZONE_TYPE];

/* ══════════════════════════════════════════════════════════════════════
   Timers — DECISIONS.md section 4. Every one is a campus setting with a
   default here, so none of them is ever a magic number in a component.
   ══════════════════════════════════════════════════════════════════════ */

export const DEFAULTS = {
  /** A5 — vendor must accept within 3 minutes. */
  vendorAckSeconds: 180,
  /** A5 — auto-expire with full refund at 4 minutes. */
  vendorAutoExpireSeconds: 240,
  /** A6 — student has 15 minutes at the gate before auto-close. */
  gateGraceSeconds: 900,
  /** F11 — curfew buffer. An arrival inside this window is blocked. */
  curfewBufferMinutes: 10,
  /** F6 — student has 5 minutes to resolve a stockout before "drop it" is assumed. */
  stockoutResolutionSeconds: 300,
  /** F18 — nag the vendor once this multiple of prep time has elapsed without an at-gate tap. */
  atGateNagMultiplier: 2,
  /** F4 — three expiries in a day closes the restaurant automatically. */
  dailyExpiryCloseThreshold: 3,
  /**
   * F8 — no-shows past this count flag a student for an admin to look at.
   *
   * It does not block them. Cash on delivery is the only way to order now, so
   * an automatic block would be an automatic ban, and that is a decision a
   * person should make rather than a counter.
   */
  strikeAlertThreshold: 2,

  /** D6 — 10% commission, as basis points. What the vendor owes us per order. */
  commissionBps: 1_000,
  /** A4 — commission rounds up, the vendor's share takes the remainder. */
  roundingMode: "CEIL",

  /** Prep time bounds offered to the vendor on accept. */
  prepMinutesMin: 5,
  prepMinutesMax: 60,
  prepMinutesPresets: [15, 20, 30] as const,
} as const;

/** IST. Every campus-local comparison goes through the campus timezone, never the server clock. */
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/* ══════════════════════════════════════════════════════════════════════
   Stuck orders — the admin radar's whole reason to exist
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Why an order needs a human right now.
 *
 * Lives here rather than beside the radar service because the label map is
 * rendered by a Client Component. A `server-only` module cannot export a
 * runtime value into the browser bundle — it would drag the Mongo driver in
 * with it — so the enum and its copy sit in the one place both sides can read.
 */
export const STUCK_REASON = {
  ACK_OVERDUE: "ACK_OVERDUE",
  GATE_OVERDUE: "GATE_OVERDUE",
  AT_GATE_NOT_TAPPED: "AT_GATE_NOT_TAPPED",
  STOCKOUT_UNANSWERED: "STOCKOUT_UNANSWERED",
} as const;

export type StuckReason = (typeof STUCK_REASON)[keyof typeof STUCK_REASON];

export const STUCK_LABEL: Record<StuckReason, string> = {
  ACK_OVERDUE: "Vendor has not accepted",
  GATE_OVERDUE: "Waiting at the gate past grace",
  AT_GATE_NOT_TAPPED: "No 'rider at gate' tap",
  STOCKOUT_UNANSWERED: "Stockout unanswered",
};

/* ══════════════════════════════════════════════════════════════════════
   Copy discipline — DECISIONS.md section 2
   Riders have no phones. There is no live tracking, and there never will be.
   Say "Live Order Status", never "Live Rider Tracking".
   ══════════════════════════════════════════════════════════════════════ */

export const COPY = {
  liveStatusTitle: "Live Order Status",
  noTrackingExplainer:
    "Your food is delivered by the restaurant's own staff, so there is no live map. You will be notified the moment it reaches your gate.",
} as const;
