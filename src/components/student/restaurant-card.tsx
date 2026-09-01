import { Clock, Star } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { cn, formatRating } from "@/lib/utils";
import type { RestaurantListItem } from "@/server/services/catalog";

/**
 * A restaurant in the student list.
 *
 * Closed restaurants are RENDERED, greyed, at the bottom — never hidden. A
 * student needs to know the place exists and is shut tonight, not wonder where
 * it went. The whole card stays a link so they can still read the menu and
 * plan tomorrow.
 */
export function RestaurantCard({
  restaurant,
  campusSlug,
}: {
  restaurant: RestaurantListItem;
  campusSlug: string;
}) {
  const { isServingNow } = restaurant;
  const initials = restaurant.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("");

  return (
    <Link href={`/c/${campusSlug}/r/${restaurant.slug}`} className="block group">
      <Card
        className={cn(
          "transition-all group-active:scale-[0.99]",
          isServingNow ? "group-hover:border-saffron/50" : "opacity-55",
        )}
      >
        <div className="flex gap-3.5 p-3.5">
          {/* No photo yet, so a typographic tile rather than a grey box.
              Menu images land in Supabase Storage at Phase 2.2. */}
          <span
            className={cn(
              "flex size-16 shrink-0 items-center justify-center rounded-xl border font-display text-lg font-bold",
              isServingNow
                ? "border-saffron/25 bg-saffron-wash text-saffron"
                : "border-line bg-surface-raised text-faint",
            )}
            aria-hidden
          >
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-display text-base font-semibold text-bone">
                {restaurant.name}
              </h3>
              {isServingNow ? (
                <Badge tone="success" className="shrink-0">
                  <span className="size-1.5 rounded-full bg-mint" />
                  Open
                </Badge>
              ) : (
                <Badge tone="neutral" className="shrink-0">
                  Closed
                </Badge>
              )}
            </div>

            <p className="mt-0.5 truncate text-xs text-muted">
              {restaurant.cuisines.join(" · ")}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 text-faint" />
                {restaurant.prepMinutes} min
              </span>
              <span className="text-line">|</span>
              <span>
                Min <Money paise={restaurant.minOrderPaise} />
              </span>
              {restaurant.rating !== null ? (
                <>
                  <span className="text-line">|</span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 fill-amber text-amber" />
                    <span className="tabular">{formatRating(restaurant.rating)}</span>
                    <span className="text-faint">({restaurant.ratingCount})</span>
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
