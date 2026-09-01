"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BottomNav } from "./bottom-nav";
import { useCart } from "@/hooks/use-cart";

/**
 * Derives the active campus from the URL, falling back to whatever the cart
 * remembers, so the Browse tab still knows where to go from /orders or
 * /account where the campus is not in the path.
 */
export function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { campusSlug: cartCampus } = useCart();

  const fromPath = /^\/c\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const campusSlug = fromPath ?? cartCampus;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <div className="flex-1 pb-24">{children}</div>
      <BottomNav campusSlug={campusSlug} />
    </div>
  );
}
