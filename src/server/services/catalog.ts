import "server-only";

import * as db from "@/server/db/collections";
import { normalize, type CampusSearchIndex, type DishSuggestion } from "@/lib/dish-search";
import { getRestaurantImages } from "@/lib/restaurant-media";
import { campusLocalMinutes, isGateOpenAt } from "./curfew";
import { compareRestaurantsForDisplay } from "@/lib/restaurant-order";
import type { Campus, DeliveryZone } from "@/types/campus";
import type { MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";

/**
 * Read paths for the catalogue.
 *
 * Thin: these fetch and shape, they do not decide. Anything resembling a rule
 * (is this restaurant open, can this zone be delivered to) is computed by a
 * pure function in curfew.ts or below, so it stays testable.
 */

export async function listCampuses(): Promise<Campus[]> {
  const campuses = await db.campuses();
  return campuses.find({ isActive: true }).sort({ name: 1 }).toArray();
}

export async function getCampusBySlug(slug: string): Promise<Campus | null> {
  const campuses = await db.campuses();
  return campuses.findOne({ slug, isActive: true });
}

export async function getCampusById(id: string): Promise<Campus | null> {
  const campuses = await db.campuses();
  return campuses.findOne({ _id: id });
}

export function findZone(campus: Campus, zoneId: string): DeliveryZone | null {
  return campus.zones.find((z) => z.id === zoneId) ?? null;
}

/* ------------------------------------------------------------------ */
/* Restaurant hours                                                    */
/* ------------------------------------------------------------------ */

/**
 * Is the restaurant serving right now?
 *
 * Two independent conditions, and both matter:
 *   · `isOpen` is the vendor's one-tap release valve during a surge
 *   · the daily hours window, which can cross midnight for a late-night stall
 */
export function isRestaurantServing(restaurant: Restaurant, nowMinutes: number): boolean {
  if (!restaurant.isOpen || !restaurant.isApproved) return false;
  return isGateOpenAt(
    { curfewMinutes: restaurant.closesMinutes, opensMinutes: restaurant.opensMinutes },
    nowMinutes,
  );
}

export interface RestaurantListItem extends Restaurant {
  /** Computed, not stored — it changes with the clock. */
  isServingNow: boolean;
}

/**
 * The student restaurant list.
 *
 * Filtered by ZONE, not by distance. Vendors declare which gates they will
 * deliver to, so picking "Kaveri Girls Hostel" genuinely changes which
 * restaurants exist. This is the single most important structural difference
 * from a mainstream food app, and it is why the zone picker sits in the header
 * rather than at checkout.
 *
 * Sorted open-first; closed restaurants are greyed at the bottom, never hidden.
 * A student needs to know the place exists and is shut, not wonder where it went.
 */
export async function listRestaurantsForZone(
  campus: Campus,
  zoneId: string | null,
  now: Date = new Date(),
): Promise<RestaurantListItem[]> {
  const restaurants = await db.restaurants();
  const filter =
    zoneId === null
      ? { campusId: campus._id, isApproved: true }
      : { campusId: campus._id, isApproved: true, servedZoneIds: zoneId };

  const rows = await restaurants.find(filter).toArray();
  const nowMinutes = campusLocalMinutes(now, campus.timezone);

  return rows
    .map((r) => ({ ...r, isServingNow: isRestaurantServing(r, nowMinutes) }))
    .sort(compareRestaurantsForDisplay);
}

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  const restaurants = await db.restaurants();
  return restaurants.findOne({ slug });
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const restaurants = await db.restaurants();
  return restaurants.findOne({ _id: id });
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

export interface MenuSection {
  category: MenuCategory;
  items: MenuItem[];
}

/**
 * The full menu, grouped.
 *
 * Unavailable items are RETURNED, not filtered. The UI strikes them through —
 * "students should see the item exists and is out today". Filtering them here
 * would make that impossible, so the decision belongs to the caller and the
 * data layer stays honest.
 */
export async function getMenu(restaurantId: string): Promise<MenuSection[]> {
  const [categoryRows, itemRows] = await Promise.all([
    (await db.menuCategories()).find({ restaurantId }).sort({ sortOrder: 1 }).toArray(),
    (await db.menuItems()).find({ restaurantId }).sort({ sortOrder: 1 }).toArray(),
  ]);

  const byCategory = new Map<string, MenuItem[]>();
  for (const item of itemRows) {
    const bucket = byCategory.get(item.categoryId);
    if (bucket) bucket.push(item);
    else byCategory.set(item.categoryId, [item]);
  }

  return categoryRows
    .map((category) => ({ category, items: byCategory.get(category._id) ?? [] }))
    .filter((section) => section.items.length > 0);
}

/** Menu items by id, for cart pricing. The server always re-reads prices; the client never sends them. */
export async function getMenuItemsByIds(ids: readonly string[]): Promise<Map<string, MenuItem>> {
  if (ids.length === 0) return new Map();
  const items = await db.menuItems();
  const rows = await items.find({ _id: { $in: [...ids] } }).toArray();
  return new Map(rows.map((item) => [item._id, item]));
}

/**
 * Restaurants by id, in the order the ids were given.
 *
 * The favourites screen needs this: the ids live on the user document in the
 * order they were starred, and a `$in` query comes back in whatever order
 * Mongo pleases. Re-ordering here keeps "most recently starred first" true
 * without a second field to maintain.
 */
export async function getRestaurantsByIds(
  ids: readonly string[],
): Promise<Restaurant[]> {
  if (ids.length === 0) return [];
  const restaurants = await db.restaurants();
  const rows = await restaurants.find({ _id: { $in: [...ids] } }).toArray();
  const byId = new Map(rows.map((r) => [r._id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is Restaurant => r !== undefined);
}

/* ------------------------------------------------------------------ */
/* Campus dish search index                                            */
/* ------------------------------------------------------------------ */

/**
 * Everything the search bar needs to autocomplete, in one payload.
 *
 * Built per zone, because a suggestion a student cannot act on is worse than
 * no suggestion: if no kitchen serving your gate makes Chicken Roll, the word
 * should not appear while you type. That is the same rule the restaurant list
 * already follows, applied one level down to dishes.
 *
 * Dishes are folded by normalised name across restaurants, so "Chicken
 * Biryani" is ONE row carrying the ids of every kitchen that cooks it — which
 * is what lets a tap answer "who has this?" without a second round trip.
 */
export async function buildCampusSearchIndex(
  campus: Campus,
  zoneId: string | null,
  now: Date = new Date(),
): Promise<CampusSearchIndex> {
  const restaurants = await listRestaurantsForZone(campus, zoneId, now);
  if (restaurants.length === 0) return { dishes: [], restaurants: [], cuisines: [] };

  const items = await db.menuItems();
  const rows = await items
    .find(
      { restaurantId: { $in: restaurants.map((r) => r._id) } },
      {
        projection: {
          _id: 1,
          restaurantId: 1,
          name: 1,
          isVeg: 1,
          pricePaise: 1,
          imageUrl: 1,
          isPopular: 1,
        },
      },
    )
    .toArray();

  const imagesByRestaurant = new Map(
    restaurants.map((r) => [r._id, getRestaurantImages(r)[0] ?? null]),
  );

  const byName = new Map<string, DishSuggestion>();
  for (const row of rows) {
    const key = normalize(row.name);
    if (key.length === 0) continue;

    const existing = byName.get(key);
    if (existing) {
      if (!existing.restaurantIds.includes(row.restaurantId)) {
        existing.restaurantIds.push(row.restaurantId);
      }
      existing.fromPricePaise = Math.min(existing.fromPricePaise, row.pricePaise);
      existing.isPopular = existing.isPopular || row.isPopular;
      // A dish is only marked veg when EVERY kitchen's version is veg; the
      // green dot is a promise, so the pessimistic read is the honest one.
      existing.isVeg = existing.isVeg && row.isVeg;
      existing.imageUrl = existing.imageUrl ?? row.imageUrl;
      continue;
    }

    byName.set(key, {
      kind: "dish",
      name: row.name.trim(),
      isVeg: row.isVeg,
      fromPricePaise: row.pricePaise,
      imageUrl: row.imageUrl ?? imagesByRestaurant.get(row.restaurantId) ?? null,
      restaurantIds: [row.restaurantId],
      isPopular: row.isPopular,
    });
  }

  const cuisineIds = new Map<string, string[]>();
  for (const restaurant of restaurants) {
    for (const cuisine of restaurant.cuisines) {
      const key = cuisine.trim();
      if (key.length === 0) continue;
      const bucket = cuisineIds.get(key);
      if (bucket) bucket.push(restaurant._id);
      else cuisineIds.set(key, [restaurant._id]);
    }
  }

  return {
    dishes: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    restaurants: restaurants.map((r) => ({
      kind: "restaurant" as const,
      id: r._id,
      name: r.name,
      slug: r.slug,
      cuisines: r.cuisines,
      imageUrl: imagesByRestaurant.get(r._id) ?? null,
      isServingNow: r.isServingNow,
    })),
    cuisines: [...cuisineIds.entries()]
      .map(([name, restaurantIds]) => ({ kind: "cuisine" as const, name, restaurantIds }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
