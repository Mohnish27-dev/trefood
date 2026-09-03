import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <div className="space-y-4 px-4 py-4" aria-busy="true">
      <span className="sr-only">Loading account</span>
      <div className="flex items-center gap-3">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}
