import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** What is not here. "No orders yet", not "Empty". */
  title: string;
  /** What the person can do about it. Optional, but usually the useful half. */
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Built in Phase 1, before any screen needs it, so that no later phase can decide to
 * "add empty states later". Every list in TREFOOD has an empty case, and a blank
 * rectangle reads as a bug to the person looking at it.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground [&_svg]:size-8">{icon}</div> : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground max-w-xs text-sm text-balance">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
