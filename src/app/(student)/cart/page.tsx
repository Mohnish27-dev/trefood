import type { Metadata } from "next";

import { CartView } from "@/components/student/cart-view";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-14 items-center border-b border-line bg-ink/95 px-4 backdrop-blur-lg pt-safe">
        <h1 className="font-display text-base font-semibold text-bone">Your cart</h1>
      </header>
      <CartView />
    </>
  );
}
