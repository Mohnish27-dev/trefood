"use client";

import { useCallback, useEffect, useState } from "react";
import { POLL_FAILURES_BEFORE_BANNER, POLL_INTERVALS_MS, type IOrder } from "@trefood/shared";

import { pollVendorOrders } from "@/lib/vendor-store";

/**
 * The vendor board's polling loop.
 *
 * Polling rather than websockets, deliberately: a socket dies at the serverless
 * function timeout, and a tablet that sleeps behind a counter would silently stop
 * receiving orders with no way to know. Polling recovers by itself on the next tick
 * (docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §8).
 *
 * Two consecutive failures raise a connection banner. One failure is a blip; two in a
 * row means the tablet is offline and orders are landing that nobody can see — which
 * the vendor must be told, loudly, because the platform cannot fix it for them.
 */
export function useVendorBoard() {
  const [orders, setOrders] = useState<IOrder[] | null>(null);
  const [consecutiveFailures, setFailures] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const poll = useCallback(() => {
    pollVendorOrders()
      .then((result) => {
        setOrders(result);
        setFailures(0);
        setLastSyncedAt(Date.now());
      })
      .catch(() => setFailures((current) => current + 1));
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_INTERVALS_MS.vendorBoard);

    /**
     * Pause while hidden, and re-poll the moment the tab is shown.
     *
     * Note the difference from the student tracker: this pauses to save the tablet's
     * battery, but the browser notification in `use-order-alarm` still fires for a
     * hidden tab — the board being paused must never mean an order goes unannounced.
     */
    const onVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  return {
    orders,
    refresh: poll,
    isDisconnected: consecutiveFailures >= POLL_FAILURES_BEFORE_BANNER,
    lastSyncedAt,
  } as const;
}
