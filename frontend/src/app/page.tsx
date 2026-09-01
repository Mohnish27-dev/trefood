"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ICampus } from "@trefood/shared";

import { EmptyState, ErrorState, Skeleton } from "@/components/shared";
import { useDelivery } from "@/hooks/use-delivery-context";
import { listCampuses } from "@/lib/fixture-data";

/**
 * The landing screen: pick a campus.
 *
 * No login. Browsing is fully anonymous, and auth is required only at checkout — a
 * student comparing prices at 1 AM should never meet a sign-in wall first.
 *
 * A returning student never sees this: their campus is remembered and they are sent
 * straight to the restaurant list.
 */
export default function CampusPickerPage() {
  const router = useRouter();
  const { campusSlug, setCampus, isHydrated } = useDelivery();
  const [campuses, setCampuses] = useState<ICampus[] | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  // Remembered choice wins — skip this screen entirely on a return visit.
  useEffect(() => {
    if (isHydrated && campusSlug !== null) router.replace(`/c/${campusSlug}`);
  }, [isHydrated, campusSlug, router]);

  useEffect(() => {
    let active = true;
    listCampuses()
      .then((result) => active && setCampuses(result))
      .catch(() => active && setHasFailed(true));
    return () => {
      active = false;
    };
  }, []);

  function choose(campus: ICampus) {
    setCampus(campus.slug);
    router.push(`/c/${campus.slug}`);
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">TREFOOD</h1>
        <p className="text-muted-foreground text-sm">
          Food from your campus canteens, handed over at the gate.
        </p>
      </div>

      <h2 className="mb-3 text-sm font-medium">Choose your campus</h2>

      {hasFailed ? (
        <ErrorState
          title="We could not load campuses"
          onRetry={() => window.location.reload()}
        />
      ) : campuses === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading campuses">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : campuses.length === 0 ? (
        <EmptyState
          title="No campuses yet"
          description="TREFOOD is not live at any campus right now. Check back soon."
        />
      ) : (
        <ul className="space-y-2">
          {campuses.map((campus) => (
            <li key={campus._id}>
              <button
                type="button"
                onClick={() => choose(campus)}
                className="touch-target hover:border-brand hover:bg-brand/5 w-full rounded-lg border p-4 text-left transition-colors"
              >
                <span className="block font-medium">{campus.name}</span>
                <span className="text-muted-foreground block text-sm">
                  {campus.city} · {campus.zones.length} delivery points
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
