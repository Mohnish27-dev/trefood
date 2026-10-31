"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/hooks/use-cart";

/**
 * The floating "view cart" bar in Royal Maroon with Golden accents.
 */
export function CartBar() {
  const { itemCount, restaurantSlug } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-30 px-4">
      <Link
        href="/cart"
        className="mx-auto flex min-h-14 max-w-lg items-center justify-between gap-3 rounded-2xl bg-tf-maroon px-5 text-white shadow-[0_8px_32px_-8px_rgba(131,0,32,0.6)] border border-white/10 transition-transform active:scale-[0.98] cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-white/15 text-tf-yellow">
            <ShoppingBag className="size-4.5 stroke-[2.5]" />
          </div>
          <span className="text-sm font-bold">
            {itemCount} item{itemCount === 1 ? "" : "s"} added
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tf-yellow px-3.5 py-1 text-xs font-black text-slate-950 shadow-xs">
          View cart →
        </span>
        <span className="sr-only">{restaurantSlug ?? ""}</span>
      </Link>
    </div>
  );
}
