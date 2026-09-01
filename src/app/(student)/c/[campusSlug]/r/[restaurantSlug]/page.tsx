import { ArrowLeft, Clock, Phone, Star, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/states";
import { CartBar } from "@/components/student/cart-bar";
import { MenuItemRow } from "@/components/student/menu-item-row";
import { formatRating } from "@/lib/utils";
import {
  getCampusBySlug,
  getMenu,
  getRestaurantBySlug,
  isRestaurantServing,
} from "@/server/services/catalog";
import { campusLocalMinutes, formatMinutes } from "@/server/services/curfew";

export const dynamic = "force-dynamic";

export default async function MenuPage({
  params,
}: PageProps<"/c/[campusSlug]/r/[restaurantSlug]">) {
  const { campusSlug, restaurantSlug } = await params;

  const [campus, restaurant] = await Promise.all([
    getCampusBySlug(campusSlug),
    getRestaurantBySlug(restaurantSlug),
  ]);

  if (!campus || !restaurant || restaurant.campusId !== campus._id) notFound();

  const sections = await getMenu(restaurant._id);
  const nowMinutes = campusLocalMinutes(new Date(), campus.timezone);
  const isServing = isRestaurantServing(restaurant, nowMinutes);

  const outOfStockCount = sections.reduce(
    (n, s) => n + s.items.filter((i) => !i.isAvailable).length,
    0,
  );

  return (
    <>
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur-lg pt-safe">
        <div className="flex min-h-14 items-center gap-2 px-2">
          <Link
            href={`/c/${campusSlug}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-raised hover:text-bone"
            aria-label="Back to restaurants"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-bone">
            {restaurant.name}
          </h1>
          <a
            href={`tel:${restaurant.phone}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-raised hover:text-bone"
            aria-label={`Call ${restaurant.name}`}
          >
            <Phone className="size-5" />
          </a>
        </div>
      </header>

      {/* ── Restaurant summary ───────────────────────────────────── */}
      <section className="border-b border-line px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {isServing ? (
            <Badge tone="success">
              <span className="size-1.5 rounded-full bg-mint" />
              Open now
            </Badge>
          ) : (
            <Badge tone="warning">
              Closed · opens {formatMinutes(restaurant.opensMinutes)}
            </Badge>
          )}
          {restaurant.rating !== null ? (
            <Badge tone="neutral">
              <Star className="size-3 fill-amber text-amber" />
              {formatRating(restaurant.rating)} ({restaurant.ratingCount})
            </Badge>
          ) : null}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted">{restaurant.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 text-faint" />
            {restaurant.prepMinutes} min prep
          </span>
          <span>
            Min order <Money paise={restaurant.minOrderPaise} />
          </span>
          <span>
            Packaging <Money paise={restaurant.packagingFeePaise} />
          </span>
        </div>

        {outOfStockCount > 0 ? (
          <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
            {outOfStockCount} item{outOfStockCount === 1 ? " is" : "s are"} out of stock today.
            They stay listed so you know they exist.
          </p>
        ) : null}
      </section>

      {/* ── Menu ─────────────────────────────────────────────────── */}
      <div className="px-4">
        {sections.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="No menu yet"
            description="This restaurant has not published its menu. Try another one, or check back later."
          />
        ) : (
          sections.map((section) => (
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
                    restaurantId={restaurant._id}
                    restaurantSlug={restaurant.slug}
                    campusSlug={campusSlug}
                    restaurantIsOpen={isServing}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <CartBar />
    </>
  );
}
