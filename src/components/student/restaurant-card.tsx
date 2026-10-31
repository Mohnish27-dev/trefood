import { Bike, Gift, Star } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { cn, formatRating } from "@/lib/utils";
import { getRestaurantImages } from "@/lib/restaurant-media";
import { RestaurantCarousel } from "./restaurant-carousel";
import { FavouriteButton } from "./account/favourite-button";
import type { RestaurantListItem } from "@/server/services/catalog";

export function RestaurantCard({
  restaurant,
  campusSlug,
  favourited = false,
  signedIn = false,
}: {
  restaurant: RestaurantListItem;
  campusSlug: string;
  favourited?: boolean;
  signedIn?: boolean;
}) {
  const { isServingNow } = restaurant;
  const images = getRestaurantImages(restaurant);
  const etaLabel = `${restaurant.prepMinutes}-${restaurant.prepMinutes + 10} MINS`;

  const highlightTag =
    restaurant.rating !== null && restaurant.rating >= 4.5
      ? `🏅 Best in ${restaurant.cuisines[0] || "Campus"}`
      : null;

  return (
    <div className="relative">
      <FavouriteButton
        restaurantId={restaurant._id}
        restaurantName={restaurant.name}
        initialFavourited={favourited}
        signedIn={signedIn}
        className="absolute right-2 top-2 z-20"
      />

      <Link href={`/c/${campusSlug}/r/${restaurant.slug}`} className="block group">
        <Card
          className={cn(
            "overflow-hidden border border-line bg-surface transition-all duration-300 rounded-2xl group-active:scale-[0.99] shadow-xs hover:shadow-md",
            isServingNow
              ? "hover:border-tf-maroon/40"
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

          {/* ── Details Section (Matching Reference Card) ─────────────── */}
          <div className="p-3.5 sm:p-4">
            {/* Highlight Tag */}
            {highlightTag ? (
              <p className="mb-1 text-xs font-semibold text-tf-maroon dark:text-rose-400 tracking-tight">
                {highlightTag}
              </p>
            ) : null}

            {/* Restaurant Name */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-bone group-hover:text-tf-maroon dark:group-hover:text-rose-400 transition-colors truncate">
                {restaurant.name}
              </h3>
            </div>

            {/* Rating, ETA & Min Order Line */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                <Star className="size-3 fill-white text-white" />
                <span>
                  {restaurant.rating !== null ? formatRating(restaurant.rating) : "New"}
                </span>
                {restaurant.ratingCount ? (
                  <span className="opacity-90">({restaurant.ratingCount})</span>
                ) : null}
              </span>

              <span className="text-muted font-medium">
                {restaurant.prepMinutes}-{restaurant.prepMinutes + 10} min
              </span>

              <span className="text-line">•</span>

              <span className="text-muted font-medium">
                Min <Money paise={restaurant.minOrderPaise} />
              </span>

              {restaurant.isDineInAvailable ? (
                <>
                  <span className="text-line">•</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    🍽️ Dine-in
                  </span>
                </>
              ) : null}
            </div>

            {/* Cuisines */}
            <p className="mt-1.5 text-xs text-muted truncate">
              {restaurant.cuisines.join(", ")}
            </p>

            {/* Offer Badges (ZERO Delivery Fee & Student Offers) */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-line/60">
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/25 border border-rose-200/80 dark:border-rose-900/40 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                <Bike className="size-3 text-rose-600" />
                <span>ZERO Delivery Fee</span>
              </span>

              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/25 border border-purple-200/80 dark:border-purple-900/40 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-400">
                <Gift className="size-3 text-purple-600" />
                <span>Student Offers</span>
              </span>
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}
