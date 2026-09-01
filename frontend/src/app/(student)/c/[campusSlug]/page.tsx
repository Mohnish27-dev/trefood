"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { IRestaurant } from "@trefood/shared";

import { EmptyState, ErrorState, RestaurantListSkeleton } from "@/components/shared";
import { RestaurantCard } from "@/components/student/restaurant-card";
import { Input } from "@/components/ui/input";
import { useDelivery } from "@/hooks/use-delivery-context";
import { listRestaurants } from "@/lib/fixture-data";

/**
 * The restaurant list, filtered by the chosen delivery point.
 *
 * The zone filter is not a refinement bolted onto a list — it decides what the list
 * IS. Vendors declare which gates they will send a rider to, so choosing Kaveri Girls
 * Hostel genuinely removes restaurants that cannot reach it. Showing them and failing
 * at checkout would be worse than showing fewer.
 */
export default function RestaurantListPage({
  params,
}: {
  params: Promise<{ campusSlug: string }>;
}) {
  const { campusSlug } = use(params);
  const { zoneId, setCampus, isHydrated } = useDelivery();

  /**
   * Results are stored WITH the request they answer.
   *
   * Loading is then derived — `result.key !== key` — instead of being announced by a
   * synchronous `setState(null)` in the effect. That both satisfies the compiler and
   * fixes a real race: when the zone changes, the old list is visibly stale rather
   * than briefly presented as current.
   */
  const [result, setResult] = useState<{ key: string; data: IRestaurant[] } | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [query, setQuery] = useState("");

  const requestKey = `${campusSlug}|${zoneId ?? ""}`;
  const restaurants = result?.key === requestKey ? result.data : null;

  // Arriving by a shared link should remember the campus, not bounce to the picker.
  useEffect(() => {
    if (isHydrated) setCampus(campusSlug);
  }, [isHydrated, campusSlug, setCampus]);

  useEffect(() => {
    if (!isHydrated) return;
    let active = true;
    listRestaurants(campusSlug, zoneId ?? undefined)
      .then((data) => active && setResult({ key: requestKey, data }))
      .catch(() => active && setHasFailed(true));
    return () => {
      active = false;
    };
  }, [campusSlug, zoneId, isHydrated, requestKey]);

  const visible = useMemo(() => {
    if (restaurants === null) return null;
    const needle = query.trim().toLowerCase();
    if (needle === "") return restaurants;
    return restaurants.filter(
      (restaurant) =>
        restaurant.name.toLowerCase().includes(needle) ||
        restaurant.cuisine.some((cuisine) => cuisine.toLowerCase().includes(needle)),
    );
  }, [restaurants, query]);

  return (
    <main className="space-y-4 px-4 py-4">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search restaurants or cuisines"
          aria-label="Search restaurants"
          className="touch-target ps-9"
        />
      </div>

      {hasFailed ? (
        <ErrorState
          title="We could not load restaurants"
          onRetry={() => window.location.reload()}
        />
      ) : visible === null ? (
        <RestaurantListSkeleton />
      ) : visible.length === 0 ? (
        query.trim() !== "" ? (
          <EmptyState
            title={`Nothing matches “${query}”`}
            description="Try a different name, or clear the search."
          />
        ) : (
          /**
           * The empty case that actually happens: a zone with a tight curfew or a
           * quiet corner of campus may have no vendor willing to serve it. Naming the
           * zone — and pointing at the header — is the difference between a dead end
           * and a fix the student can make in one tap.
           */
          <EmptyState
            title="No restaurants serve this gate"
            description="No vendor delivers to your chosen point right now. Tap “Deliver to” above to pick another gate."
          />
        )
      ) : (
        <ul className="space-y-2">
          {visible.map((restaurant) => (
            <li key={restaurant._id}>
              <RestaurantCard restaurant={restaurant} campusSlug={campusSlug} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
