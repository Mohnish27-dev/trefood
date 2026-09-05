/**
 * Wrapchik Pizza Onboarding & Menu Seeding Script.
 *
 * Seeds:
 * 1. The restaurant profile for Wrapchik Pizza
 * 2. The vendor account login (wrapchick10@gmail.com / Wrapchicktraefood@123)
 * 3. All categories and menu items (Veg & Non-Veg Pizzas with 5 sizes, Burgers, Wraps,
 *    Sides, Crispy Chicken, Waffles, Coolers, Buckets) transcribed from official menu photos.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-wrapchik.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise, type Paise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { AddOnGroup, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

const RESTAURANT_ID = "rest_wrapchik_nitp";
const VENDOR_USER_ID = "usr_wrapchik_vendor";
const VENDOR_EMAIL = "wrapchick10@gmail.com";

const R = rupeesToPaise;

function pizzaSizeGroup(prices: {
  small: Paise;
  regular: Paise;
  medium: Paise;
  large: Paise;
  zumbo: Paise;
}): AddOnGroup {
  return {
    id: "grp_pizza_size",
    name: "Pizza Size",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_size_s", name: "Small", pricePaise: 0, isAvailable: true },
      { id: "opt_size_r", name: "Regular", pricePaise: prices.regular - prices.small, isAvailable: true },
      { id: "opt_size_m", name: "Medium", pricePaise: prices.medium - prices.small, isAvailable: true },
      { id: "opt_size_l", name: "Large", pricePaise: prices.large - prices.small, isAvailable: true },
      { id: "opt_size_z", name: "Zumbo", pricePaise: prices.zumbo - prices.small, isAvailable: true },
    ],
  };
}

function extraCheeseGroup(extraPaise: Paise = R(40)): AddOnGroup {
  return {
    id: "grp_extra_cheese",
    name: "Cheese Customization",
    minSelect: 0,
    maxSelect: 1,
    options: [
      { id: "opt_extra_cheese", name: "Extra Cheese", pricePaise: extraPaise, isAvailable: true },
    ],
  };
}

function waffleToppingGroup(): AddOnGroup {
  return {
    id: "grp_waffle_topping",
    name: "Choice of Topping",
    minSelect: 0,
    maxSelect: 3,
    options: [
      { id: "opt_vanilla_top", name: "Vanilla Topping", pricePaise: R(30), isAvailable: true },
      { id: "opt_kitkat_top", name: "KitKat Topping", pricePaise: R(30), isAvailable: true },
      { id: "opt_oreo_top", name: "Oreo Crushed Topping", pricePaise: R(30), isAvailable: true },
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Categories
   ══════════════════════════════════════════════════════════════════════ */

const CATEGORIES: { id: string; name: string; sortOrder: number }[] = [
  { id: "cat_wp_veg_mania", name: "Veg Pizza - Mania", sortOrder: 1 },
  { id: "cat_wp_veg_special", name: "Veg Pizza - Special & Signature", sortOrder: 2 },
  { id: "cat_wp_nonveg_mania", name: "Non-Veg Pizza - Mania", sortOrder: 3 },
  { id: "cat_wp_nonveg_special", name: "Non-Veg Pizza - Special & Signature", sortOrder: 4 },
  { id: "cat_wp_pocket_pizza", name: "Pocket Pizzas", sortOrder: 5 },
  { id: "cat_wp_crispy_chicken", name: "Crispy & Boneless Chicken", sortOrder: 6 },
  { id: "cat_wp_burgers", name: "Burgers", sortOrder: 7 },
  { id: "cat_wp_wraps", name: "Wraps", sortOrder: 8 },
  { id: "cat_wp_fries_sides", name: "Fries & Sides", sortOrder: 9 },
  { id: "cat_wp_sandwiches_pasta", name: "Sandwiches & Pasta", sortOrder: 10 },
  { id: "cat_wp_waffles", name: "Waffles", sortOrder: 11 },
  { id: "cat_wp_coolers_shakes", name: "Coolers & Shakes", sortOrder: 12 },
  { id: "cat_wp_combos", name: "Buckets & Value Combos", sortOrder: 13 },
];

/* ══════════════════════════════════════════════════════════════════════
   Menu Items
   ══════════════════════════════════════════════════════════════════════ */

interface ItemDef {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  isVeg: boolean;
  pricePaise: Paise;
  isPopular?: boolean;
  addOnGroups?: AddOnGroup[];
  sortOrder: number;
}

