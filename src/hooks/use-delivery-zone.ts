"use client";

import { useCallback, useSyncExternalStore } from "react";

import { CAMPUS_COOKIE, COOKIE_MAX_AGE_SECONDS, zoneCookieName } from "@/lib/cookies";

/**
 * The selected delivery gate, remembered across visits.
 *
 * Chosen BEFORE browsing, not at checkout — it filters which restaurants are
 * even shown, because vendors declare which zones they serve (ARCH section 4,
 * step 2). Persisted so a returning student lands straight on their own
 * hostel's list.
 *
 * Stored in a COOKIE rather than localStorage, deliberately: the restaurant
 * list is filtered on the server, so the server has to know the zone before it
 * renders. A localStorage value would force a client round-trip and a visible
 * flash of the wrong list on every navigation.
 */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  // Lax rather than Strict: a student following a shared restaurant link from
  // WhatsApp must still arrive with their gate remembered.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

/* ------------------------------------------------------------------ */
/* External store over document.cookie                                 */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
/** Cached, so getSnapshot returns a stable value between writes. */
const snapshots = new Map<string, string | null>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshotFor(cookieName: string): string | null {
  if (!snapshots.has(cookieName)) snapshots.set(cookieName, readCookie(cookieName));
  return snapshots.get(cookieName) ?? null;
}

export function useDeliveryZone(campusSlug: string) {
  const cookieName = zoneCookieName(campusSlug);

  // The server cannot read document.cookie, so it snapshots null and React
  // re-renders with the real value after hydration. No effect, no flash of a
  // wrong gate name, no cascading render.
  const zoneId = useSyncExternalStore(
    subscribe,
    () => snapshotFor(cookieName),
    () => null,
  );

  const setZoneId = useCallback(
    (next: string): void => {
      writeCookie(cookieName, next);
      writeCookie(CAMPUS_COOKIE, campusSlug);
      snapshots.set(cookieName, next);
      notify();
    },
    [cookieName, campusSlug],
  );

  return { zoneId, setZoneId };
}
