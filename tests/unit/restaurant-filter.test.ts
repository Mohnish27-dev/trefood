import { describe, expect, it } from "vitest";
import {
  FOOD_TYPE_OPTIONS,
  matchesFoodType,
  getFoodTypeCounts,
} from "@/lib/restaurant-filter";

const MOCK_RESTAURANTS = [
  {
    name: "Prince Juice & Shakes Corner",
    cuisines: [
      "Fresh Juices",
      "Shakes",
      "Fresh Fruits",
      "Fruit Chaat",
      "Beverages",
      "Healthy Food",
    ],
    description:
      "Prince Juice & Shakes Corner - Special Thick Shakes, Cold-Pressed Fresh Juices, Sugarcane Juice, Fruit Chaat & Farm-Fresh Fruits by KG delivered to your hostel.",
  },
  {
    name: "Chai Sutta Bar (CSB)",
    cuisines: [
      "Chai",
      "Coffee",
      "Fast Food",
      "Snacks",
      "Beverages",
      "Pizza",
      "Burgers",
      "Shakes",
      "Momos",
      "Noodles",
    ],
    description: "CSB offers hot chai, shakes, burgers, pizzas, and snacks.",
  },
  {
    name: "Raj Darbar",
    cuisines: [
      "Fresh Fruits",
      "Fresh Juices",
      "Fast Food",
      "North Indian",
      "Bihari Thalis",
      "Biryani",
      "Rolls",
    ],
    description:
      "Raj Darbar - Exclusive campus provider of Farm-Fresh Fruits, Fresh Juices & Coconut Water alongside Homestyle Bihari Meals, Fast Food, Thalis, Rolls & Biryani.",
  },
  {
    name: "Kolkata Biryani Fast-Food Pizza House",
    cuisines: [
      "Biryani",
      "Rolls",
      "Fast Food",
      "Chinese",
      "Pizza",
      "Mughlai",
      "North Indian",
    ],
    description: "Kolkata Dum Biryani, Rolls, Fried Rice, Chowmein, and Pizzas.",
  },
  {
    name: "The Royal Bihar Restaurant",
    cuisines: [
      "North Indian",
      "Bihari",
      "Mughlai",
      "Biryani",
      "Chinese",
      "Tandoor",
      "Rolls",
      "Breads",
    ],
    description: "Authentic Bihari Dehati curries, Handi Mutton, Tandoori Kebabs.",
  },
  {
    name: "Sone Zone Cafe",
    cuisines: [
      "Cafe",
      "Beverages",
      "Fast Food",
      "North Indian",
      "Chinese",
      "Pizza",
      "South Indian",
      "Biryani",
      "Thalis",
    ],
    description: "Hot Tea, Shakes, Mocktails, Pizzas, Burgers, South Indian Dosas.",
  },
  {
    name: "Wrapchik Pizza",
    cuisines: [
      "Pizza",
      "Burgers",
      "Wraps",
      "Crispy Chicken",
      "Waffles",
      "Fries",
      "Beverages",
    ],
    description: "Gourmet Pizzas, Crispy Fried Chicken, Juicy Burgers, Loaded Wraps.",
  },
  {
    name: "Zaika Biryani & Rolls",
    cuisines: ["Biryani", "Mughlai"],
    description: "Authentic Dum Biryani and crispy rolls.",
  },
];

describe("matchesFoodType filter logic", () => {
  it("all filter matches all restaurants", () => {
    for (const r of MOCK_RESTAURANTS) {
      expect(matchesFoodType(r, "all")).toBe(true);
    }
  });

  it("fruits filter accurately matches fruit vendors", () => {
    const fruitVendors = MOCK_RESTAURANTS.filter((r) => matchesFoodType(r, "fruits"));
    const names = fruitVendors.map((r) => r.name);

    expect(names).toContain("Prince Juice & Shakes Corner");
    expect(names).toContain("Raj Darbar");
    expect(names).not.toContain("Kolkata Biryani Fast-Food Pizza House");
    expect(names).not.toContain("Wrapchik Pizza");
    expect(names).not.toContain("Zaika Biryani & Rolls");
    expect(names).toHaveLength(2);
  });

  it("juice_shakes filter matches juice, shake, and smoothie corners", () => {
    const juiceVendors = MOCK_RESTAURANTS.filter((r) => matchesFoodType(r, "juice_shakes"));
    const names = juiceVendors.map((r) => r.name);

    expect(names).toContain("Prince Juice & Shakes Corner");
    expect(names).toContain("Chai Sutta Bar (CSB)");
    expect(names).toContain("Raj Darbar");
    expect(names).toContain("Sone Zone Cafe");
    expect(names).not.toContain("Kolkata Biryani Fast-Food Pizza House");
    expect(names).not.toContain("Wrapchik Pizza");
    expect(names).not.toContain("The Royal Bihar Restaurant");
    expect(names).not.toContain("Zaika Biryani & Rolls");
    expect(names).toHaveLength(4);
  });

  it("food filter matches meal and savoury kitchens, excluding pure juice/fruit stalls", () => {
    const foodVendors = MOCK_RESTAURANTS.filter((r) => matchesFoodType(r, "food"));
    const names = foodVendors.map((r) => r.name);

    // Should include cooked food kitchens
    expect(names).toContain("Kolkata Biryani Fast-Food Pizza House");
    expect(names).toContain("Wrapchik Pizza");
    expect(names).toContain("The Royal Bihar Restaurant");
    expect(names).toContain("Zaika Biryani & Rolls");
    expect(names).toContain("Chai Sutta Bar (CSB)");
    expect(names).toContain("Raj Darbar");
    expect(names).toContain("Sone Zone Cafe");

    // Pure fruit & juice stall should NOT be in food
    expect(names).not.toContain("Prince Juice & Shakes Corner");
    expect(names).toHaveLength(7);
  });

  it("getFoodTypeCounts computes accurate summary counts", () => {
    const counts = getFoodTypeCounts(MOCK_RESTAURANTS);

    expect(counts).toEqual({
      all: 8,
      fruits: 2,
      juice_shakes: 4,
      food: 7,
    });
  });

  it("FOOD_TYPE_OPTIONS has the expected order: all, food, fruits, juices", () => {
    const ids = FOOD_TYPE_OPTIONS.map((opt) => opt.id);
    expect(ids).toEqual(["all", "food", "fruits", "juice_shakes"]);
  });
});
