"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";

/**
 * One line in the cart.
 *
 * NOTE WHAT IS ABSENT: there is no price here, and there never will be.
 *
 * The cart stores item IDs, quantities and add-on IDs only. The server recomputes
 * every rupee from the database at checkout — a client-supplied price is a security
 * bug (docs/MASTER_PROMPT_PRD.md Part 4 rule 2). Storing a price would also make
 * F13/F14 unfixable: when a menu price changes between adding to cart and paying,
 * the only correct answer is to recompute, and a cached price is exactly the thing
 * that would silently win instead.
 */
export interface CartLine {
  lineId: string;
  itemId: string;
  quantity: number;
  /** Chosen add-on IDs. Names and prices are resolved from the menu at render time. */
  addOnIds: string[];
}

interface CartState {
  /** One restaurant per cart, enforced hard. */
  restaurantId: string | null;
  restaurantSlug: string | null;
  restaurantName: string | null;
  lines: CartLine[];
}

const EMPTY_CART: CartState = {
  restaurantId: null,
  restaurantSlug: null,
  restaurantName: null,
  lines: [],
};

interface AddToCartInput {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  itemId: string;
  quantity: number;
  addOnIds: string[];
}

interface CartContextValue {
  cart: CartState;
  itemCount: number;
  isHydrated: boolean;
  /**
   * Returns `"conflict"` when the item belongs to a different restaurant than the
   * one already in the cart. The caller must then ask the student before clearing —
   * silently discarding a cart is never acceptable.
   */
  addItem: (input: AddToCartInput) => "added" | "conflict";
  /** Clears the cart and adds the item. Only call after the student has confirmed. */
  replaceCartWith: (input: AddToCartInput) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function makeLineId(itemId: string, addOnIds: string[]): string {
  // Identical item + identical add-ons is the SAME line, so tapping "add" twice
  // increments the quantity instead of stacking two identical rows.
  return [itemId, ...[...addOnIds].sort()].join("|");
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { value: cart, setValue, isHydrated } = useLocalStorage<CartState>(
    "trefood.cart",
    EMPTY_CART,
  );

  const upsert = useCallback(
    (state: CartState, input: AddToCartInput): CartState => {
      const lineId = makeLineId(input.itemId, input.addOnIds);
      const existing = state.lines.find((line) => line.lineId === lineId);

      return {
        restaurantId: input.restaurantId,
        restaurantSlug: input.restaurantSlug,
        restaurantName: input.restaurantName,
        lines: existing
          ? state.lines.map((line) =>
              line.lineId === lineId
                ? { ...line, quantity: line.quantity + input.quantity }
                : line,
            )
          : [
              ...state.lines,
              {
                lineId,
                itemId: input.itemId,
                quantity: input.quantity,
                addOnIds: input.addOnIds,
              },
            ],
      };
    },
    [],
  );

  const addItem = useCallback(
    (input: AddToCartInput): "added" | "conflict" => {
      /**
       * One restaurant per cart, enforced hard.
       *
       * Multi-restaurant carts would double the entire order, dispatch and settlement
       * model to serve a rare want (docs/FAILURES_AND_EDGE_CASES.md §4). More
       * concretely: two restaurants means two kitchens, two prep times, two riders,
       * and two gate codes for one delivery. There is no coherent handoff.
       */
      if (
        cart.restaurantId !== null &&
        cart.restaurantId !== input.restaurantId &&
        cart.lines.length > 0
      ) {
        return "conflict";
      }
      setValue((current) => upsert(current, input));
      return "added";
    },
    [cart.restaurantId, cart.lines.length, setValue, upsert],
  );

  const replaceCartWith = useCallback(
    (input: AddToCartInput) => setValue(() => upsert(EMPTY_CART, input)),
    [setValue, upsert],
  );

  const setQuantity = useCallback(
    (lineId: string, quantity: number) => {
      setValue((current) => {
        const lines =
          quantity <= 0
            ? current.lines.filter((line) => line.lineId !== lineId)
            : current.lines.map((line) =>
                line.lineId === lineId ? { ...line, quantity } : line,
              );
        return lines.length === 0 ? EMPTY_CART : { ...current, lines };
      });
    },
    [setValue],
  );

  const removeLine = useCallback(
    (lineId: string) => setQuantity(lineId, 0),
    [setQuantity],
  );

  const clear = useCallback(() => setValue(() => EMPTY_CART), [setValue]);

  const itemCount = useMemo(
    () => cart.lines.reduce((total, line) => total + line.quantity, 0),
    [cart.lines],
  );

  const contextValue = useMemo(
    () => ({
      cart,
      itemCount,
      isHydrated,
      addItem,
      replaceCartWith,
      setQuantity,
      removeLine,
      clear,
    }),
    [cart, itemCount, isHydrated, addItem, replaceCartWith, setQuantity, removeLine, clear],
  );

  return <CartContext value={contextValue}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === null) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return context;
}
