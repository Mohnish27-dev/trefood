import { Skeleton } from "@/components/ui/skeleton";

export default function CartLoading() {
  return (
    <div className="space-y-4 px-4 py-4" aria-busy="true">
      <span className="sr-only">Loading cart</span>
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-16 rounded-2xl" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-14 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}
