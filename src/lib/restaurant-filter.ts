import type { RestaurantListItem } from "@/server/services/catalog";

export type FoodTypeFilter = "all" | "fruits" | "juice_shakes" | "food";

export interface FoodTypeOption {
  id: FoodTypeFilter;
  label: string;
  emoji: string;
}

export const FOOD_TYPE_OPTIONS: FoodTypeOption[] = [
  { id: "all", label: "All", emoji: "🍽️" },
  { id: "fruits", label: "Fruits", emoji: "🍎" },
  { id: "juice_shakes", label: "Juice / Shakes", emoji: "🥤" },
  { id: "food", label: "Food", emoji: "🍛" },
];

const FRUIT_REGEX = /fruit|फल/i;
const JUICE_SHAKE_REGEX = /juice|shake|smoothie|milkshake|mocktail|जूस|शेक/i;
const COOKED_FOOD_REGEX =
  /biryani|thali|roll|pizza|burger|momo|noodle|rice|curry|meal|roti|tandoor|bihari|north indian|south indian|chinese|fast food|snack|chai|cafe|wrap|chicken|chilli|paneer|dosa|bhojan|khana|bread/i;

/**
 * Determines whether a restaurant matches a given food type filter.
 *
 * Designed to accurately classify campus vendors:
 * - "fruits": Vendors offering fresh fruits, fruit chaat, or fruit platters (e.g. Prince Juice, Raj Darbar).
 * - "juice_shakes": Vendors offering fresh juices, thick shakes, smoothies (e.g. Prince Juice, CSB, Raj Darbar, Sone Zone).
 * - "food": Vendors offering cooked food, meals, thalis, fast food, snacks (e.g. Kolkata Biryani, Wrapchik, Raj Darbar, CSB, Royal Bihar, Sone Zone, Zaika).
 */
export function matchesFoodType(
  restaurant: Pick<RestaurantListItem, "name" | "cuisines" | "description">,
  filter: FoodTypeFilter,
): boolean {
  if (filter === "all") return true;

  const cuisinesLower = (restaurant.cuisines || []).map((c) => c.toLowerCase());
  const nameLower = (restaurant.name || "").toLowerCase();
  const descLower = (restaurant.description || "").toLowerCase();

  if (filter === "fruits") {
    return (
      cuisinesLower.some((c) => FRUIT_REGEX.test(c)) ||
      FRUIT_REGEX.test(nameLower) ||
      FRUIT_REGEX.test(descLower)
    );
  }

  if (filter === "juice_shakes") {
    return (
      cuisinesLower.some((c) => JUICE_SHAKE_REGEX.test(c)) ||
      JUICE_SHAKE_REGEX.test(nameLower) ||
      JUICE_SHAKE_REGEX.test(descLower)
    );
  }

  if (filter === "food") {
    // Pure fruit or juice stalls (e.g. Prince Juice & Shakes Corner) that do not serve
    // cooked meals or savoury snacks should be excluded from "food".
    const isPureJuiceOrFruitStall =
      JUICE_SHAKE_REGEX.test(nameLower) &&
      !cuisinesLower.some((c) => COOKED_FOOD_REGEX.test(c));

    if (isPureJuiceOrFruitStall) {
      return false;
    }

    const hasCookedFoodCuisine = cuisinesLower.some(
      (c) => COOKED_FOOD_REGEX.test(c) && !/healthy food/i.test(c),
    );

    return (
      hasCookedFoodCuisine ||
      COOKED_FOOD_REGEX.test(nameLower) ||
      COOKED_FOOD_REGEX.test(descLower)
    );
  }

  return true;
}

/**
 * Computes restaurant count per category for badges.
 */
export function getFoodTypeCounts<
  T extends Pick<RestaurantListItem, "name" | "cuisines" | "description">,
>(restaurants: T[]): Record<FoodTypeFilter, number> {
  return {
    all: restaurants.length,
    fruits: restaurants.filter((r) => matchesFoodType(r, "fruits")).length,
    juice_shakes: restaurants.filter((r) => matchesFoodType(r, "juice_shakes")).length,
    food: restaurants.filter((r) => matchesFoodType(r, "food")).length,
  };
}
