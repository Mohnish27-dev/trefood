/**
 * The vocabulary of TREFOOD: statuses, roles, and every timer.
 *
 * Enums are SCREAMING_SNAKE string-literal unions, never numbers, so a raw database
 * dump is readable by a human at 1 AM (docs/PROJECT_STRUCTURE.md §4).
 */

// ── Order status ──────────────────────────────────────────────────────────

/**
 * Every state in the FSM from
 * docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §3. Phase 10 builds the guarded transition
 * function; this is only the alphabet it operates over.
 */
export const ORDER_STATUSES = [
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "AT_GATE",
  "DELIVERED",
  "DELIVERED_TO_SECURITY",
  "NO_SHOW",
  "REJECTED_BY_VENDOR",
  "EXPIRED_NO_ACK",
  "CANCELLED_BY_ADMIN",
  "DISPUTED",
  "DISPUTE_UPHELD",
  "DISPUTE_REJECTED",
  "SETTLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * The happy path, in the order the student's stepper draws it.
 *
 * Note what is absent: any notion of position, distance, or a moving vehicle. This
 * list IS the tracking experience (docs/DECISIONS.md §2). ACCEPTED and PREPARING
 * collapse into one visible step because a student cannot act on the difference.
 */
export const STUDENT_STEPPER_STATUSES = [
  "PLACED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "AT_GATE",
  "DELIVERED",
] as const satisfies readonly OrderStatus[];

export type StepperStatus = (typeof STUDENT_STEPPER_STATUSES)[number];

/** Student-facing labels. "Live Order Status", never "Live Rider Tracking". */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PAYMENT_PENDING: "Awaiting payment",
  PAYMENT_FAILED: "Payment failed",
  PLACED: "Order placed",
  ACCEPTED: "Accepted",
  PREPARING: "Cooking",
  READY: "Packed",
  OUT_FOR_DELIVERY: "On the way",
  AT_GATE: "At the gate",
  DELIVERED: "Delivered",
  DELIVERED_TO_SECURITY: "Left with security",
  NO_SHOW: "Not collected",
  REJECTED_BY_VENDOR: "Restaurant declined",
  EXPIRED_NO_ACK: "Restaurant did not respond",
  CANCELLED_BY_ADMIN: "Cancelled",
  DISPUTED: "Issue reported",
  DISPUTE_UPHELD: "Refund approved",
  DISPUTE_REJECTED: "Issue reviewed",
  SETTLED: "Delivered",
};

/**
 * States with no outgoing transition. The order is finished, for good.
 *
 * `DELIVERED` is deliberately NOT here: it can still become `DISPUTED` inside the
 * 30-minute window, and it becomes `SETTLED` at midnight.
 */
export const TERMINAL_ORDER_STATUSES = [
  "PAYMENT_FAILED",
  "NO_SHOW",
  "REJECTED_BY_VENDOR",
  "EXPIRED_NO_ACK",
  "CANCELLED_BY_ADMIN",
  "DISPUTE_UPHELD",
  "DISPUTE_REJECTED",
  "SETTLED",
] as const satisfies readonly OrderStatus[];

/**
 * States at which the student's 8-second tracker stops polling.
 *
 * Wider than `TERMINAL_ORDER_STATUSES`, because the *student* is done once the food
 * is handed over even though the order still has a settlement step ahead of it.
 * Polling a delivered order for eight more hours is pure waste.
 */
export const TRACKING_COMPLETE_STATUSES = [
  ...TERMINAL_ORDER_STATUSES,
  "DELIVERED",
  "DELIVERED_TO_SECURITY",
] as const satisfies readonly OrderStatus[];

