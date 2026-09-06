import { Heart, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { RestaurantCard } from "@/components/student/restaurant-card";
import { getSession } from "@/server/auth/session";
import {
  getCampusById,
  getRestaurantsByIds,
  isRestaurantServing,
  type RestaurantListItem,
} from "@/server/services/catalog";
import { campusLocalMinutes } from "@/server/services/curfew";
import { DEFAULT_CAMPUS_SLUG } from "@/lib/routes";

export const metadata: Metadata = { title: "Favourites" };
export const dynamic = "force-dynamic";

/**
 * The starred restaurants.
 *
 * Same card as the browse list, on purpose — a favourite is not a different
 * kind of restaurant, and a student should be able to order from here without
 * re-learning a layout. Closed places stay in the list, greyed, exactly as
 * they do on the feed: knowing your usual is shut is information.
 *
 * A restaurant that has since been de-listed simply does not come back from
 * `getRestaurantsByIds`, so it disappears from the list without the star being
 * deleted — de-listing is often temporary.
 */
export default async function FavouritesPage() {
  const session = await getSession();

  if (!session) {
    return (
      <>
        <SubPageHeader title="Favourites" />
        <EmptyState
          icon={UserRound}
          title="Sign in to keep favourites"
          description="Starring a restaurant saves it to your account, so it follows you to a new phone."
          action={
            <Button asChild>
              <Link href="/signin?next=/account/favourites">Sign in</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { user } = session;
  const ids = user.favouriteRestaurantIds ?? [];

  const [rows, campus] = await Promise.all([
    getRestaurantsByIds(ids),
    user.campusId ? getCampusById(user.campusId) : Promise.resolve(null),
  ]);

  const campusSlug = campus?.slug ?? DEFAULT_CAMPUS_SLUG;
  const nowMinutes = campusLocalMinutes(new Date(), campus?.timezone ?? "Asia/Kolkata");

  const restaurants: RestaurantListItem[] = rows
    .filter((restaurant) => restaurant.isApproved)
    .map((restaurant) => ({
      ...restaurant,
      isServingNow: isRestaurantServing(restaurant, nowMinutes),
    }));

  return (
    <>
      <SubPageHeader title="Favourites" />

      {restaurants.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No favourites yet"
          description="Tap the heart on any restaurant while you browse and it lands here, ready for the next late-night order."
          action={
            <Button asChild variant="secondary">
              <Link href={`/c/${campusSlug}`}>Browse restaurants</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4 p-4">
          <p className="px-1 text-xs text-muted">
            {restaurants.length} restaurant{restaurants.length === 1 ? "" : "s"} starred.
            Tap the heart again to remove one.
          </p>

          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant._id}
              restaurant={restaurant}
              campusSlug={campusSlug}
              favourited
              signedIn
            />
          ))}
        </div>
      )}
    </>
  );
}
