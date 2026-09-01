"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/hooks/use-cart";

/**
 * The floating "view cart" bar.
 *
 * Sits above the bottom nav, so a student can keep adding without losing sight
 * of what they have. Renders nothing when the cart is empty rather than showing
 * a disabled shell — an empty bar is just a thing in the way.
 */
export function CartBar() {
  const { itemCount, restaurantSlug } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-30 px-4">
      <Link
        href="/cart"
        className="mx-auto flex min-h-14 max-w-lg items-center justify-between gap-3 rounded-2xl bg-saffron px-5 text-ink shadow-[0_8px_32px_-8px] shadow-saffron/60 transition-transform active:scale-[0.98]"
      >
        <span className="flex items-center gap-2.5">
          <ShoppingBag className="size-5" />
          <span className="text-sm font-semibold">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </span>
        <span className="text-sm font-bold">View cart →</span>
        <span className="sr-only">{restaurantSlug ?? ""}</span>
      </Link>
    </div>
  );
}
