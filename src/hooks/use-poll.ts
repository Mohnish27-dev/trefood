"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Visibility-aware interval polling.
 *
 * ARCH section 8 — polling is not a compromise here, it is the correct answer.
 * Supabase Realtime watches Postgres rows and the orders live in MongoDB, so
 * it would emit nothing. Websockets on serverless die at the function timeout.
 * Polling survives phone sleep, tunnel wifi and cold starts, all of which kill
 * a socket.
 *
 * Stops when the tab is hidden, and fires immediately on return, so a vendor
 * switching back to the board sees current data rather than waiting 5 seconds.
 */

export interface PollOptions<T> {
  /** Milliseconds. Env-driven at every call site, never a literal. */
  intervalMs: number;
  /** Poll no further once this returns true — a terminal order, for instance. */
  stopWhen?: (data: T) => boolean;
  enabled?: boolean;
  /** Consecutive failures before `connectionLost` flips. Two, not one: a single dropped request on hostel wifi is normal. */
  failureThreshold?: number;
}

export interface PollResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  /** True after `failureThreshold` consecutive failures. Drives the vendor banner. */
  connectionLost: boolean;
  lastSyncedAt: Date | null;
  refresh: () => void;
}

export function usePoll<T>(
  fetcher: () => Promise<T>,
  { intervalMs, stopWhen, enabled = true, failureThreshold = 2 }: PollOptions<T>,
): PollResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failures, setFailures] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Refs, so changing the fetcher identity does not restart the interval.
  // Assigned in an effect rather than during render: a ref write during render
  // is not safe under concurrent rendering, because a render can be discarded.
  const fetcherRef = useRef(fetcher);
  const stopRef = useRef(stopWhen);
  const stoppedRef = useRef(false);

  useEffect(() => {
    fetcherRef.current = fetcher;
    stopRef.current = stopWhen;
  });

  const tick = useCallback(async (): Promise<void> => {
    if (stoppedRef.current) return;
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
      setFailures(0);
      setLastSyncedAt(new Date());
      if (stopRef.current?.(next) === true) stoppedRef.current = true;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
      setFailures((n) => n + 1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    stoppedRef.current = false;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = (): void => {
      if (timer !== null) return;
      void tick();
      timer = setInterval(() => void tick(), intervalMs);
    };

    const stop = (): void => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = (): void => {
      // Hidden tabs cost battery and query budget for data nobody is reading.
      if (document.visibilityState === "hidden") stop();
      else start();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, tick]);

  const refresh = useCallback((): void => {
    stoppedRef.current = false;
    void tick();
  }, [tick]);

  return {
    data,
    error,
    isLoading,
    connectionLost: failures >= failureThreshold,
    lastSyncedAt,
    refresh,
  };
}
