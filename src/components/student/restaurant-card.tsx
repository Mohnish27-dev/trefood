import { Star } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { cn, formatRating } from "@/lib/utils";
import { getRestaurantImages } from "@/lib/restaurant-media";
import { RestaurantCarousel } from "./restaurant-carousel";
import type { RestaurantListItem } from "@/server/services/catalog";

/**
 * A restaurant in the student list styled after the Swiggy card layout.
 *
 * Includes an auto-sliding horizontal image carousel (3s loop),
 * ETA badge in bottom-right, rating pill, and clean typography.
 *
 * Closed restaurants are RENDERED, greyed, at the bottom — never hidden.
 * The whole card stays a link so students can still read the menu and plan tomorrow.
 */
export function RestaurantCard({
  restaurant,
  campusSlug,
}: {
  restaurant: RestaurantListItem;
  campusSlug: string;
}) {
  const { isServingNow } = restaurant;
  const images = getRestaurantImages(restaurant);
  const etaLabel = `${restaurant.prepMinutes}-${restaurant.prepMinutes + 5} MINS`;

  const highlightTag =
    restaurant.rating !== null && restaurant.rating >= 4.5
      ? `🏅 Best in ${restaurant.cuisines[0] || "Campus"}`
      : null;

  return (
    <Link href={`/c/${campusSlug}/r/${restaurant.slug}`} className="block group">
      <Card
        className={cn(
          "overflow-hidden border border-line bg-surface transition-all duration-300 rounded-2xl group-active:scale-[0.99]",
          isServingNow
            ? "hover:border-saffron/50 hover:shadow-lg"
            : "opacity-65 hover:opacity-85",
        )}
      >
        {/* ── 16:9 Image Carousel ──────────────────────────────────── */}
        <RestaurantCarousel
          images={images}
          restaurantName={restaurant.name}
          etaLabel={etaLabel}
          isServingNow={isServingNow}
        />

        {/* ── Details Section (Matching Swiggy Card) ────────────────── */}
        <div className="p-3.5 sm:p-4">
          {/* Highlight Tag */}
          {highlightTag ? (
            <p className="mb-1 text-xs font-semibold text-saffron tracking-tight">
              {highlightTag}
            </p>
          ) : null}

          {/* Restaurant Name */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight text-bone group-hover:text-saffron transition-colors truncate">
              {restaurant.name}
            </h3>
          </div>

          {/* Rating, Gate & Transit Line */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-bold text-white shadow-xs">
              <Star className="size-3 fill-white text-white" />
              <span>
                {restaurant.rating !== null ? formatRating(restaurant.rating) : "New"}
              </span>
              {restaurant.ratingCount ? (
                <span className="opacity-90">({restaurant.ratingCount})</span>
              ) : null}
            </span>

            <span className="text-line">•</span>
            <span className="font-medium text-bone/80">NIT Patna</span>

            <span className="text-line">•</span>
            <span>{restaurant.prepMinutes} min prep</span>
          </div>

          {/* Cuisines & Min Order Line */}
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted truncate">
            <p className="truncate">
              {restaurant.cuisines.join(", ")}
            </p>
            <span className="shrink-0 pl-2 font-medium text-bone/90">
              Min <Money paise={restaurant.minOrderPaise} />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
