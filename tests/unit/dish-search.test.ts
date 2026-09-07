import { describe, expect, it } from "vitest";

import {
  highlightParts,
  matchScore,
  matchesQuery,
  rankSuggestions,
  restaurantIdsMatchingDish,
  type CampusSearchIndex,
  type DishSuggestion,
  type RestaurantSuggestion,
} from "@/lib/dish-search";

function dish(
  name: string,
  restaurantIds: string[],
  extra: Partial<DishSuggestion> = {},
): DishSuggestion {
  return {
    kind: "dish",
    name,
    isVeg: false,
    fromPricePaise: 12000,
    imageUrl: null,
    restaurantIds,
    isPopular: false,
    ...extra,
  };
}

function restaurant(
  name: string,
  id: string,
  cuisines: string[] = [],
): RestaurantSuggestion {
  return {
    kind: "restaurant",
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    cuisines,
    imageUrl: null,
    isServingNow: true,
  };
}

const INDEX: CampusSearchIndex = {
  dishes: [
    dish("Biryani", ["r1", "r2", "r3"], { isVeg: true }),
    dish("Chicken Biryani", ["r1", "r2"]),
    dish("Veg Biryani", ["r3"], { isVeg: true }),
    dish("Chicken Roll", ["r4"]),
    dish("Masala Chai", ["r5"], { isVeg: true, fromPricePaise: 2000 }),
  ],
  restaurants: [
    restaurant("Kolkata Biryani House", "r1", ["Biryani", "Fast Food"]),
    restaurant("Zaika Biryani", "r2", ["Biryani"]),
    restaurant("Vrindavan Bhog", "r3", ["North Indian"]),
    restaurant("Wrapchik", "r4", ["Rolls"]),
    restaurant("Chai Sutta Bar", "r5", ["Chai"]),
  ],
  cuisines: [
    { kind: "cuisine", name: "Biryani", restaurantIds: ["r1", "r2"] },
    { kind: "cuisine", name: "Rolls", restaurantIds: ["r4"] },
  ],
};

describe("matchScore", () => {
  it("ranks an exact name above a prefix above a mid-word hit", () => {
    const exact = matchScore("Biryani", "biryani");
    const prefix = matchScore("Biryani Special", "biryani");
    const inner = matchScore("Chicken Biryani", "iryani");

    expect(exact).not.toBeNull();
    expect(prefix).not.toBeNull();
    expect(inner).not.toBeNull();
    expect(exact!).toBeLessThan(prefix!);
    expect(prefix!).toBeLessThan(inner!);
  });

  it("matches a word that starts mid-string, which is how students type", () => {
    // "bir" must find "Chicken Biryani" without the student typing "chicken".
    expect(matchesQuery("Chicken Biryani", "bir")).toBe(true);
  });

  it("matches several partial words in any order", () => {
    expect(matchesQuery("Chicken Biryani", "chick bir")).toBe(true);
    expect(matchesQuery("Chicken Biryani", "bir chick")).toBe(true);
  });

  it("ignores case, punctuation and accents", () => {
    expect(matchesQuery("Chicken-Biryani (Half)", "chicken biryani")).toBe(true);
    expect(matchesQuery("Café Mocha", "cafe")).toBe(true);
  });

  it("rejects a query that is nowhere in the text", () => {
    expect(matchScore("Chicken Biryani", "pizza")).toBeNull();
    expect(matchScore("Chicken Biryani", "")).toBeNull();
  });
});

describe("rankSuggestions", () => {
  it("returns nothing for an empty query", () => {
    expect(rankSuggestions(INDEX, "   ")).toEqual([]);
  });

  it("puts the dish named by a two-letter prefix first", () => {
    const [first] = rankSuggestions(INDEX, "bi");
    expect(first?.kind).toBe("dish");
    expect(first?.name).toBe("Biryani");
  });

  it("still surfaces the restaurants whose names match", () => {
    const names = rankSuggestions(INDEX, "biryani").map((s) => s.name);
    expect(names).toContain("Zaika Biryani");
    expect(names).toContain("Kolkata Biryani House");
  });

  it("keeps dishes ahead of restaurants at an equal match quality", () => {
    const names = rankSuggestions(INDEX, "biryani").map((s) => s.name);
    // "Chicken Biryani" (a dish) and "Zaika Biryani" (a restaurant) both match
    // on a word boundary; the dish wins the tie.
    expect(names.indexOf("Chicken Biryani")).toBeLessThan(names.indexOf("Zaika Biryani"));
  });

  it("finds a dish through a partially typed second word", () => {
    const names = rankSuggestions(INDEX, "chicken bir").map((s) => s.name);
    expect(names).toContain("Chicken Biryani");
  });

  it("honours the result limit", () => {
    expect(rankSuggestions(INDEX, "biryani", 2)).toHaveLength(2);
  });

  it("returns nothing when the campus sells no such thing", () => {
    expect(rankSuggestions(INDEX, "sushi")).toEqual([]);
  });
});

describe("restaurantIdsMatchingDish", () => {
  it("collects every kitchen whose menu carries a matching dish", () => {
    const ids = restaurantIdsMatchingDish(INDEX, "biryani");
    expect([...ids].sort()).toEqual(["r1", "r2", "r3"]);
  });

  it("finds a kitchen whose own name says nothing about the dish", () => {
    // Vrindavan Bhog cooks Veg Biryani but is not called a biryani place.
    expect(restaurantIdsMatchingDish(INDEX, "veg biryani").has("r3")).toBe(true);
  });

  it("is empty for a blank query", () => {
    expect(restaurantIdsMatchingDish(INDEX, "  ").size).toBe(0);
  });
});

describe("highlightParts", () => {
  it("splits out the typed prefix so it can be bolded", () => {
    expect(highlightParts("Biryani", "bir")).toEqual([
      { text: "Bir", match: true },
      { text: "yani", match: false },
    ]);
  });

  it("splits a match that starts mid-string", () => {
    expect(highlightParts("Chicken Biryani", "bir")).toEqual([
      { text: "Chicken ", match: false },
      { text: "Bir", match: true },
      { text: "yani", match: false },
    ]);
  });

  it("leaves the text whole when the match was not contiguous", () => {
    expect(highlightParts("Chicken Biryani", "chick bir")).toEqual([
      { text: "Chicken Biryani", match: false },
    ]);
  });
});
