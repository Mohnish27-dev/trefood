import { rupees } from "../money.js";
import type { IMenuCategory, IMenuItem } from "../types/index.js";

/**
 * A menu for NIT Canteen and Momo Junction, built to exercise every menu state:
 * veg and non-veg marks, add-on groups with min/max rules, and 86-ed items.
 *
 * Prices are chosen so the canonical ₹200 subtotal from
 * docs/MONEY_AND_SETTLEMENT.md §3 is reachable with a plausible cart:
 * Paneer Roll ₹80 × 1 + Veg Fried Rice ₹120 × 1 = ₹200.
 */

export const menuCategories: IMenuCategory[] = [
  { _id: "cat-rolls", restaurantId: "rest-nit-canteen", name: "Rolls", sortOrder: 1 },
  { _id: "cat-rice", restaurantId: "rest-nit-canteen", name: "Rice & Noodles", sortOrder: 2 },
  { _id: "cat-beverages", restaurantId: "rest-nit-canteen", name: "Beverages", sortOrder: 3 },
  { _id: "cat-momos", restaurantId: "rest-momo-junction", name: "Momos", sortOrder: 1 },
];

export const menuItems: IMenuItem[] = [
  {
    _id: "item-paneer-roll",
    restaurantId: "rest-nit-canteen",
    categoryId: "cat-rolls",
    name: "Paneer Roll",
    description: "Grilled paneer, onions, mint chutney, in a flaky paratha.",
    pricePaise: rupees(80),
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    addOnGroups: [
      {
        groupId: "grp-roll-spice",
        name: "Spice level",
        // Exactly one: the UI must block submission until a choice is made.
        minSelect: 1,
        maxSelect: 1,
        options: [
          { addOnId: "ao-mild", name: "Mild", pricePaise: rupees(0), isAvailable: true },
          { addOnId: "ao-medium", name: "Medium", pricePaise: rupees(0), isAvailable: true },
          { addOnId: "ao-hot", name: "Hot", pricePaise: rupees(0), isAvailable: true },
        ],
      },
      {
        groupId: "grp-roll-extras",
        name: "Add extras",
        // Optional, up to two: exercises the maxSelect path.
        minSelect: 0,
        maxSelect: 2,
        options: [
          { addOnId: "ao-cheese", name: "Extra cheese", pricePaise: rupees(20), isAvailable: true },
          { addOnId: "ao-paneer", name: "Extra paneer", pricePaise: rupees(30), isAvailable: true },
          // An unavailable ADD-ON, not just an unavailable item.
          { addOnId: "ao-butter", name: "Butter", pricePaise: rupees(10), isAvailable: false },
        ],
      },
    ],
  },
  {
    _id: "item-egg-roll",
    restaurantId: "rest-nit-canteen",
    categoryId: "cat-rolls",
    name: "Egg Roll",
    description: "Double egg, onions, green chilli.",
    pricePaise: rupees(70),
    isVeg: false,
    isAvailable: true,
    sortOrder: 2,
    addOnGroups: [],
  },
  {
    _id: "item-veg-fried-rice",
    restaurantId: "rest-nit-canteen",
    categoryId: "cat-rice",
    name: "Veg Fried Rice",
    description: "Wok-tossed with seasonal vegetables.",
    pricePaise: rupees(120),
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    addOnGroups: [],
  },
  {
    _id: "item-chicken-noodles",
    restaurantId: "rest-nit-canteen",
    categoryId: "cat-rice",
    name: "Chicken Hakka Noodles",
    pricePaise: rupees(140),
    isVeg: false,
    // 86-ed. MUST render struck through and still visible, never hidden.
    isAvailable: false,
    sortOrder: 2,
    addOnGroups: [],
  },
  {
    _id: "item-masala-chai",
    restaurantId: "rest-nit-canteen",
    categoryId: "cat-beverages",
    name: "Masala Chai",
    pricePaise: rupees(15),
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    addOnGroups: [],
  },
  {
    _id: "item-veg-momo",
    restaurantId: "rest-momo-junction",
    categoryId: "cat-momos",
    name: "Veg Steamed Momo (8 pcs)",
    pricePaise: rupees(60),
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    addOnGroups: [],
  },
  {
    _id: "item-chicken-momo",
    restaurantId: "rest-momo-junction",
    categoryId: "cat-momos",
    name: "Chicken Fried Momo (8 pcs)",
    pricePaise: rupees(90),
    isVeg: false,
    isAvailable: false,
    sortOrder: 2,
    addOnGroups: [],
  },
];
