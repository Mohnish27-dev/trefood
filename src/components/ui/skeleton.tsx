import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Loading state. Per PRD Part 6 every route needs one of these, an empty state
 * and an error state — "a spinner alone is not an error state".
 *
 * Skeletons mirror the shape of what is coming, so the layout does not jump
 * when real data lands.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("skeleton", className)} {...props} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div className="flex gap-3">
        <Skeleton className="size-16 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
