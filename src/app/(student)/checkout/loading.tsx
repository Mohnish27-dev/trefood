import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <div className="space-y-4 px-4 py-4" aria-busy="true">
      <span className="sr-only">Loading checkout</span>
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-14 rounded-2xl" />
    </div>
  );
}
