import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

/**
 * The offline fallback the service worker serves for a failed navigation.
 *
 * It says the one thing a student actually needs to hear — a placed order is
 * safe — because the alternative reading of a dead app is "my payment went
 * nowhere", and that ends in a second order.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface">
        <WifiOff className="size-7 text-faint" />
      </span>

      <h1 className="mt-5 font-display text-2xl font-semibold text-bone">You are offline</h1>

      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
        Any order you have already placed is safe and still on its way. Reconnect to see where
        it has got to.
      </p>

      <Button asChild className="mt-6" variant="secondary">
        <Link href="/orders">Try again</Link>
      </Button>

      <p className="mt-8 text-xs leading-relaxed text-faint">
        Menus work offline once you have browsed them. Placing an order needs a connection,
        because the payment does.
      </p>
    </main>
  );
}
