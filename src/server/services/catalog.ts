import "server-only";

import * as db from "@/server/db/collections";
import { campusLocalMinutes, isGateOpenAt } from "./curfew";
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
    .sort((a, b) => {
      if (a.isServingNow !== b.isServingNow) return a.isServingNow ? -1 : 1;
      if (a.prepMinutes !== b.prepMinutes) return a.prepMinutes - b.prepMinutes;
      return a.name.localeCompare(b.name);
    });
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
