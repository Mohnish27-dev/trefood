import { Skeleton } from "@/components/ui/skeleton";

export default function SignInLoading() {
  return (
    <main className="min-h-dvh bg-tf-maroon-deep" aria-busy="true">
      <div className="light auth-theme mx-auto flex min-h-dvh w-full max-w-md flex-col bg-tf-cream">
        <span className="sr-only">Loading sign in</span>
        {/* Same box as the hero artwork, so nothing jumps when it lands. */}
        <div className="aspect-[1376/1602] w-full bg-tf-maroon-deep" />
        <div className="px-7 pt-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-72" />
          <Skeleton className="mt-5 h-13 rounded-xl" />
          <Skeleton className="mt-3 h-13 rounded-xl" />
          <Skeleton className="mt-4 h-13 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
