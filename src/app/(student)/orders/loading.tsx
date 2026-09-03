import { Skeleton, SkeletonList } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="space-y-4 px-4 py-4">
      <Skeleton className="h-6 w-28" />
      <SkeletonList count={4} />
    </div>
  );
}
