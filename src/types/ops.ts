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
