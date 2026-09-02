"use client";

import { useEffect, useMemo, useState } from "react";

import { useCart } from "./use-cart";
import type { CartPricingResponse } from "@/app/api/cart/preview/route";

/**
 * Server-priced cart, shared by the cart screen and checkout.
 *
 * One hook rather than two fetches, so the total on the cart screen and the
 * total on checkout come from the same response and cannot disagree even for
 * a frame. The client never computes a rupee.
 *
 * `status` is DERIVED from the cart and the last response rather than stored,
 * so the effect never calls setState synchronously and never cascades a render.
 */

export type QuoteStatus = "empty" | "loading" | "ready" | "error";

export interface CartQuoteResult {
  status: QuoteStatus;
  /** The last successful response. Kept during a refetch so totals do not flicker. */
  data: CartPricingResponse | null;
  reload: () => void;
}

interface FetchResult {
  /** The cart signature this response describes. Stale when it differs from the current one. */
  key: string;
  data: CartPricingResponse | null;
  error: boolean;
}

export function useCartQuote(): CartQuoteResult {
  const { lines, restaurantId, couponCode } = useCart();
  const [result, setResult] = useState<FetchResult>({ key: "", data: null, error: false });
  const [nonce, setNonce] = useState(0);

  // Everything that can change the price, in one stable string.
  const signature = useMemo(
    () =>
      JSON.stringify([
        lines.map((l) => [l.itemId, l.quantity, [...l.addOnOptionIds].sort()]),
        couponCode ?? null,
      ]),
    [lines, couponCode],
  );

  const isEmpty = restaurantId === null || lines.length === 0;

  useEffect(() => {
    if (isEmpty) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/cart/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            lines: lines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              addOnOptionIds: l.addOnOptionIds,
            })),
            ...(couponCode ? { couponCode } : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Pricing failed: ${response.status}`);
        const data = (await response.json()) as CartPricingResponse;
        setResult({ key: signature, data, error: false });
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult((prev) => ({ key: signature, data: prev.data, error: true }));
      }
    })();

    return () => controller.abort();
  }, [isEmpty, restaurantId, signature, nonce, lines, couponCode]);

  const status: QuoteStatus = isEmpty
    ? "empty"
    : result.error
      ? "error"
      : result.data !== null && result.key === signature
        ? "ready"
        : "loading";

  return {
    status,
    data: isEmpty ? null : result.data,
    reload: () => setNonce((n) => n + 1),
  };
}
