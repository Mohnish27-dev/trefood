"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A `localStorage`-backed value, exposed as a React external store.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`, for four reasons:
 *
 *   1. **No setState in an effect.** Reading storage into state on mount is a
 *      cascading render; an external store is read during render, from a snapshot.
 *   2. **Server rendering works.** `getServerSnapshot` returns the initial value, so
 *      SSR and the first client render agree and hydration does not mismatch.
 *   3. **Tabs stay in sync.** A cart changed in one tab reaches the others through the
 *      native `storage` event, for free.
 *   4. **Snapshots are cached**, so `getSnapshot` can return a parsed object without
 *      returning a new reference on every call and looping forever.
 */

/** Cache of the last parsed value per key, so snapshots are referentially stable. */
const snapshotCache = new Map<string, { raw: string | null; parsed: unknown }>();

/** Same-tab listeners: the native `storage` event only fires in OTHER tabs. */
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private mode or blocked storage — behave as if nothing was stored.
    return null;
  }
}

function readSnapshot<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  const cached = snapshotCache.get(key);
  if (cached !== undefined && cached.raw === raw) return cached.parsed as T;

  let parsed: unknown = fallback;
  if (raw !== null) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // A half-written value from a killed tab. Discard rather than crash.
      parsed = fallback;
    }
  }
  snapshotCache.set(key, { raw, parsed });
  return parsed as T;
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const set = listeners.get(key) ?? new Set();
      set.add(onChange);
      listeners.set(key, set);

      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) onChange();
      };
      window.addEventListener("storage", onStorage);

      return () => {
        set.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => readSnapshot(key, initialValue),
    // Server snapshot: storage does not exist, so the initial value is the truth.
    () => initialValue,
  );

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = readSnapshot(key, initialValue);
      const resolved = typeof next === "function" ? (next as (c: T) => T)(current) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Quota exceeded or private mode. Cache it so the session still works.
        snapshotCache.set(key, { raw: JSON.stringify(resolved), parsed: resolved });
      }
      notify(key);
    },
    [key, initialValue],
  );

  /**
   * True once the browser snapshot is in use.
   *
   * Callers need this to avoid flashing server-rendered defaults — a cart badge that
   * renders 0 and then 3 looks broken. `useSyncExternalStore` with a distinct server
   * snapshot gives us the signal without an extra effect.
   */
  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return { value, setValue, isHydrated } as const;
}
