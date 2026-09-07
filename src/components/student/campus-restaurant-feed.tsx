"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Store, UtensilsCrossed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { RestaurantCard } from "@/components/student/restaurant-card";
import {
  CampusHeroBanner,
  CAMPUS_CATEGORY_BOXES,
} from "@/components/student/campus-hero-banner";
import { FoodTypeFilterBar } from "@/components/student/food-type-filter";
import {
  FOOD_TYPE_OPTIONS,
  matchesFoodType,
  getFoodTypeCounts,
  type FoodTypeFilter,
} from "@/lib/restaurant-filter";
import {
  EMPTY_SEARCH_INDEX,
  matchesQuery,
  restaurantIdsMatchingDish,
  type CampusSearchIndex,
  type Suggestion,
} from "@/lib/dish-search";
import { compareRestaurantsForDisplay } from "@/lib/restaurant-order";
import type { RestaurantListItem } from "@/server/services/catalog";

/** A dish the student tapped in the suggestions, pinning the feed to it. */
interface DishFilter {
  name: string;
  restaurantIds: Set<string>;
}

interface CampusRestaurantFeedProps {
  campusSlug: string;
  transitMinutes: number;
  restaurants: RestaurantListItem[];
  /** Restaurant ids this student starred. Empty when signed out. */
  favouriteIds?: string[];
  signedIn?: boolean;
}

