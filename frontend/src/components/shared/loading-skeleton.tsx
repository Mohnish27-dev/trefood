import { cn } from "@/lib/utils";

/**
 * A skeleton block. Prefer this to a spinner wherever the shape of the incoming
 * content is known — a restaurant list, a menu, an order card — because it tells the
 * eye where to wait rather than just that waiting is happening.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-muted animate-pulse rounded-md", className)} />;
}

/** The restaurant list's loading shape. */
export function RestaurantListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading restaurants">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex gap-3 rounded-lg border p-3">
          <Skeleton className="size-16 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The order tracker's loading shape. */
export function OrderTrackerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading order">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