const ITEMS: ItemDef[] = [
  // ── 1. VEG PIZZA - MANIA ─────────────────────────────────────────────
  // Single Mania (89 / 129 / 169 / 269 / 379)
  {
    id: "wp_cheese_onion_pizza",
    categoryId: "cat_wp_veg_mania",
    name: "Cheese Onion Pizza",
    description: "Indulge in the perfect harmony of gooey melted cheese and caramelized onions on a crispy crust.",
    isVeg: true,
    pricePaise: R(89),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(89), regular: R(129), medium: R(169), large: R(269), zumbo: R(379) }),
      extraCheeseGroup(),
    ],
    sortOrder: 1,
  },
  {
    id: "wp_cheese_capsicum_pizza",
    categoryId: "cat_wp_veg_mania",
    name: "Cheese Capsicum Pizza",
    description: "Crisp green capsicum and melted mozzarella on every slice.",
    isVeg: true,
    pricePaise: R(89),
    addOnGroups: [
      pizzaSizeGroup({ small: R(89), regular: R(129), medium: R(169), large: R(269), zumbo: R(379) }),
      extraCheeseGroup(),
    ],
    sortOrder: 2,
  },
  {
    id: "wp_cheese_tomato_pizza",
    categoryId: "cat_wp_veg_mania",
    name: "Cheese Tomato Pizza",
    description: "Tomato elegance and juicy red slices savoring tomato perfection.",
    isVeg: true,
    pricePaise: R(89),
    addOnGroups: [
      pizzaSizeGroup({ small: R(89), regular: R(129), medium: R(169), large: R(269), zumbo: R(379) }),
      extraCheeseGroup(),
    ],
    sortOrder: 3,
  },
  {
    id: "wp_cheese_corn_pizza",
    categoryId: "cat_wp_veg_mania",
    name: "Cheese Corn Pizza",
    description: "Golden sweet corn nuggets in blissful blend of cheese and herbs.",
    isVeg: true,
    pricePaise: R(89),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(89), regular: R(129), medium: R(169), large: R(269), zumbo: R(379) }),
      extraCheeseGroup(),
    ],
    sortOrder: 4,
  },
  {
    id: "wp_margherita_pizza",
    categoryId: "cat_wp_veg_mania",
    name: "Margherita Pizza",
    description: "Fall in love with every cheesy cascade on your slice.",
    isVeg: true,
    pricePaise: R(89),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(89), regular: R(129), medium: R(169), large: R(269), zumbo: R(379) }),
      extraCheeseGroup(),
    ],
    sortOrder: 5,
  },

  // Double Mania (99 / 139 / 179 / 279 / 399)
  {
    id: "wp_cheese_corn_onion_pizza",
    categoryId: "cat_wp_veg_mania",
    name: "Cheese Corn Onion Pizza",
    description: "Triple delight blend of cheese, golden corn and onions.",
    isVeg: true,
    pricePaise: R(99),
    addOnGroups: [
      pizzaSizeGroup({ small: R(99), regular: R(139), medium: R(179), large: R(279), zumbo: R(399) }),
      extraCheeseGroup(),
    ],
    sortOrder: 6,
  },
  {
    id: "wp_cheese_tomato_onion_pizza",
    categoryId: "cat_wp_veg_mania",
    name: "Cheese Tomato Onion Pizza",
    description: "Classic trio blend of cheese, fresh tomato and onion goodness.",
    isVeg: true,
    pricePaise: R(99),
    addOnGroups: [
      pizzaSizeGroup({ small: R(99), regular: R(139), medium: R(179), large: R(279), zumbo: R(399) }),
      extraCheeseGroup(),
    ],
    sortOrder: 7,
  },
  {
    id: "wp_cheese_capsicum_onion_pizza",
    categoryId: "cat_wp_veg_mania",
    name: "Cheese Capsicum Onion Pizza",
    description: "Crisp capsicum and onion symphony meeting melted cheese.",
    isVeg: true,
    pricePaise: R(99),
    addOnGroups: [
      pizzaSizeGroup({ small: R(99), regular: R(139), medium: R(179), large: R(279), zumbo: R(399) }),
      extraCheeseGroup(),
    ],
    sortOrder: 8,
  },
  {
    id: "wp_cheese_capsicum_tomato_pizza",
    categoryId: "cat_wp_veg_mania",
    name: "Cheese Capsicum Tomato Pizza",
    description: "Delightful medley of capsicum, tomato and cheese.",
    isVeg: true,
    pricePaise: R(99),
    addOnGroups: [
      pizzaSizeGroup({ small: R(99), regular: R(139), medium: R(179), large: R(279), zumbo: R(399) }),
      extraCheeseGroup(),
    ],
    sortOrder: 9,
  },

  // ── 2. VEG PIZZA - SPECIAL & SIGNATURE ───────────────────────────────
  // Special Pizza (109 / 159 / 259 / 359 / 429)
  {
    id: "wp_fresh_veggie_pizza",
    categoryId: "cat_wp_veg_special",
    name: "Fresh Veggie Pizza",
    description: "Harmony of onion, capsicum, and tomato goodness.",
    isVeg: true,
    pricePaise: R(109),
    addOnGroups: [
      pizzaSizeGroup({ small: R(109), regular: R(159), medium: R(259), large: R(359), zumbo: R(429) }),
      extraCheeseGroup(),
    ],
    sortOrder: 1,
  },
  {
    id: "wp_paneer_paradise_pizza",
    categoryId: "cat_wp_veg_special",
    name: "Paneer Paradise Pizza",
    description: "A burst of texture with onion, capsicum, tomato, and fresh paneer cubes.",
    isVeg: true,
    pricePaise: R(109),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(109), regular: R(159), medium: R(259), large: R(359), zumbo: R(429) }),
      extraCheeseGroup(),
    ],
    sortOrder: 2,
  },
  {
    id: "wp_spicy_senorita_pizza",
    categoryId: "cat_wp_veg_special",
    name: "Spicy Senorita Pizza",
    description: "Onion, mushroom, red paprika - the perfect trio of spice.",
    isVeg: true,
    pricePaise: R(109),
    addOnGroups: [
      pizzaSizeGroup({ small: R(109), regular: R(159), medium: R(259), large: R(359), zumbo: R(429) }),
      extraCheeseGroup(),
    ],
    sortOrder: 3,
  },
  {
    id: "wp_farmers_pick_pizza",
    categoryId: "cat_wp_veg_special",
    name: "Farmers Pick Pizza",
    description: "Onion, capsicum, tomato, paneer, and jalapeno extravaganza.",
    isVeg: true,
    pricePaise: R(109),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(109), regular: R(159), medium: R(259), large: R(359), zumbo: R(429) }),
      extraCheeseGroup(),
    ],
    sortOrder: 4,
  },

  // Signature Pizza (119 / 169 / 289 / 389 / 499)
  {
    id: "wp_veggie_paradise_pizza",
    categoryId: "cat_wp_veg_special",
    name: "Veggie Paradise Pizza",
    description: "Golden corn, black olives, capsicum, and red paprika.",
    isVeg: true,
    pricePaise: R(119),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(119), regular: R(169), medium: R(289), large: R(389), zumbo: R(499) }),
      extraCheeseGroup(),
    ],
    sortOrder: 5,
  },
  {
    id: "wp_wrapchik_special_pizza",
    categoryId: "cat_wp_veg_special",
    name: "Wrapchik Special Veg Pizza",
    description: "Burst of texture with onion, capsicum, tomato, paneer, corn and mushroom.",
    isVeg: true,
    pricePaise: R(119),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(119), regular: R(169), medium: R(289), large: R(389), zumbo: R(499) }),
      extraCheeseGroup(),
    ],
    sortOrder: 6,
  },
  {
    id: "wp_supreme_veg_pizza",
    categoryId: "cat_wp_veg_special",
    name: "Supreme Veg Pizza",
    description: "Timeless blend of cheese, tomato, onion, capsicum, golden corn, black olive, red paprika and paneer.",
    isVeg: true,
    pricePaise: R(119),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(119), regular: R(169), medium: R(289), large: R(389), zumbo: R(499) }),
      extraCheeseGroup(),
    ],
    sortOrder: 7,
  },

  // ── 3. NON-VEG PIZZA - MANIA ─────────────────────────────────────────
  // Non-Veg Single Mania (109 / 139 / 179 / 289 / 399)
  {
    id: "wp_chicken_onion_pizza",
    categoryId: "cat_wp_nonveg_mania",
    name: "Chicken Onion Pizza",
    description: "Caramelized onions and savory chicken chunks on crispy crust.",
    isVeg: false,
    pricePaise: R(109),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(109), regular: R(139), medium: R(179), large: R(289), zumbo: R(399) }),
      extraCheeseGroup(),
    ],
    sortOrder: 1,
  },
  {
    id: "wp_chicken_capsicum_pizza",
    categoryId: "cat_wp_nonveg_mania",
    name: "Chicken Capsicum Pizza",
    description: "Capsicum and seasoned chicken with melted mozzarella.",
    isVeg: false,
    pricePaise: R(109),
    addOnGroups: [
      pizzaSizeGroup({ small: R(109), regular: R(139), medium: R(179), large: R(289), zumbo: R(399) }),
      extraCheeseGroup(),
    ],
    sortOrder: 2,
  },
  {
    id: "wp_chicken_tomato_pizza",
    categoryId: "cat_wp_nonveg_mania",
    name: "Chicken Tomato Pizza",
    description: "Juicy tomatoes paired with grilled chicken chunks.",
    isVeg: false,
    pricePaise: R(109),
    addOnGroups: [
      pizzaSizeGroup({ small: R(109), regular: R(139), medium: R(179), large: R(289), zumbo: R(399) }),
      extraCheeseGroup(),
    ],
    sortOrder: 3,
  },
  {
    id: "wp_chicken_corn_pizza",
    categoryId: "cat_wp_nonveg_mania",
    name: "Chicken Corn Pizza",
    description: "Golden sweet corn kernels and tender chicken pieces.",
    isVeg: false,
    pricePaise: R(109),
    addOnGroups: [
      pizzaSizeGroup({ small: R(109), regular: R(139), medium: R(179), large: R(289), zumbo: R(399) }),
      extraCheeseGroup(),
    ],
    sortOrder: 4,
  },
  {
    id: "wp_cheesy_chicken_pizza",
    categoryId: "cat_wp_nonveg_mania",
    name: "Cheesy Chicken Pizza",
    description: "Rich cheesy cascade topped with flavorful chicken chunks.",
    isVeg: false,
    pricePaise: R(109),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(109), regular: R(139), medium: R(179), large: R(289), zumbo: R(399) }),
      extraCheeseGroup(),
    ],
    sortOrder: 5,
  },

  // Non-Veg Double Mania (119 / 159 / 199 / 299 / 409)
  {
    id: "wp_chicken_corn_onion_pizza",
    categoryId: "cat_wp_nonveg_mania",
    name: "Chicken Corn Onion Pizza",
    description: "Triple delight of chicken, corn, and onion.",
    isVeg: false,
    pricePaise: R(119),
    addOnGroups: [
      pizzaSizeGroup({ small: R(119), regular: R(159), medium: R(199), large: R(299), zumbo: R(409) }),
      extraCheeseGroup(),
    ],
    sortOrder: 6,
  },
  {
    id: "wp_chicken_tomato_onion_pizza",
    categoryId: "cat_wp_nonveg_mania",
    name: "Chicken Tomato Onion Pizza",
    description: "Classic trio of chicken, cheese, tomato, and onion goodness.",
    isVeg: false,
    pricePaise: R(119),
    addOnGroups: [
      pizzaSizeGroup({ small: R(119), regular: R(159), medium: R(199), large: R(299), zumbo: R(409) }),
      extraCheeseGroup(),
    ],
    sortOrder: 7,
  },
  {
    id: "wp_chicken_capsicum_onion_pizza",
    categoryId: "cat_wp_nonveg_mania",
    name: "Chicken Capsicum Onion Pizza",
    description: "Capsicum and chicken symphony with diced onions.",
    isVeg: false,
    pricePaise: R(119),
    addOnGroups: [
      pizzaSizeGroup({ small: R(119), regular: R(159), medium: R(199), large: R(299), zumbo: R(409) }),
      extraCheeseGroup(),
    ],
    sortOrder: 8,
  },
  {
    id: "wp_chicken_capsicum_tomato_pizza",
    categoryId: "cat_wp_nonveg_mania",
    name: "Chicken Capsicum Tomato Pizza",
    description: "Tender chicken, capsicum and tomato loaded pizza.",
    isVeg: false,
    pricePaise: R(119),
    addOnGroups: [
      pizzaSizeGroup({ small: R(119), regular: R(159), medium: R(199), large: R(299), zumbo: R(409) }),
      extraCheeseGroup(),
    ],
    sortOrder: 9,
  },

  // ── 4. NON-VEG PIZZA - SPECIAL & SIGNATURE ───────────────────────────
  // Non-Veg Special (129 / 169 / 269 / 379 / 429)
  {
    id: "wp_chicken_veggie_pizza",
    categoryId: "cat_wp_nonveg_special",
    name: "Chicken Veggie Pizza",
    description: "Harmony of onion, capsicum, tomato and chicken.",
    isVeg: false,
    pricePaise: R(129),
    addOnGroups: [
      pizzaSizeGroup({ small: R(129), regular: R(169), medium: R(269), large: R(379), zumbo: R(429) }),
      extraCheeseGroup(),
    ],
    sortOrder: 1,
  },
  {
    id: "wp_chicken_paradise_pizza",
    categoryId: "cat_wp_nonveg_special",
    name: "Chicken Paradise Pizza",
    description: "Burst of texture with onion, capsicum, tomato and chicken.",
    isVeg: false,
    pricePaise: R(129),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(129), regular: R(169), medium: R(269), large: R(379), zumbo: R(429) }),
      extraCheeseGroup(),
    ],
    sortOrder: 2,
  },
  {
    id: "wp_chicken_spicy_senorita_pizza",
    categoryId: "cat_wp_nonveg_special",
    name: "Chicken Spicy Senorita Pizza",
    description: "Onion, mushroom, red paprika, and chicken - spicy delight.",
    isVeg: false,
    pricePaise: R(129),
    addOnGroups: [
      pizzaSizeGroup({ small: R(129), regular: R(169), medium: R(269), large: R(379), zumbo: R(429) }),
      extraCheeseGroup(),
    ],
    sortOrder: 3,
  },
  {
    id: "wp_chicken_farmers_pick_pizza",
    categoryId: "cat_wp_nonveg_special",
    name: "Chicken Farmers Pick Pizza",
    description: "Onion, capsicum, tomato, paneer, chicken and jalapeno extravaganza.",
    isVeg: false,
    pricePaise: R(129),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(129), regular: R(169), medium: R(269), large: R(379), zumbo: R(429) }),
      extraCheeseGroup(),
    ],
    sortOrder: 4,
  },

  // Non-Veg Signature (139 / 179 / 299 / 399 / 499)
  {
    id: "wp_chicken_paprika_pizza",
    categoryId: "cat_wp_nonveg_special",
    name: "Chicken Paprika Pizza",
    description: "Golden corn, black olives, capsicum, red paprika and chicken.",
    isVeg: false,
    pricePaise: R(139),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(139), regular: R(179), medium: R(299), large: R(399), zumbo: R(499) }),
      extraCheeseGroup(),
    ],
    sortOrder: 5,
  },
  {
    id: "wp_wrapchik_special_chicken_pizza",
    categoryId: "cat_wp_nonveg_special",
    name: "Wrapchik Special Chicken Pizza",
    description: "Burst of texture with onion, capsicum, tomato, paneer, corn, mushroom and chicken.",
    isVeg: false,
    pricePaise: R(139),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(139), regular: R(179), medium: R(299), large: R(399), zumbo: R(499) }),
      extraCheeseGroup(),
    ],
    sortOrder: 6,
  },
  {
    id: "wp_supreme_chicken_pizza",
    categoryId: "cat_wp_nonveg_special",
    name: "Supreme Chicken Pizza",
    description: "Timeless blend of cheese, tomato, onion, capsicum, golden corn, black olive, red paprika and chicken.",
    isVeg: false,
    pricePaise: R(139),
    isPopular: true,
    addOnGroups: [
      pizzaSizeGroup({ small: R(139), regular: R(179), medium: R(299), large: R(399), zumbo: R(499) }),
      extraCheeseGroup(),
    ],
    sortOrder: 7,
  },

  // ── 5. POCKET PIZZAS ─────────────────────────────────────────────────
  {
    id: "wp_pocket_cheese_onion",
    categoryId: "cat_wp_pocket_pizza",
    name: "Cheese Onion Pocket Pizza",
    description: "Folded calzone pocket stuffed with cheese and onions.",
    isVeg: true,
    pricePaise: R(69),
    sortOrder: 1,
  },
  {
    id: "wp_pocket_cheese_capsicum",
    categoryId: "cat_wp_pocket_pizza",
    name: "Cheese Capsicum Pocket Pizza",
    description: "Cheesy pocket filled with crunchy capsicum.",
    isVeg: true,
    pricePaise: R(69),
    sortOrder: 2,
  },
  {
    id: "wp_pocket_cheese_tomato",
    categoryId: "cat_wp_pocket_pizza",
    name: "Cheese Tomato Pocket Pizza",
    description: "Hot pocket filled with juicy tomatoes and mozzarella.",
    isVeg: true,
    pricePaise: R(69),
    sortOrder: 3,
  },
  {
    id: "wp_pocket_chicken_tomato",
    categoryId: "cat_wp_pocket_pizza",
    name: "Chicken Tomato Pocket Pizza",
    description: "Pocket calzone stuffed with chicken and tomatoes.",
    isVeg: false,
    pricePaise: R(99),
    sortOrder: 4,
  },
  {
    id: "wp_pocket_chicken_capsicum",
    categoryId: "cat_wp_pocket_pizza",
    name: "Chicken Capsicum Pocket Pizza",
    description: "Folded pocket pizza with chicken and green capsicum.",
    isVeg: false,
    pricePaise: R(99),
    sortOrder: 5,
  },
  {
    id: "wp_pocket_chicken_onion",
    categoryId: "cat_wp_pocket_pizza",
    name: "Chicken Onion Pocket Pizza",
    description: "Hot pocket filled with savory chicken and caramelized onions.",
    isVeg: false,
    pricePaise: R(99),
    isPopular: true,
    sortOrder: 6,
  },

  // ── 6. CRISPY & BONELESS CHICKEN ─────────────────────────────────────
  {
    id: "wp_chicken_crispy_lollipop",
    categoryId: "cat_wp_crispy_chicken",
    name: "Chicken Crispy Lollipop (5 Pcs)",
    description: "Signature crispy frenched chicken lollipops.",
    isVeg: false,
    pricePaise: R(230),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "wp_chicken_crispy_wings",
    categoryId: "cat_wp_crispy_chicken",
    name: "Chicken Crispy Wings (6 Pcs)",
    description: "Crispy goodness of signature fried wings.",
    isVeg: false,
    pricePaise: R(200),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "wp_chicken_crispy_leg_1pc",
    categoryId: "cat_wp_crispy_chicken",
    name: "Chicken Crispy Leg (1 Pc)",
    description: "Perfect golden fried crispy chicken drumstick.",
    isVeg: false,
    pricePaise: R(85),
    sortOrder: 3,
  },
  {
    id: "wp_chicken_crispy_leg_2pc",
    categoryId: "cat_wp_crispy_chicken",
    name: "Chicken Crispy Leg (2 Pcs)",
    description: "Two pieces of golden fried crispy chicken legs.",
    isVeg: false,
    pricePaise: R(160),
    isPopular: true,
    sortOrder: 4,
  },
  {
    id: "wp_chicken_crispy_leg_3pc",
    categoryId: "cat_wp_crispy_chicken",
    name: "Chicken Crispy Leg (3 Pcs)",
    description: "Three pieces of crispy seasoned chicken legs.",
    isVeg: false,
    pricePaise: R(250),
    isPopular: true,
    sortOrder: 5,
  },
  {
    id: "wp_chicken_crispy_popcorn",
    categoryId: "cat_wp_crispy_chicken",
    name: "Chicken Crispy Popcorn",
    description: "Bite-sized irresistible crunchy fried chicken popcorn.",
    isVeg: false,
    pricePaise: R(130),
    isPopular: true,
    sortOrder: 6,
  },
  {
    id: "wp_chicken_crispy_strips",
    categoryId: "cat_wp_crispy_chicken",
    name: "Chicken Crispy Strips (6 Pcs)",
    description: "Tender boneless chicken strips fried to a golden crunch.",
    isVeg: false,
    pricePaise: R(180),
    sortOrder: 7,
  },
  {
    id: "wp_chicken_crispy_nuggets",
    categoryId: "cat_wp_crispy_chicken",
    name: "Chicken Crispy Nuggets (8 Pcs)",
    description: "Golden fried chicken nuggets with dipping sauce.",
    isVeg: false,
    pricePaise: R(170),
    sortOrder: 8,
  },

  // ── 7. BURGERS ───────────────────────────────────────────────────────
  {
    id: "wp_aloo_tikki_burger",
    categoryId: "cat_wp_burgers",
    name: "Aloo Tikki Burger",
    description: "Crispy potato patty burger with signature herbs.",
    isVeg: true,
    pricePaise: R(49),
    sortOrder: 1,
  },
  {
    id: "wp_cheese_aloo_tikki_burger",
    categoryId: "cat_wp_burgers",
    name: "Cheese Aloo Tikki Burger",
    description: "Aloo tikki patty topped with melted cheese slice.",
    isVeg: true,
    pricePaise: R(70),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "wp_veggie_decar_burger",
    categoryId: "cat_wp_burgers",
    name: "Veggie Decar Burger",
    description: "Mixed vegetable patty with fresh lettuce and mayo.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 3,
  },
  {
    id: "wp_cheese_veggie_decar_burger",
    categoryId: "cat_wp_burgers",
    name: "Cheese Veggie Decar Burger",
    description: "Veggie patty layered with rich cheese slice.",
    isVeg: true,
    pricePaise: R(90),
    sortOrder: 4,
  },
  {
    id: "wp_paneer_feast_burger",
    categoryId: "cat_wp_burgers",
    name: "Paneer Feast Burger",
    description: "Crispy aloo tikki & paneer nestled in a cheesy bun.",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    sortOrder: 5,
  },
  {
    id: "wp_cheese_paneer_feast_burger",
    categoryId: "cat_wp_burgers",
    name: "Cheese Paneer Feast Burger",
    description: "Paneer patty with double cheese layer.",
    isVeg: true,
    pricePaise: R(150),
    sortOrder: 6,
  },
  {
    id: "wp_maharaja_aloo_tikki_burger",
    categoryId: "cat_wp_burgers",
    name: "Maharaja Aloo Tikki Burger",
    description: "Double patty giant burger in a cheesy bun.",
    isVeg: true,
    pricePaise: R(180),
    sortOrder: 7,
  },
  {
    id: "wp_maharaja_paneer_feast_burger",
    categoryId: "cat_wp_burgers",
    name: "Maharaja Paneer Feast Burger",
    description: "Double patty aloo tikki & paneer feast.",
    isVeg: true,
    pricePaise: R(220),
    isPopular: true,
    sortOrder: 8,
  },
  {
    id: "wp_classic_chicken_burger",
    categoryId: "cat_wp_burgers",
    name: "Classic Chicken Burger",
    description: "Crispy chicken patty with lettuce and mayo.",
    isVeg: false,
    pricePaise: R(110),
    isPopular: true,
    sortOrder: 9,
  },
  {
    id: "wp_chicken_cheese_burger",
    categoryId: "cat_wp_burgers",
    name: "Chicken Cheese Burger",
    description: "Crispy chicken patty with cheese slice.",
    isVeg: false,
    pricePaise: R(130),
    isPopular: true,
    sortOrder: 10,
  },
  {
    id: "wp_maharaja_chicken_burger",
    categoryId: "cat_wp_burgers",
    name: "Maharaja Chicken Burger",
    description: "Double patty giant crispy chicken burger.",
    isVeg: false,
    pricePaise: R(180),
    isPopular: true,
    sortOrder: 11,
  },

  // ── 8. WRAPS ─────────────────────────────────────────────────────────
  {
    id: "wp_aloo_delight_wrap",
    categoryId: "cat_wp_wraps",
    name: "Aloo Delight Wrap",
    description: "Crispy seasoned potato wrap with tangy sauces.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 1,
  },
  {
    id: "wp_cheese_aloo_delight_wrap",
    categoryId: "cat_wp_wraps",
    name: "Cheese Aloo Delight Wrap",
    description: "Aloo wrap loaded with melted cheese.",
    isVeg: true,
    pricePaise: R(90),
    sortOrder: 2,
  },
  {
    id: "wp_paneer_wrap",
    categoryId: "cat_wp_wraps",
    name: "Paneer Wrap",
    description: "Fresh cottage cheese wrap with minty salad.",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "wp_cheese_paneer_wrap",
    categoryId: "cat_wp_wraps",
    name: "Cheese Paneer Wrap",
    description: "Paneer wrap layered with gooey cheese.",
    isVeg: true,
    pricePaise: R(120),
    sortOrder: 4,
  },
  {
    id: "wp_tangy_wrap",
    categoryId: "cat_wp_wraps",
    name: "Tangy Wrap",
    description: "Symphony of spiced potatoes and paneer with Thousand Island dressing.",
    isVeg: true,
    pricePaise: R(130),
    isPopular: true,
    sortOrder: 5,
  },
  {
    id: "wp_chicken_lemon_peri_wrap",
    categoryId: "cat_wp_wraps",
    name: "Chicken Lemon Peri Delight Wrap",
    description: "Crispy chicken with zesty lemon peri-peri sauce.",
    isVeg: false,
    pricePaise: R(90),
    sortOrder: 6,
  },
  {
    id: "wp_cheesy_lemon_peri_wrap",
    categoryId: "cat_wp_wraps",
    name: "Cheesy Lemon Peri Delight Wrap",
    description: "Chicken lemon peri wrap loaded with cheese.",
    isVeg: false,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 7,
  },
  {
    id: "wp_chicken_garlic_peri_wrap",
    categoryId: "cat_wp_wraps",
    name: "Chicken Garlic Peri Delight Wrap",
    description: "Spicy roasted garlic peri-peri chicken wrap.",
    isVeg: false,
    pricePaise: R(130),
    sortOrder: 8,
  },
  {
    id: "wp_cheesy_garlic_peri_wrap",
    categoryId: "cat_wp_wraps",
    name: "Cheesy Garlic Peri Delight Wrap",
    description: "Chicken garlic peri wrap with extra cheese.",
    isVeg: false,
    pricePaise: R(140),
    sortOrder: 9,
  },
  {
    id: "wp_bomby_chicken_ball_wrap",
    categoryId: "cat_wp_wraps",
    name: "Bomby Chicken Ball Cheese Wrap",
    description: "Crispy chicken meatballs wrapped with Thousand Island and mayo.",
    isVeg: false,
    pricePaise: R(150),
    isPopular: true,
    sortOrder: 10,
  },

  // ── 9. FRIES & SIDES ─────────────────────────────────────────────────
  {
    id: "wp_salted_fries",
    categoryId: "cat_wp_fries_sides",
    name: "Salted French Fries",
    description: "Crispy salted golden potato fries.",
    isVeg: true,
    pricePaise: R(70),
    sortOrder: 1,
  },
  {
    id: "wp_peri_peri_fries",
    categoryId: "cat_wp_fries_sides",
    name: "Peri Peri French Fries",
    description: "A symphony of peri-peri spices on golden fries.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "wp_cheesy_fries",
    categoryId: "cat_wp_fries_sides",
    name: "Cheesy French Fries",
    description: "Golden fries smothered with melted cheese sauce.",
    isVeg: true,
    pricePaise: R(100),
    sortOrder: 3,
  },
  {
    id: "wp_tangy_fries",
    categoryId: "cat_wp_fries_sides",
    name: "Tangy French Fries",
    description: "Fries with Thousand Island, mayo, and cheese.",
    isVeg: true,
    pricePaise: R(120),
    sortOrder: 4,
  },
  {
    id: "wp_garlic_breadsticks",
    categoryId: "cat_wp_fries_sides",
    name: "Garlic Breadsticks",
    description: "Endearing tang of garlic in breadsticks baked to perfection.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 5,
  },
  {
    id: "wp_stuffed_garlic_bread",
    categoryId: "cat_wp_fries_sides",
    name: "Stuffed Garlic Bread",
    description: "Freshly baked garlic bread stuffed with mozzarella, sweet corn & spicy jalapenos.",
    isVeg: true,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 6,
  },
  {
    id: "wp_paneer_tikka_stuffed_garlic_bread",
    categoryId: "cat_wp_fries_sides",
    name: "Paneer Tikka Stuffed Garlic Bread",
    description: "Stuffed with cheese, onion and paneer tikka with basil parsley sprinkle.",
    isVeg: true,
    pricePaise: R(170),
    isPopular: true,
    sortOrder: 7,
  },

  // ── 10. SANDWICHES & PASTA ───────────────────────────────────────────
  {
    id: "wp_veg_sandwich",
    categoryId: "cat_wp_sandwiches_pasta",
    name: "Veg Sandwich",
    description: "Crisp and crunchy fresh vegetable sandwich.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 1,
  },
  {
    id: "wp_veg_cheesy_sandwich",
    categoryId: "cat_wp_sandwiches_pasta",
    name: "Veg Cheesy Sandwich",
    description: "Bounty of fresh vegetables with melted cheese.",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "wp_sandwich_combo",
    categoryId: "cat_wp_sandwiches_pasta",
    name: "Sandwich Combo",
    description: "Cheesy sandwich served with peri-peri french fries.",
    isVeg: true,
    pricePaise: R(160),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "wp_white_sauce_pasta",
    categoryId: "cat_wp_sandwiches_pasta",
    name: "White Sauce Pasta",
    description: "Al dente pasta bathed in luscious white sauce.",
    isVeg: true,
    pricePaise: R(110),
    sortOrder: 4,
  },
  {
    id: "wp_corn_cheese_pasta",
    categoryId: "cat_wp_sandwiches_pasta",
    name: "Corn Cheese Pasta",
    description: "Savory fusion of sweet corn and melted cheese in creamy pasta.",
    isVeg: true,
    pricePaise: R(130),
    isPopular: true,
    sortOrder: 5,
  },

  // ── 11. WAFFLES ──────────────────────────────────────────────────────
  {
    id: "wp_dark_chocolate_waffle",
    categoryId: "cat_wp_waffles",
    name: "Dark Chocolate Waffle",
    description: "Crispy Belgian waffle coated in rich dark chocolate.",
    isVeg: true,
    pricePaise: R(139),
    addOnGroups: [waffleToppingGroup()],
    sortOrder: 1,
  },
  {
    id: "wp_milk_chocolate_waffle",
    categoryId: "cat_wp_waffles",
    name: "Milk Chocolate Waffle",
    description: "Sweet milk chocolate spread over warm waffle.",
    isVeg: true,
    pricePaise: R(139),
    addOnGroups: [waffleToppingGroup()],
    sortOrder: 2,
  },
  {
    id: "wp_black_white_chocolate_waffle",
    categoryId: "cat_wp_waffles",
    name: "Black & White Chocolate Waffle",
    description: "Dual swirl of dark and white melted chocolate.",
    isVeg: true,
    pricePaise: R(159),
    isPopular: true,
    addOnGroups: [waffleToppingGroup()],
    sortOrder: 3,
  },
  {
    id: "wp_triple_chocolate_waffle",
    categoryId: "cat_wp_waffles",
    name: "Triple Chocolate Waffle",
    description: "Cocoa dream delight with milk, dark and white chocolate blend.",
    isVeg: true,
    pricePaise: R(179),
    isPopular: true,
    addOnGroups: [waffleToppingGroup()],
    sortOrder: 4,
  },

  // ── 12. COOLERS & SHAKES ─────────────────────────────────────────────
  {
    id: "wp_masala_coke",
    categoryId: "cat_wp_coolers_shakes",
    name: "Masala Coke",
    description: "Excitement of signature masala spiced Coca-Cola.",
    isVeg: true,
    pricePaise: R(70),
    sortOrder: 1,
  },
  {
    id: "wp_blue_lagoon",
    categoryId: "cat_wp_coolers_shakes",
    name: "Blue Lagoon",
    description: "Tropical citrus cooler invoking ocean breeze.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 2,
  },
  {
    id: "wp_virgin_mojito",
    categoryId: "cat_wp_coolers_shakes",
    name: "Virgin Mojito",
    description: "Zing of fresh lime and mint in bubbly soda.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "wp_kitkat_shake",
    categoryId: "cat_wp_coolers_shakes",
    name: "KitKat Shake",
    description: "Thick shake with tempting twist of KitKat bars.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 4,
  },
  {
    id: "wp_oreo_shake",
    categoryId: "cat_wp_coolers_shakes",
    name: "Oreo Shake",
    description: "Creamy goodness with Oreo magic in every sip.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 5,
  },
  {
    id: "wp_cold_coffee",
    categoryId: "cat_wp_coolers_shakes",
    name: "Cold Coffee",
    description: "Classic revitalizing chilled coffee.",
    isVeg: true,
    pricePaise: R(90),
    sortOrder: 6,
  },
  {
    id: "wp_choco_overload",
    categoryId: "cat_wp_coolers_shakes",
    name: "Choco Overload",
    description: "Bold chocolate meets the blissful chill of cold coffee.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 7,
  },

  // ── 13. BUCKETS & VALUE COMBOS ───────────────────────────────────────
  {
    id: "wp_burger_magic_combo",
    categoryId: "cat_wp_combos",
    name: "Burger Magic Combo (Veg)",
    description: "Any Veg Burger + Peri Peri Fries + 250ml Cold Drink.",
    isVeg: true,
    pricePaise: R(195),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "wp_wrap_magic_combo",
    categoryId: "cat_wp_combos",
    name: "Wrap Magic Combo (Veg)",
    description: "Any Veg Wrap + Peri Peri Fries + 250ml Cold Drink.",
    isVeg: true,
    pricePaise: R(199),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "wp_pizza_magic_combo",
    categoryId: "cat_wp_combos",
    name: "Pizza Magic Combo (Veg)",
    description: "Any Veg Small Pizza + Peri Peri Fries + 250ml Cold Drink.",
    isVeg: true,
    pricePaise: R(199),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "wp_duo_combo_chicken",
    categoryId: "cat_wp_combos",
    name: "Duo Combo (Non-Veg)",
    description: "3 Crispy Chicken Legs, 3 Chicken Strips, 2 Cold Drinks (250ml), 2 Dips.",
    isVeg: false,
    pricePaise: R(370),
    isPopular: true,
    sortOrder: 4,
  },
  {
    id: "wp_big_8_chicken",
    categoryId: "cat_wp_combos",
    name: "Big 8 Bucket (Non-Veg)",
    description: "4 Crispy Chicken Lollipops, 4 Crispy Wings, 2 Dips.",
    isVeg: false,
    pricePaise: R(330),
    sortOrder: 5,
  },
  {
    id: "wp_big_12_chicken",
    categoryId: "cat_wp_combos",
    name: "Big 12 Bucket (Non-Veg)",
    description: "6 Crispy Chicken Lollipops, 6 Crispy Wings, 2 Dips.",
    isVeg: false,
    pricePaise: R(400),
    isPopular: true,
    sortOrder: 6,
  },
  {
    id: "wp_5pcs_leg_bucket",
    categoryId: "cat_wp_combos",
    name: "5 Pcs Leg Bucket (Non-Veg)",
    description: "5 Crispy Chicken Legs, 1 Peri Peri Fries, 2 Cold Drinks (250ml), 2 Dips.",
    isVeg: false,
    pricePaise: R(540),
    isPopular: true,
    sortOrder: 7,
  },
  {
    id: "wp_wrapchik_special_bucket",
    categoryId: "cat_wp_combos",
    name: "Wrapchik Special Bucket",
    description: "2 Crispy Chicken Legs, 1 Classic Chicken Burger, 1 Lemon Peri Wrap, 2 Dips.",
    isVeg: false,
    pricePaise: R(390),
    isPopular: true,
    sortOrder: 8,
  },
  {
    id: "wp_chicken_krisper_meal",
    categoryId: "cat_wp_combos",
    name: "Chicken Krisper Meal",
    description: "2 Classic Chicken Burgers, 1 Peri Peri Fries, 2 Dips.",
    isVeg: false,
    pricePaise: R(340),
    isPopular: true,
    sortOrder: 9,
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Main Seed Runner
   ══════════════════════════════════════════════════════════════════════ */

export async function seedWrapchik(): Promise<void> {
  console.log("=== Onboarding Wrapchik Pizza ===");

  const campusesCollection = await db.campuses();
  const campus = await campusesCollection.findOne({ _id: CAMPUS_ID });
  if (!campus) {
    throw new Error(`Campus "${CAMPUS_ID}" not found. Run "npm run seed" first.`);
  }

  const now = new Date();
  const servedZoneIds = campus.zones.map((z) => z.id);

  // 1. Upsert Restaurant
  const restaurant: Restaurant = {
    _id: RESTAURANT_ID,
    campusId: CAMPUS_ID,
    slug: "wrapchik-pizza",
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
    phone: "9876543210",
    description:
      "Wrapchik Pizza - Gourmet Pizzas, Crispy Fried Chicken, Juicy Burgers, Loaded Wraps, Waffles & Coolers. Deliveries after 7 PM are handled personally by the owner/co-owner for campus safety.",
    imageUrl: null,
    bannerUrl: null,
    packagingFeePaise: R(10),
    minOrderPaise: R(50),
    prepMinutes: 15,
    foodGstBps: 0,
    commissionBpsOverride: null,
    servedZoneIds,
    opensMinutes: 10 * 60, // 10:00 AM
    closesMinutes: 23 * 60, // 11:00 PM
    isOpen: true,
    isApproved: true,
    rating: 4.7,
    ratingCount: 42,
    kyc: {
      status: "APPROVED",
      ownerName: "Wrapchik Manager",
      ownerPhone: "9876543210",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Wrapchik Pizza",
      accountNumber: "987654321000",
      ifsc: "SBIN0001234",
      upiId: "wrapchik@upi",
    },
    expiryCountToday: 0,
    autoClosedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const restaurantsCollection = await db.restaurants();
  await restaurantsCollection.replaceOne({ _id: RESTAURANT_ID }, restaurant, { upsert: true });
  console.log(`[x] Restaurant "${restaurant.name}" created/updated.`);

  // 2. Upsert Vendor Account
  const usersCollection = await db.users();
  const vendorUser: User = {
    _id: VENDOR_USER_ID,
    authId: null,
    role: ROLE.VENDOR_OWNER,
    name: "Wrapchik Manager",
    email: VENDOR_EMAIL,
    phone: "9876543210",
    passwordHash: hashPassword("Wrapchicktraefood@123"),
    campusId: CAMPUS_ID,
    restaurantId: RESTAURANT_ID,
    codBlocked: false,
    codBlockedReason: null,
    strikes: 0,
    createdAt: now,
    updatedAt: now,
  };

  await usersCollection.replaceOne({ _id: VENDOR_USER_ID }, vendorUser, { upsert: true });
  console.log(`[x] Vendor User "${VENDOR_EMAIL}" created/updated.`);

  // 3. Upsert Categories
  const categoriesCollection = await db.menuCategories();
  await categoriesCollection.deleteMany({ restaurantId: RESTAURANT_ID });

  const categoryDocs: MenuCategory[] = CATEGORIES.map((cat) => ({
    _id: cat.id,
    restaurantId: RESTAURANT_ID,
    name: cat.name,
    sortOrder: cat.sortOrder,
  }));

  await categoriesCollection.insertMany(categoryDocs);
  console.log(`[x] ${categoryDocs.length} menu categories seeded.`);

  // 4. Upsert Menu Items
  const itemsCollection = await db.menuItems();
  await itemsCollection.deleteMany({ restaurantId: RESTAURANT_ID });

  const itemDocs: MenuItem[] = ITEMS.map((item) => ({
    _id: item.id,
    restaurantId: RESTAURANT_ID,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    isVeg: item.isVeg,
    pricePaise: item.pricePaise,
    imageUrl: null,
    isAvailable: true,
    isPopular: item.isPopular ?? false,
    addOnGroups: item.addOnGroups ?? [],
    sortOrder: item.sortOrder,
  }));

  await itemsCollection.insertMany(itemDocs);
  console.log(`[x] ${itemDocs.length} menu items seeded with size & add-on options.`);

  console.log("\n=== Wrapchik Pizza Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Admin Menu URL: /admin/vendors/${RESTAURANT_ID}/menu`);
  console.log(`  - Vendor Login: ${VENDOR_EMAIL} / Wrapchicktraefood@123`);
}

async function main() {
  try {
    await seedWrapchik();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-wrapchik")) {
  main().catch((err) => {
    console.error("Failed to seed Wrapchik Pizza:", err);
    process.exit(1);
  });
}
