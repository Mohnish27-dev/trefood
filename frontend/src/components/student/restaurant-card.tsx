import Link from "next/link";
import { formatINR, type IRestaurant } from "@trefood/shared";

import { cn } from "@/lib/utils";

/**
 * A restaurant row.
 *
 * A CLOSED restaurant is greyed and pushed to the bottom of the list, but never
 * hidden — a student should see that the place exists and is shut right now, rather
 * than wonder whether it was ever there. It is still a link, so they can read the
 * menu and come back.
 */
export function RestaurantCard({
  restaurant,
  campusSlug,
}: {
  restaurant: IRestaurant;
  campusSlug: string;
}) {
  return (
    <Link
      href={`/c/${campusSlug}/r/${restaurant.slug}`}
      className={cn(
        "hover:bg-accent flex gap-3 rounded-lg border p-3 transition-colors",
        !restaurant.isOpen && "opacity-60",
      )}
    >
      <div className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-md text-xl font-semibold">
        {restaurant.name.charAt(0)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate font-medium">{restaurant.name}</h3>
          {!restaurant.isOpen ? (
            <span className="text-muted-foreground shrink-0 text-xs font-medium">Closed</span>
          ) : null}
        </div>

        <p className="text-muted-foreground truncate text-sm">
          {restaurant.cuisine.join(", ")}
        </p>

        <p className="text-muted-foreground mt-1 text-xs">
          {restaurant.defaultPrepMinutes} min · Min {formatINR(restaurant.minOrderPaise)}
        </p>
      </div>
    </Link>
  );
}
