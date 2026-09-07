/**
 * Restaurant display ordering for the user dashboard.
 *
 * Prescribed priority order:
 *   1. Vrindavan (Vrindavan Bhog)
 *   2. Kolkata Biryani (Kolkata Biryani Fast-Food Pizza House)
 *   3. CSB (Chai Sutta Bar)
 *   4. Royal Bihar (The Royal Bihar Restaurant)
 *   5. Sone Zone (Sone Zone Cafe)
 *   6. Mokila (Mokila Restaurant)
 *   7. Rest of restaurants
 */

export interface RestaurantOrderTarget {
  _id?: string;
  slug?: string;
  name?: string;
  prepMinutes?: number;
  isServingNow?: boolean;
  displayOrder?: number | null | undefined;
}

/**
 * Returns the numerical priority rank for a restaurant (lower number = higher priority).
 * An explicit displayOrder set by an admin takes precedence over the default priority.
 */
export function getRestaurantDisplayPriority(restaurant: RestaurantOrderTarget): number {
  if (typeof restaurant.displayOrder === "number" && !Number.isNaN(restaurant.displayOrder)) {
    return restaurant.displayOrder;
  }

  const slug = (restaurant.slug ?? "").toLowerCase();
  const name = (restaurant.name ?? "").toLowerCase();
  const id = (restaurant._id ?? "").toLowerCase();

  // 1. Vrindavan
  if (slug.includes("vrindavan") || name.includes("vrindavan") || id.includes("vrindavan")) {
    return 1;
  }

  // 2. Kolkata Biryani
  if (slug.includes("kolkata") || name.includes("kolkata") || id.includes("kolkata")) {
    return 2;
  }

  // 3. CSB
  if (
    slug.includes("csb") ||
    slug.includes("chai-sutta") ||
    name.includes("csb") ||
    name.includes("chai sutta") ||
    id.includes("csb")
  ) {
    return 3;
  }

  // 4. Royal Bihar
  if (
    slug.includes("royal-bihar") ||
    slug.includes("royalbihar") ||
    name.includes("royal bihar") ||
    name.includes("royalbihar") ||
    id.includes("royalbihar")
  ) {
    return 4;
  }

  // 5. Sone Zone
  if (
    slug.includes("sone-zone") ||
    slug.includes("sonezone") ||
    name.includes("sone zone") ||
    name.includes("sonezone") ||
    id.includes("sonezone")
  ) {
    return 5;
  }

  // 6. Mokila
  if (slug.includes("mokila") || name.includes("mokila") || id.includes("mokila")) {
    return 6;
  }

  // 7. Rest of restaurants
  return 999;
}

/**
 * Comparator for sorting restaurants on the student dashboard.
 * - Open restaurants first (isServingNow = true before false).
 * - Priority order: Vrindavan -> Kolkata Biryani -> CSB -> Royal Bihar -> Sone Zone -> Mokila -> Rest.
 * - Tie-breaker for restaurants with the same priority (e.g. among "Rest of restaurants"):
 *   Sort by prep time ascending, then alphabetical by name.
 */
export function compareRestaurantsForDisplay<T extends RestaurantOrderTarget>(a: T, b: T): number {
  if (
    a.isServingNow !== undefined &&
    b.isServingNow !== undefined &&
    a.isServingNow !== b.isServingNow
  ) {
    return a.isServingNow ? -1 : 1;
  }

  const priorityA = getRestaurantDisplayPriority(a);
  const priorityB = getRestaurantDisplayPriority(b);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const prepA = a.prepMinutes ?? 0;
  const prepB = b.prepMinutes ?? 0;
  if (prepA !== prepB) {
    return prepA - prepB;
  }

  const nameA = a.name ?? "";
  const nameB = b.name ?? "";
  return nameA.localeCompare(nameB);
}
