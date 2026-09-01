"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * The cart. localStorage, IDs and quantities ONLY.
 *
 * PRD Part 4.2 — "The client posts item IDs and quantities. A client-supplied
 * price is a security bug." So nothing in this store holds a rupee. Names and
 * prices shown in the cart UI are re-read from the server on every render of
 * the cart page, and the total the student sees comes from the same
 * `computePricing` the order-creation path calls.
 *
 * One restaurant per cart, enforced hard (FAILURES section 4). Adding from a
 * second restaurant is refused with a signal the caller turns into a
 * "clear cart and start over?" prompt, rather than silently wiping the cart.
 */

const STORAGE_KEY = "trefood.cart.v1";

export interface CartLine {
  /** Stable per configuration: same item with different add-ons is a different line. */
  lineId: string;
  itemId: string;
  quantity: number;
  /** AddOnOption ids. Prices are resolved server-side. */
  addOnOptionIds: string[];
}

export interface CartState {
  restaurantId: string | null;
  restaurantSlug: string | null;
  campusSlug: string | null;
  lines: CartLine[];
}

const EMPTY: CartState = { restaurantId: null, restaurantSlug: null, campusSlug: null, lines: [] };

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

let memoryState: CartState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function read(): CartState {
  if (typeof window === "undefined") return EMPTY;
  if (hydrated) return memoryState;

  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isCartState(parsed)) memoryState = parsed;
    }
  } catch {
    // A corrupt or unavailable localStorage must never break the app.
    // Private windows and storage-blocked browsers land here.
    memoryState = EMPTY;
  }
  return memoryState;
}

function write(next: CartState): void {
  memoryState = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory cart working even when persistence fails.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab editing the cart should be reflected here.
  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) {
      hydrated = false;
      read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stable identity, so useSyncExternalStore does not loop during hydration. */
function getServerSnapshot(): CartState {
  return EMPTY;
}

function isCartState(value: unknown): value is CartState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.lines) && ("restaurantId" in v);
}

function lineKey(itemId: string, addOnOptionIds: readonly string[]): string {
  return [itemId, ...[...addOnOptionIds].sort()].join("|");
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export type AddResult = { ok: true } | { ok: false; reason: "DIFFERENT_RESTAURANT" };

export function useCart() {
  // useSyncExternalStore handles the hydration split for us: it renders the
  // server snapshot (an empty cart) during SSR and hydration, then re-renders
  // with the real localStorage value. No effect-driven "ready" flag needed.
  const state = useSyncExternalStore(subscribe, read, getServerSnapshot);

  const add = useCallback(
    (params: {
      restaurantId: string;
      restaurantSlug: string;
      campusSlug: string;
      itemId: string;
      addOnOptionIds?: string[];
      quantity?: number;
    }): AddResult => {
      const current = read();
      const addOns = params.addOnOptionIds ?? [];
      const qty = params.quantity ?? 1;

      if (current.restaurantId !== null && current.restaurantId !== params.restaurantId) {
        // Never silently discard a cart. The caller prompts.
        return { ok: false, reason: "DIFFERENT_RESTAURANT" };
      }

      const key = lineKey(params.itemId, addOns);
      const existing = current.lines.find((l) => l.lineId === key);

      const lines = existing
        ? current.lines.map((l) =>
            l.lineId === key ? { ...l, quantity: l.quantity + qty } : l,
          )
        : [...current.lines, { lineId: key, itemId: params.itemId, quantity: qty, addOnOptionIds: addOns }];

      write({
        restaurantId: params.restaurantId,
        restaurantSlug: params.restaurantSlug,
        campusSlug: params.campusSlug,
        lines,
      });
      return { ok: true };
    },
    [],
  );

  const setQuantity = useCallback((lineId: string, quantity: number): void => {
    const current = read();
    const lines =
      quantity <= 0
        ? current.lines.filter((l) => l.lineId !== lineId)
        : current.lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l));

    write(lines.length === 0 ? EMPTY : { ...current, lines });
  }, []);

  const clear = useCallback((): void => write(EMPTY), []);

  /** Replace the whole cart — used by "clear and start over" and by reorder. */
  const replaceWith = useCallback(
    (params: {
      restaurantId: string;
      restaurantSlug: string;
      campusSlug: string;
      lines: CartLine[];
    }): void => write(params),
    [],
  );

  /**
   * F14 — an item 86-ed between adding it and checking out. The server tells
   * us which ids died; we drop them and let the UI highlight the change rather
   * than silently re-totalling.
   */
  const dropItems = useCallback((itemIds: readonly string[]): void => {
    const current = read();
    const drop = new Set(itemIds);
    const lines = current.lines.filter((l) => !drop.has(l.itemId));
    write(lines.length === 0 ? EMPTY : { ...current, lines });
  }, []);

  const itemCount = useMemo(
    () => state.lines.reduce((n, l) => n + l.quantity, 0),
    [state.lines],
  );

  return {
    ...state,
    itemCount,
    add,
    setQuantity,
    clear,
    replaceWith,
    dropItems,
  };
}
