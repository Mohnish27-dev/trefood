"use client";

import { useMemo, useState } from "react";
import { Store, UtensilsCrossed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { RestaurantCard } from "@/components/student/restaurant-card";
import {
  CampusHeroBanner,
  CAMPUS_CATEGORY_BOXES,
} from "@/components/student/campus-hero-banner";
import type { RestaurantListItem } from "@/server/services/catalog";

interface CampusRestaurantFeedProps {
  campusSlug: string;
  transitMinutes: number;
  restaurants: RestaurantListItem[];
}

export function CampusRestaurantFeed({
  campusSlug,
  transitMinutes,
  restaurants,
}: CampusRestaurantFeedProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter restaurants based on search query and selected category box
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = r.name.toLowerCase().includes(query);
        const matchesCuisines = r.cuisines.some((c) => c.toLowerCase().includes(query));
        const matchesDesc = r.description.toLowerCase().includes(query);
        if (!matchesName && !matchesCuisines && !matchesDesc) {
          return false;
        }
      }

      // 2. Category box filter
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
  }, [restaurants, searchQuery, selectedCategory]);

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

  const hasActiveFilters = Boolean(searchQuery.trim() || selectedCategory);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Campus Search Bar & 6-Box Hero Carousel ─────────────────── */}
      <CampusHeroBanner
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* ── Filter Feedback & Status Row ────────────────────────────── */}
      <div className="pt-2">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg font-semibold text-bone">
              {openRestaurants.length} open now
            </h1>
            {hasActiveFilters ? (
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

            {searchQuery.trim() ? (
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
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
