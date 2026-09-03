import { Skeleton } from "@/components/ui/skeleton";

export default function RestaurantLoading() {
  return (
    <div className="space-y-4 px-4 py-4" aria-busy="true">
      <span className="sr-only">Loading menu</span>

      {/* Hero card */}
      <Skeleton className="h-40 rounded-2xl" />

      {/* In-menu search */}
      <Skeleton className="h-11 rounded-xl" />

      {/* Menu sections */}
      {Array.from({ length: 2 }, (_, section) => (
        <div key={section} className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }, (_, row) => (
            <div key={row} className="flex items-start gap-3 border-b border-line pb-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <Skeleton className="size-20 shrink-0 rounded-xl" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
