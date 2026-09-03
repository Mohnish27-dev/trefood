import { Skeleton } from "@/components/ui/skeleton";

/** Covers every admin console screen. */
export default function AdminLoading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
