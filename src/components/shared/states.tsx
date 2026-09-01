import { AlertTriangle, RefreshCw, WifiOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Empty and error states.
 *
 * PRD Part 6: "Loading, empty, and error states exist. A spinner alone is not
 * an error state." Both of these say what happened, why, and what the person
 * can do next — never just "Something went wrong".
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center px-6 py-14", className)}>
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-raised border border-line">
        <Icon className="size-6 text-faint" />
      </span>
      <h3 className="font-display text-base font-semibold text-bone">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted leading-relaxed">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "That did not load",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center text-center px-6 py-14", className)}
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-chili-wash border border-chili/30">
        <AlertTriangle className="size-6 text-chili" />
      </span>
      <h3 className="font-display text-base font-semibold text-bone">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted leading-relaxed">{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The vendor's connection-lost banner. ARCH section 5.
 *
 * Shown after TWO consecutive failed polls, not one — a single dropped request
 * on hostel wifi is normal and a banner that cries wolf gets ignored. A vendor
 * who does not know they are offline is a vendor about to lose four orders.
 */
export function ConnectionBanner({ visible, lastSyncedAt }: { visible: boolean; lastSyncedAt: Date | null }) {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 bg-chili-wash border-b border-chili/40 px-4 py-2.5 text-sm"
    >
      <WifiOff className="size-4 shrink-0 text-chili" />
      <div className="min-w-0">
        <p className="font-medium text-chili">Connection lost</p>
        <p className="text-xs text-muted">
          New orders may not be appearing.
          {lastSyncedAt
            ? ` Last updated at ${lastSyncedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.`
            : ""}
        </p>
      </div>
    </div>
  );
}
