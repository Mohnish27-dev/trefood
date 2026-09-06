import { describe, expect, it } from "vitest";
import {
  compareRestaurantsForDisplay,
  getRestaurantDisplayPriority,
  type RestaurantOrderTarget,
} from "@/lib/restaurant-order";

describe("restaurant-order", () => {
  it("assigns the prescribed display priority ranks", () => {
    expect(getRestaurantDisplayPriority({ name: "Vrindavan Bhog", slug: "vrindavan-bhog" })).toBe(1);
    expect(
      getRestaurantDisplayPriority({
        name: "Kolkata Biryani Fast-Food Pizza House",
        slug: "kolkata-biryani-fast-food-pizza-house",
      }),
    ).toBe(2);
    expect(
      getRestaurantDisplayPriority({
        name: "Chai Sutta Bar (CSB)",
        slug: "chai-sutta-bar-csb",
      }),
    ).toBe(3);
    expect(
      getRestaurantDisplayPriority({
        name: "The Royal Bihar Restaurant",
        slug: "the-royal-bihar-restaurant",
      }),
    ).toBe(4);
    expect(
      getRestaurantDisplayPriority({
        name: "Sone Zone Cafe",
        slug: "sone-zone-cafe",
      }),
    ).toBe(5);
    expect(
      getRestaurantDisplayPriority({
        name: "Mokila Restaurant",
        slug: "mokila-restaurant",
      }),
    ).toBe(6);
    expect(
      getRestaurantDisplayPriority({
        name: "Wrapchik Pizza",
        slug: "wrapchik-pizza",
      }),
    ).toBe(999);
    expect(
      getRestaurantDisplayPriority({
        name: "Raj Darbar",
        slug: "raj-darbar",
      }),
    ).toBe(999);
  });

  it("sorts restaurants in the exact user-requested order when all are open", () => {
    const list: RestaurantOrderTarget[] = [
      { name: "Wrapchik Pizza", slug: "wrapchik-pizza", prepMinutes: 15, isServingNow: true },
      { name: "Mokila Restaurant", slug: "mokila-restaurant", prepMinutes: 15, isServingNow: true },
      { name: "The Royal Bihar Restaurant", slug: "the-royal-bihar-restaurant", prepMinutes: 25, isServingNow: true },
      { name: "Chai Sutta Bar (CSB)", slug: "chai-sutta-bar-csb", prepMinutes: 15, isServingNow: true },
      { name: "Sone Zone Cafe", slug: "sone-zone-cafe", prepMinutes: 15, isServingNow: true },
      { name: "Vrindavan Bhog", slug: "vrindavan-bhog", prepMinutes: 20, isServingNow: true },
      { name: "Kolkata Biryani Fast-Food Pizza House", slug: "kolkata-biryani-fast-food-pizza-house", prepMinutes: 20, isServingNow: true },
      { name: "Raj Darbar", slug: "raj-darbar", prepMinutes: 20, isServingNow: true },
    ];

    const sorted = [...list].sort(compareRestaurantsForDisplay);
    const sortedNames = sorted.map((r) => r.name);

    expect(sortedNames).toEqual([
      "Vrindavan Bhog",
      "Kolkata Biryani Fast-Food Pizza House",
      "Chai Sutta Bar (CSB)",
      "The Royal Bihar Restaurant",
      "Sone Zone Cafe",
      "Mokila Restaurant",
      "Wrapchik Pizza",
      "Raj Darbar",
    ]);
  });

  it("keeps open restaurants first, while preserving priority within each group", () => {
    const list: RestaurantOrderTarget[] = [
      { name: "Mokila Restaurant", slug: "mokila-restaurant", isServingNow: false },
      { name: "Vrindavan Bhog", slug: "vrindavan-bhog", isServingNow: false },
      { name: "Sone Zone Cafe", slug: "sone-zone-cafe", isServingNow: true },
      { name: "Chai Sutta Bar (CSB)", slug: "chai-sutta-bar-csb", isServingNow: true },
      { name: "Wrapchik Pizza", slug: "wrapchik-pizza", isServingNow: true, prepMinutes: 15 },
    ];

    const sorted = [...list].sort(compareRestaurantsForDisplay);
    const sortedNames = sorted.map((r) => r.name);

    expect(sortedNames).toEqual([
      // Open restaurants first, sorted by priority
      "Chai Sutta Bar (CSB)",
      "Sone Zone Cafe",
      "Wrapchik Pizza",
      // Closed restaurants second, sorted by priority
      "Vrindavan Bhog",
      "Mokila Restaurant",
    ]);
  });

  it("prioritizes explicit displayOrder when set by admin", () => {
    // Admin decides to place Mokila first (#1) and Wrapchik second (#2)
    const list: RestaurantOrderTarget[] = [
      { name: "Vrindavan Bhog", slug: "vrindavan-bhog", displayOrder: 3, isServingNow: true },
      { name: "Mokila Restaurant", slug: "mokila-restaurant", displayOrder: 1, isServingNow: true },
      { name: "Wrapchik Pizza", slug: "wrapchik-pizza", displayOrder: 2, isServingNow: true },
    ];

    const sorted = [...list].sort(compareRestaurantsForDisplay);
    const sortedNames = sorted.map((r) => r.name);

    expect(sortedNames).toEqual([
      "Mokila Restaurant",
      "Wrapchik Pizza",
      "Vrindavan Bhog",
    ]);
  });

  it("falls back to default priority when displayOrder is null or undefined", () => {
    const list: RestaurantOrderTarget[] = [
      { name: "Mokila Restaurant", slug: "mokila-restaurant", displayOrder: null, isServingNow: true },
      { name: "Vrindavan Bhog", slug: "vrindavan-bhog", displayOrder: undefined, isServingNow: true },
    ];

    const sorted = [...list].sort(compareRestaurantsForDisplay);
    expect(sorted.map((r) => r.name)).toEqual([
      "Vrindavan Bhog",
      "Mokila Restaurant",
    ]);
  });
});

