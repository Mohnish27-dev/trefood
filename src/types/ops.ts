import type { Paise } from "@/lib/money";

/**
 * Gateway event ids already processed.
 *
 * PRD Part 4.5 — insert the event id (unique index) BEFORE acting. In that
 * order. Reversing it means a replayed webhook double-processes an order.
 */
export interface WebhookEvent {
  _id: string;
  eventId: string;
  provider: "PHONEPE";
  eventType: string;
  orderId: string | null;
  processedAt: Date;
  payloadHash: string;
}

/** Web Push endpoints, one per device. Free, and the only push channel until DLT clears. */
export interface PushSubscription {
  _id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
}

/**
 * A student complaint. Photo evidence is MANDATORY — no photo, no dispute.
 * FAILURES_AND_EDGE_CASES.md section 3.
 */
export interface Dispute {
  _id: string;
  orderId: string;
  orderNumber: string;
  campusId: string;
  restaurantId: string;
  customerId: string;

  reason: "WRONG_ITEM" | "MISSING_ITEM" | "SPILLED" | "COLD" | "NOT_DELIVERED" | "OTHER";
  note: string;
  /** Supabase Storage URLs. At least one is required to open a dispute. */
  photoUrls: string[];

  status: "OPEN" | "UPHELD" | "REJECTED";
  ruling: string | null;
  refundAmountPaise: Paise | null;
  /** Debits the vendor ledger when the ruling favours the student. */
  vendorDebitPaise: Paise | null;
  ruledBy: string | null;
  ruledAt: Date | null;

  createdAt: Date;
}

/** Per-campus order-number sequence. Kept in its own collection so an increment is one atomic findOneAndUpdate. */
export interface Counter {
  _id: string;
  value: number;
}