/** The board columns in the vendor console, left to right. */
export const VENDOR_BOARD_COLUMNS = [
  { key: "NEW", label: "New", statuses: ["PLACED"] },
  { key: "PREPARING", label: "Preparing", statuses: ["ACCEPTED", "PREPARING"] },
  { key: "READY", label: "Ready", statuses: ["READY"] },
  { key: "OUT", label: "Out for delivery", statuses: ["OUT_FOR_DELIVERY", "AT_GATE"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly OrderStatus[] }[];

export function isTerminalStatus(status: OrderStatus): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

export function isTrackingComplete(status: OrderStatus): boolean {
  return (TRACKING_COMPLETE_STATUSES as readonly OrderStatus[]).includes(status);
}

// ── Roles ─────────────────────────────────────────────────────────────────

export const USER_ROLES = [
  "STUDENT",
  "VENDOR_STAFF",
  "VENDOR_OWNER",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

// ── Payment ───────────────────────────────────────────────────────────────

export const PAYMENT_METHODS = ["ONLINE_100", "HYBRID_COD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ── Delivery zones ────────────────────────────────────────────────────────

export const ZONE_TYPES = [
  "MAIN_GATE",
  "HOSTEL_BOYS",
  "HOSTEL_GIRLS",
  "ACADEMIC",
  "RESIDENTIAL",
] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

// ── Timers ────────────────────────────────────────────────────────────────

/**
 * Every timer in the system, from docs/DECISIONS.md §4.
 *
 * These are DEFAULTS. Each is a per-campus config key, and the campus value wins at
 * runtime — a campus row must never need a code change (docs/MASTER_PROMPT_PRD.md
 * Part 1). They live here so the UI can draw a countdown ring before Phase 7 exists.
 */
export const TIMERS = {
  /** A5 — the vendor's countdown ring turns amber here. */
  vendorAckWarningSeconds: 180,
  /** A5 — auto-expire with a full refund (F4). */
  vendorAckExpirySeconds: 240,
  /** A6 — student's window at AT_GATE before auto-close. Prepaid only. */
  gateGraceSeconds: 900,
  /** F7/F8 — a second push at five minutes in. */
  gateSecondPushSeconds: 300,
  /** F7/F8 — the vendor phones the student at ten minutes in. */
  gateVendorCallSeconds: 600,
  /** F11 layer 1 — a zone closes to new orders this long before its curfew. */
  curfewBufferSeconds: 600,
  /** F6 — stockout resolution auto-defaults to "remove it, deliver rest". */
  stockoutResolutionSeconds: 300,
  /** §3 — the student's window to raise a dispute after delivery. */
  disputeWindowSeconds: 1800,
} as const;

/**
 * Polling intervals, from docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §8.
 *
 * Polling rather than websockets is deliberate: sockets die at the serverless
 * function timeout, and polling survives phone sleep, tunnel Wi-Fi, and cold starts.
 */
export const POLL_INTERVALS_MS = {
  /** The vendor board. The only real-time surface that matters. */
  vendorBoard: 5_000,
  /** The student tracker. Stops at a TRACKING_COMPLETE status. */
  studentTracker: 8_000,
  /** The admin live radar. Pauses on tab hidden. */
  adminRadar: 10_000,
} as const;

/** Two consecutive failures raise the "connection lost" banner on the vendor board. */
export const POLL_FAILURES_BEFORE_BANNER = 2;

// ── Pricing defaults ──────────────────────────────────────────────────────

/**
 * Defaults for the open assumptions in docs/DECISIONS.md §4. Every one is a campus
 * config key; these values exist so fixtures and tests have something to use.
 *
 * A3 in particular is an ASSUMPTION: verify the real Razorpay rate on your plan
 * before go-live. It is the number students see.
 */
export const PRICING_DEFAULTS = {
  /** D6 — charged on food + packaging + delivery. */
  commissionPct: 10,
  /** A3 — 2% gateway fee + 18% GST on that fee. Non-refundable (D2). */
  gatewayFeePct: 2.36,
  /** A2 — correct only for canteens below the ₹20 L registration threshold. */
  foodGstPct: 0,
  /** A4 — commission rounds up; the vendor takes the remainder. */
  roundingMode: "CEIL",
  /** A1 — TREFOOD absorbs coupons out of its own commission. */
  couponFundedBy: "PLATFORM",
  /** A7 — the lever that would make COD cost more than prepaid. Ships off. */
  codHandlingFeePaise: 0,
} as const;

/** A1 — cap a coupon at 10% of the commission base unless a loss-leader is intended. */
export const MAX_COUPON_PCT_OF_BASE = 10;

// ── Accessibility ─────────────────────────────────────────────────────────

/**
 * Minimum touch target, in CSS pixels. Non-negotiable on the student PWA: these
 * screens are used one-handed, walking, at night.
 */
export const MIN_TOUCH_TARGET_PX = 44;
