import { Skeleton } from "@/components/ui/skeleton";

export default function SignInLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-10" aria-busy="true">
      <span className="sr-only">Loading sign in</span>
      <Skeleton className="h-11 w-24 rounded-xl" />
      <Skeleton className="mt-6 h-12 w-40 rounded-xl" />
      <Skeleton className="mt-4 h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-full max-w-sm" />
      <Skeleton className="mt-6 h-14 rounded-2xl" />
      <Skeleton className="mt-6 h-14 rounded-2xl" />
      <Skeleton className="mt-6 h-11 rounded-xl" />
      <Skeleton className="mt-4 h-40 rounded-2xl" />
    </main>
  );
}
