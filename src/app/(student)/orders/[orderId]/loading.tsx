import { Skeleton } from "@/components/ui/skeleton";

export default function OrderTrackerLoading() {
  return (
    <div className="space-y-4 px-4 py-4" aria-busy="true">
      <span className="sr-only">Loading order</span>
      {/* The gate code block keeps its size so the digits do not shift in. */}
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-14 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}
