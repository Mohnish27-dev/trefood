"use client";

import { useMemo, useState } from "react";
import { Search, X, UtensilsCrossed } from "lucide-react";

import { MenuItemRow } from "@/components/student/menu-item-row";
import { VegMark } from "@/components/shared/veg-mark";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MenuSection } from "@/server/services/catalog";

type DietaryFilter = "all" | "veg" | "non-veg";

interface RestaurantMenuSearchProps {
  sections: MenuSection[];
  restaurantId: string;
  restaurantSlug: string;
  campusSlug: string;
  restaurantIsOpen: boolean;
}

export function RestaurantMenuSearch({
  sections,
  restaurantId,
  restaurantSlug,
  campusSlug,
  restaurantIsOpen,
}: RestaurantMenuSearchProps) {
  const [query, setQuery] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>("all");

  const trimmedQuery = query.trim().toLowerCase();

  const toggleVeg = () => {
    setDietaryFilter((prev) => (prev === "veg" ? "all" : "veg"));
  };

  const toggleNonVeg = () => {
    setDietaryFilter((prev) => (prev === "non-veg" ? "all" : "non-veg"));
  };

  const resetAllFilters = () => {
    setQuery("");
    setDietaryFilter("all");
  };

  const filteredSections = useMemo(() => {
    return sections
      .map((section) => {
        const catMatch = trimmedQuery
          ? section.category.name.toLowerCase().includes(trimmedQuery)
          : false;

        const matchingItems = section.items.filter((item) => {
          // Dietary Filter
          if (dietaryFilter === "veg" && !item.isVeg) return false;
          if (dietaryFilter === "non-veg" && item.isVeg) return false;

          // Text Search Filter
          if (!trimmedQuery) return true;
          if (catMatch) return true;
          const nameMatch = item.name.toLowerCase().includes(trimmedQuery);
          const descMatch = item.description?.toLowerCase().includes(trimmedQuery);
          return nameMatch || descMatch;
        });

        return {
          ...section,
          items: matchingItems,
        };
      })
      .filter((section) => section.items.length > 0);
  }, [sections, trimmedQuery, dietaryFilter]);

  const totalMatches = useMemo(() => {
    return filteredSections.reduce((sum, sec) => sum + sec.items.length, 0);
  }, [filteredSections]);

  const hasActiveFilter = trimmedQuery.length > 0 || dietaryFilter !== "all";

  return (
    <div className="px-4">
      {/* ── Swiggy-Style In-Restaurant Search Bar ───────────────── */}
      <div className="mt-4 mb-2.5">
        <div className="relative flex h-12 items-center rounded-2xl border border-line bg-surface-raised px-3.5 shadow-2xs transition-all focus-within:border-line-strong">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for dishes"
            className="restaurant-menu-search-input min-w-0 flex-1 bg-transparent text-sm font-medium text-bone placeholder:text-muted outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
            aria-label="Search dishes"
          />

          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mr-2 flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-bone transition-colors"
              aria-label="Clear search text"
            >
              <X className="size-4" />
            </button>
          ) : null}

          <Search className="size-4 text-muted shrink-0" />
        </div>
      </div>

      {/* ── Swiggy-Style Veg & Non-Veg Toggle Filter Row ────────── */}
      <div className="mb-3.5 flex items-center gap-2.5">
        {/* Veg Toggle Button */}
        <button
          type="button"
          role="switch"
          aria-checked={dietaryFilter === "veg"}
          onClick={toggleVeg}
          className={cn(
            "group flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all select-none shadow-2xs",
            dietaryFilter === "veg"
              ? "border-mint bg-mint/10 text-mint font-semibold shadow-mint/10"
              : "border-line bg-surface-raised text-muted hover:border-line-strong hover:text-bone",
          )}
        >
          <VegMark isVeg={true} className="scale-90" />
          <span className="text-[12px]">Veg</span>
          {/* Mini pill switch track */}
          <span
            className={cn(
              "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out",
              dietaryFilter === "veg" ? "bg-mint/40" : "bg-line",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                dietaryFilter === "veg"
                  ? "translate-x-3.5 bg-mint"
                  : "translate-x-0.5 bg-muted-foreground/80 dark:bg-muted-foreground",
              )}
            />
          </span>
        </button>

        {/* Non-Veg Toggle Button */}
        <button
          type="button"
          role="switch"
          aria-checked={dietaryFilter === "non-veg"}
          onClick={toggleNonVeg}
          className={cn(
            "group flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all select-none shadow-2xs",
            dietaryFilter === "non-veg"
              ? "border-chili bg-chili/10 text-chili font-semibold shadow-chili/10"
              : "border-line bg-surface-raised text-muted hover:border-line-strong hover:text-bone",
          )}
        >
          <VegMark isVeg={false} className="scale-90" />
          <span className="text-[12px]">Non-Veg</span>
          {/* Mini pill switch track */}
          <span
            className={cn(
              "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out",
              dietaryFilter === "non-veg" ? "bg-chili/40" : "bg-line",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                dietaryFilter === "non-veg"
                  ? "translate-x-3.5 bg-chili"
                  : "translate-x-0.5 bg-muted-foreground/80 dark:bg-muted-foreground",
              )}
            />
          </span>
        </button>
      </div>

      {/* ── Search & Filter Results Feedback ───────────────────── */}
      {hasActiveFilter ? (
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <p>
            Found <span className="font-semibold text-bone">{totalMatches}</span>{" "}
            {dietaryFilter === "veg"
              ? "veg "
              : dietaryFilter === "non-veg"
              ? "non-veg "
              : ""}
            dish{totalMatches === 1 ? "" : "es"}
            {trimmedQuery ? (
              <>
                {" "}for &ldquo;
                <span className="font-medium text-bone">{query}</span>&rdquo;
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={resetAllFilters}
            className="font-medium text-saffron hover:underline"
          >
            Reset
          </button>
        </div>
      ) : null}

      {/* ── Menu List or Empty State ───────────────────────────── */}
      {sections.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No menu yet"
          description="This restaurant has not published its menu. Try another one, or check back later."
        />
      ) : hasActiveFilter && totalMatches === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-raised border border-line text-muted">
            <Search className="size-6" />
          </div>
          <h3 className="mt-3 font-display text-base font-semibold text-bone">
            No dishes found
          </h3>
          <p className="mt-1 text-xs text-muted max-w-xs mx-auto">
            {dietaryFilter === "non-veg"
              ? "No non-vegetarian dishes found matching your selection."
              : dietaryFilter === "veg"
              ? "No vegetarian dishes found matching your selection."
              : `We couldn't find any dishes matching "${query}". Check the spelling or browse the full menu.`}
          </p>
          <div className="mt-4">
            <Button size="sm" variant="outline" onClick={resetAllFilters}>
              View full menu
            </Button>
          </div>
        </div>
      ) : (
        filteredSections.map((section) => (
          <section key={section.category._id} className="border-b border-line py-2 last:border-0">
            <h2 className="sticky top-14 z-20 -mx-4 bg-ink/95 px-4 py-3 font-display text-sm font-semibold uppercase tracking-wider text-muted backdrop-blur-lg">
              {section.category.name}
              <span className="ml-2 font-sans text-xs font-normal normal-case tracking-normal text-faint">
                {section.items.length}
              </span>
            </h2>

            <div className="divide-y divide-line">
              {section.items.map((item) => (
                <MenuItemRow
                  key={item._id}
                  item={item}
                  restaurantId={restaurantId}
                  restaurantSlug={restaurantSlug}
                  campusSlug={campusSlug}
                  restaurantIsOpen={restaurantIsOpen}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
