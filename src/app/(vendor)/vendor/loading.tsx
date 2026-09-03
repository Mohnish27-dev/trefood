import { Skeleton } from "@/components/ui/skeleton";

/**
 * Covers every vendor screen. The board is polled on a tablet that never
 * sleeps, so a tab change must not look like the app crashed.
 */
export default function VendorLoading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
