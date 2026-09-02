"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BottomNav } from "./bottom-nav";
import { InstallPrompt } from "@/components/shared/pwa";
import { QuickUnlockPrompt } from "./quick-unlock-prompt";
import { useCart } from "@/hooks/use-cart";

interface StudentShellProps {
  children: ReactNode;
  user?: {
    _id: string;
    name: string;
    email: string;
    quickUnlock?: {
      pinHash?: string | null;
    } | null;
  } | null;
}

/**
 * Derives the active campus from the URL, falling back to whatever the cart
 * remembers, so the Browse tab still knows where to go from /orders or
 * /account where the campus is not in the path.
 */
export function StudentShell({ children, user }: StudentShellProps) {
  const pathname = usePathname();
  const { campusSlug: cartCampus } = useCart();

  const fromPath = /^\/c\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const campusSlug = fromPath ?? cartCampus;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <div className="flex-1 pb-24">{children}</div>
      {/* Quick Unlock Onboarding Prompt */}
      <QuickUnlockPrompt user={user} />
      {/* Deferred until after a delivered order, when intent peaks. */}
      <InstallPrompt />
      <BottomNav campusSlug={campusSlug} />
    </div>
  );
}
