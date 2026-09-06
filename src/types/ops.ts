/**
 * Gateway event ids already processed.
 *
 * PRD Part 4.5 — insert the event id (unique index) BEFORE acting. In that
 * order. Reversing it means a replayed webhook double-processes an order.
 */
export interface WebhookEvent {
  _id: string;
  eventId: string;
  provider: "PHONEPE" | "PAYTM";
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

/** Per-campus order-number sequence. Kept in its own collection so an increment is one atomic findOneAndUpdate. */
export interface Counter {
  _id: string;
  value: number;
}
