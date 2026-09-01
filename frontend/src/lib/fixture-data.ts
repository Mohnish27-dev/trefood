import {
  menuCategories,
  menuItems,
  nitPatnaCampus,
  ordersByStatus,
  restaurants,
  studentView,
  type ICampus,
  type IMenuCategory,
  type IMenuItem,
  type IOrder,
  type IRestaurant,
} from "@trefood/shared";

/**
 * The Phase 2 data source: fixtures, behind the exact function shapes the real API
 * client will expose.
 *
 * Every function is `async` even though nothing here awaits anything. That is
 * deliberate — it means Phase 7 replaces a body with `api.get(...)` and no caller,
 * no loading state, and no component signature changes. If these were synchronous,
 * every screen would need rewriting the day the backend arrives.
 *
 * DELETE THIS FILE IN PHASE 7. It exists so the student journey can be walked on a
 * real phone before a single database row exists.
 */

/** Simulates a network hop, so loading states are actually visible while developing. */
const LATENCY_MS = 120;

function respond<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

export function listCampuses(): Promise<ICampus[]> {
  return respond([nitPatnaCampus]);
}

export function getCampus(slug: string): Promise<ICampus | null> {
  return respond(nitPatnaCampus.slug === slug ? nitPatnaCampus : null);
}

/**
 * Restaurants for a campus, filtered by the chosen delivery zone.
 *
 * The zone filter is the structural inversion described in
 * docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §4: vendors declare which zones they serve,
 * so picking a delivery point changes which restaurants exist at all. It is not a
 * post-hoc filter bolted onto a list — it decides what the list is.
 *
 * Sorting puts open restaurants first and closed ones last. Closed ones are still
 * returned: a student should see that a place exists and is shut, not wonder whether
 * it ever existed.
 */
export function listRestaurants(campusSlug: string, zoneId?: string): Promise<IRestaurant[]> {
  // An unknown campus slug returns nothing, rather than silently serving NIT Patna's
  // restaurants under another campus's URL.
  if (campusSlug !== nitPatnaCampus.slug) return respond([]);

  const matching = restaurants
    .filter((restaurant) => restaurant.campusId === nitPatnaCampus._id)
    .filter((restaurant) => zoneId === undefined || restaurant.servedZoneIds.includes(zoneId))
    .sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || a.name.localeCompare(b.name));

  return respond(matching);
}

export function getRestaurant(slug: string): Promise<IRestaurant | null> {
  return respond(restaurants.find((restaurant) => restaurant.slug === slug) ?? null);
}

export function getMenu(
  restaurantId: string,
): Promise<{ categories: IMenuCategory[]; items: IMenuItem[] }> {
  return respond({
    categories: menuCategories
      .filter((category) => category.restaurantId === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    items: menuItems
      .filter((item) => item.restaurantId === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

/**
 * The student's order history.
 *
 * A hand-picked slice of the FSM fixtures rather than all eighteen — a real history
 * is mostly finished orders with one live one at the top, and that is the shape the
 * screen has to look right in.
 */
export function listOrders(): Promise<IOrder[]> {
  return respond([
    ordersByStatus.AT_GATE,
    ordersByStatus.PREPARING,
    ordersByStatus.DELIVERED,
    ordersByStatus.REJECTED_BY_VENDOR,
    ordersByStatus.SETTLED,
  ]);
}

/**
 * One order, as the STUDENT receives it.
 *
 * `studentView` strips the gate code at every status except AT_GATE. Phase 9 moves
 * that stripping to the backend serialiser, where it is authoritative — but the
 * screens are written against the stripped shape from the first commit, so the UI
 * can never come to depend on a field it will not be given.
 */
export function getOrder(orderId: string): Promise<IOrder | null> {
  const found = Object.values(ordersByStatus).find((order) => order._id === orderId);
  return respond(found === undefined ? null : studentView(found));
}
