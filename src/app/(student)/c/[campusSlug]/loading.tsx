import { Skeleton, SkeletonList } from "@/components/ui/skeleton";

/**
 * Without this file the campus feed is a dynamic route with no loading
 * boundary, so Next.js skips prefetching it entirely and the tap on
 * "Browse" sits on a dead screen until Mongo answers. With it, the shell
 * is prefetched and the transition starts immediately.
 */
export default function CampusFeedLoading() {
  return (
    <>
      {/* Zone picker bar */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="size-11 rounded-xl" />
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Search + hero banner */}
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />

        {/* Category rail */}
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[122px] w-[98px] shrink-0 rounded-2xl" />
          ))}
        </div>

        <Skeleton className="h-4 w-28" />
        <SkeletonList count={3} />
      </div>
    </>
  );
}
