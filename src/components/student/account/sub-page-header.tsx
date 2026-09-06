import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * The header every account sub-screen shares.
 *
 * A real back link rather than `router.back()`: these pages are reachable from
 * a push notification and from a shared URL, and history may hold nothing to
 * go back to. `/account` is always the right parent.
 */
export function SubPageHeader({
  title,
  backHref = "/account",
}: {
  title: string;
  backHref?: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-1 border-b border-line bg-ink/95 px-2 pr-4 backdrop-blur-lg pt-safe">
      <Link
        href={backHref}
        aria-label="Back to account"
        className="flex size-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-raised hover:text-bone"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <h1 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-bone">
        {title}
      </h1>
      <ThemeToggle />
    </header>
  );
}
