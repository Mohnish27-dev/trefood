"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The current time, as a React external store.
 *
 * Calling `Date.now()` during render is impure — React may render twice and get two
 * answers — and a `useState` + `setInterval` pair is a setState in an effect. Wrapping
 * the clock in an external store fixes both: the snapshot is read during render, and
 * the interval only nudges React to re-read it.
 *
 * The server snapshot is a fixed 0, so nothing time-dependent is baked into the HTML
 * at build time. A countdown must render `--:--` until mounted rather than shipping a
 * "12:04 remaining" that was true whenever the page was built.
 */
export function useNow(intervalMs = 1000): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const timer = setInterval(onChange, intervalMs);
      return () => clearInterval(timer);
    },
    [intervalMs],
  );

  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    // 0 means "not mounted yet". Callers render a placeholder.
    () => 0,
  );
}
