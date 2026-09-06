import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches the real screen's shape: hero card, then the grouped lists. A
 * skeleton whose blocks land where the content lands is the difference between
 * a page that appears and a page that jumps.
 */
export default function AccountLoading() {
  return (
    <div className="space-y-5 px-4 py-4" aria-busy="true">
      <span className="sr-only">Loading account</span>

      {/* Profile hero */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3.5">
          <Skeleton className="size-16 rounded-2xl" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="mt-4 h-16 rounded-xl" />
      </div>

      {/* Grouped lists: 4 rows, then 3, then 2. */}
      {[4, 3, 2].map((rows, group) => (
        <div key={group} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="rounded-2xl" style={{ height: `${rows * 3.5}rem` }} />
        </div>
      ))}
    </div>
  );
}