export function CampusRestaurantFeed({
  campusSlug,
  transitMinutes,
  restaurants,
  favouriteIds = [],
  signedIn = false,
}: CampusRestaurantFeedProps) {
  // A Set, because this is checked once per card on every keystroke of the
  // search box.
  const favourites = useMemo(() => new Set(favouriteIds), [favouriteIds]);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [foodTypeFilter, setFoodTypeFilter] = useState<FoodTypeFilter>("all");
  const [dishFilter, setDishFilter] = useState<DishFilter | null>(null);
  const [searchIndex, setSearchIndex] = useState<CampusSearchIndex>(EMPTY_SEARCH_INDEX);
  const [indexLoading, setIndexLoading] = useState(false);
  const fetchedFor = useRef<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const orderedRestaurants = useMemo(
    () => [...restaurants].sort(compareRestaurantsForDisplay),
    [restaurants],
  );

  /**
   * The set of kitchens this student can currently order from. Switching gates
   * re-renders this component with a different list, and the dish index must
   * follow — suggesting a dish that no longer reaches your gate is the exact
   * mistake zone-scoping exists to prevent.
   */
  const zoneSignature = useMemo(
    () => orderedRestaurants.map((r) => r._id).join(","),
    [orderedRestaurants],
  );

  /**
   * The dish index is fetched once per gate and then filtered in the browser,
   * so typing never touches the network. It is deliberately NOT part of the
   * page payload: it is only useful to someone who opens the search box, and
   * the feed itself must paint before it arrives.
   */
  const loadSearchIndex = useCallback(() => {
    if (fetchedFor.current === zoneSignature) return;
    fetchedFor.current = zoneSignature;
    setIndexLoading(true);

    fetch(`/api/search/suggest?campus=${encodeURIComponent(campusSlug)}`)
      .then((res) => (res.ok ? (res.json() as Promise<CampusSearchIndex>) : null))
      .then((data) => {
        // Ignore a reply that the student has already navigated past.
        if (data && fetchedFor.current === zoneSignature) setSearchIndex(data);
      })
      .catch(() => {
        // A failed index degrades to name-and-cuisine search, which is what
        // the feed did before suggestions existed. Nothing to report.
        if (fetchedFor.current === zoneSignature) fetchedFor.current = null;
      })
      .finally(() => setIndexLoading(false));
  }, [campusSlug, zoneSignature]);

  // Warm it up once the page is idle, so the first keystroke already has data.
  useEffect(() => {
    const idle = window.requestIdleCallback;
    if (typeof idle === "function") {
      const handle = idle(() => loadSearchIndex(), { timeout: 2500 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(loadSearchIndex, 1200);
    return () => window.clearTimeout(timer);
  }, [loadSearchIndex]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    // Typing again abandons the pinned dish: the student is asking a new
    // question, and silently keeping the old restaurant set would be a lie.
    setDishFilter(null);
  };

  /**
   * A tapped suggestion resolves to a place, not to text.
   *
   * One kitchen sells it  → go straight to that menu, with the dish pre-searched.
   * Several sell it       → stay here and show exactly those restaurants.
   */
  const handleSelectSuggestion = (suggestion: Suggestion) => {
    if (suggestion.kind === "restaurant") {
      setSearchQuery("");
      setDishFilter(null);
      router.push(`/c/${campusSlug}/r/${suggestion.slug}`);
      return;
    }

    if (suggestion.kind === "cuisine") {
      setDishFilter(null);
      setSearchQuery(suggestion.name);
      setSelectedCategory(null);
      scrollToResults();
      return;
    }

    if (suggestion.restaurantIds.length === 1) {
      const only = orderedRestaurants.find((r) => r._id === suggestion.restaurantIds[0]);
      if (only) {
        setSearchQuery("");
        setDishFilter(null);
        router.push(
          `/c/${campusSlug}/r/${only.slug}?dish=${encodeURIComponent(suggestion.name)}`,
        );
        return;
      }
    }

    setSearchQuery(suggestion.name);
    setSelectedCategory(null);
    setFoodTypeFilter("all");
    setDishFilter({
      name: suggestion.name,
      restaurantIds: new Set(suggestion.restaurantIds),
    });
    scrollToResults();
  };

  const scrollToResults = () => {
    // After the state that reorders the list has been committed.
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const foodTypeCounts = useMemo(() => getFoodTypeCounts(orderedRestaurants), [orderedRestaurants]);

  /**
   * Restaurants whose MENU matches the raw query, even though their name and
   * cuisines do not. Without this, typing "biryani" hides the kitchen whose
   * biryani you were looking for simply because it is called "Sone Zone".
   */
  const dishMatchIds = useMemo(
    () => restaurantIdsMatchingDish(searchIndex, searchQuery),
    [searchIndex, searchQuery],
  );

  // Filter restaurants based on search query and selected category box
  const filteredRestaurants = useMemo(() => {
    return orderedRestaurants.filter((r) => {
      // 0. A tapped dish pins the feed to the kitchens that actually cook it.
      if (dishFilter) {
        if (!dishFilter.restaurantIds.has(r._id)) return false;
      } else if (searchQuery.trim()) {
        // 1. Free-text search across the name, the cuisines, the blurb AND
        //    every dish on the menu.
        const query = searchQuery;
        const hit =
          matchesQuery(r.name, query) ||
          r.cuisines.some((c) => matchesQuery(c, query)) ||
          matchesQuery(r.description, query) ||
          dishMatchIds.has(r._id);
        if (!hit) return false;
      }

      // 2. Food type filter (all, food, fruits, juice_shakes)
      if (foodTypeFilter !== "all" && !matchesFoodType(r, foodTypeFilter)) {
        return false;
      }

      // 3. Category box filter
      if (selectedCategory) {
        switch (selectedCategory) {
          case "senior":
            // Senior Recommends: 4.2+ rating or top campus legends
            return r.rating !== null && r.rating >= 4.2;
          case "budget":
            // Dishes under ₹99 / Budget: min order under ₹50 or snacks/chai/fast-food
            return (
              r.minOrderPaise <= 5000 ||
              r.cuisines.some((c) =>
                ["Chai", "Fast Food", "Snacks", "Beverages"].includes(c),
              )
            );
          case "fast":
            // Food in 15 mins: 15 min or less prep time
            return r.prepMinutes <= 15;
          case "latenight":
            // Late night: currently serving restaurants
            return r.isServingNow;
          case "biryani_rolls":
            // Biryani & Rolls
            return (
              r.cuisines.some((c) =>
                ["Biryani", "Rolls", "Fast Food", "North Indian"].includes(c),
              ) || /wrapchik|zaika|kolkata/i.test(r.name)
            );
          case "chai_maggi":
            // Chai & Maggi
            return (
              r.cuisines.some((c) => ["Chai", "Beverages", "Snacks", "Cafe"].includes(c)) ||
              /chai|csb|sutta/i.test(r.name)
            );
          default:
            return true;
        }
      }

      return true;
    });
  }, [orderedRestaurants, searchQuery, selectedCategory, foodTypeFilter, dishFilter, dishMatchIds]);

  const openRestaurants = useMemo(
    () => filteredRestaurants.filter((r) => r.isServingNow),
    [filteredRestaurants],
  );

  const closedRestaurants = useMemo(
    () => filteredRestaurants.filter((r) => !r.isServingNow),
    [filteredRestaurants],
  );

  const activeCategoryObj = useMemo(
    () => CAMPUS_CATEGORY_BOXES.find((b) => b.id === selectedCategory),
    [selectedCategory],
  );

  const activeFoodTypeObj = useMemo(
    () => (foodTypeFilter !== "all" ? FOOD_TYPE_OPTIONS.find((b) => b.id === foodTypeFilter) : null),
    [foodTypeFilter],
  );

  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedCategory || foodTypeFilter !== "all" || dishFilter,
  );

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setFoodTypeFilter("all");
    setDishFilter(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Campus Search Bar & 6-Box Hero Carousel ─────────────────── */}
      <CampusHeroBanner
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchIndex={searchIndex}
        onSelectSuggestion={handleSelectSuggestion}
        onSearchWake={loadSearchIndex}
        searchIndexLoading={indexLoading}
      />

      {/* ── PWA Mobile Sticky Food Type Filters (All, Food, Fruits, Juices) ── */}
      <FoodTypeFilterBar
        selected={foodTypeFilter}
        onChange={setFoodTypeFilter}
        counts={foodTypeCounts}
      />

      {/* ── Filter Feedback & Status Row ────────────────────────────── */}
      <div ref={resultsRef} className="scroll-mt-3 pt-2">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg font-semibold text-bone">
              {dishFilter
                ? `${filteredRestaurants.length} place${
                    filteredRestaurants.length === 1 ? "" : "s"
                  } serve ${dishFilter.name}`
                : `${openRestaurants.length} open now`}
            </h1>
            {hasActiveFilters && !dishFilter ? (
              <span className="text-xs text-muted">
                ({filteredRestaurants.length} matched)
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted">{transitMinutes} min to your gate</p>
        </div>

        {/* Active Filter Chips with Quick Clear */}
        {hasActiveFilters ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {activeFoodTypeObj ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/15 text-saffron px-3 py-1 text-xs font-semibold border border-saffron/30">
                <span>{activeFoodTypeObj.emoji}</span>
                <span>{activeFoodTypeObj.label}</span>
                <button
                  type="button"
                  onClick={() => setFoodTypeFilter("all")}
                  className="hover:opacity-75 ml-0.5 cursor-pointer"
                  aria-label="Remove food type filter"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}

            {activeCategoryObj ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/15 text-saffron px-3 py-1 text-xs font-semibold border border-saffron/30">
                <span>{activeCategoryObj.badgeEmoji}</span>
                <span>{activeCategoryObj.title}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="hover:opacity-75 ml-0.5"
                  aria-label="Remove category filter"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}

            {dishFilter ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/15 text-saffron px-3 py-1 text-xs font-semibold border border-saffron/30">
                <span>🍽️</span>
                <span>{dishFilter.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDishFilter(null);
                    setSearchQuery("");
                  }}
                  className="hover:opacity-75 ml-0.5"
                  aria-label={`Stop showing only restaurants serving ${dishFilter.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : searchQuery.trim() ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised text-bone px-3 py-1 text-xs font-semibold border border-line">
                <span>&ldquo;{searchQuery.trim()}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="hover:opacity-75 ml-0.5 text-muted hover:text-bone"
                  aria-label="Remove search filter"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-saffron hover:underline"
            >
              Reset all
            </button>
          </div>
        ) : null}

        {/* ── Open Restaurants ────────────────────────────────────────── */}
        {openRestaurants.length > 0 ? (
          <div className="space-y-4">
            {openRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant._id}
                restaurant={restaurant}
                campusSlug={campusSlug}
                favourited={favourites.has(restaurant._id)}
                signedIn={signedIn}
              />
            ))}
          </div>
        ) : hasActiveFilters ? (
          <EmptyState
            icon={Store}
            title="No matching restaurants"
            description="Try changing your search keywords or tap reset to browse all campus kitchens."
            action={
              <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                View all restaurants
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={UtensilsCrossed}
            title="Everything is closed right now"
            description="Campus kitchens shut for a few hours overnight. The ones below open again later today."
          />
        )}

        {/* ── Closed Restaurants (Rendered, greyed at bottom) ──────────── */}
        {closedRestaurants.length > 0 ? (
          <div className="mt-8">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted">
              Closed right now · Opening later ({closedRestaurants.length})
            </h2>
            <div className="space-y-4">
              {closedRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant._id}
                  restaurant={restaurant}
                  campusSlug={campusSlug}
                  favourited={favourites.has(restaurant._id)}
                  signedIn={signedIn}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
