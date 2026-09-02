/**
 * Chai Sutta Bar (CSB) Onboarding & Menu Seeding Script.
 *
 * Seeds:
 * 1. The restaurant profile for Chai Sutta Bar (CSB)
 * 2. The vendor account login (csb.nitp@trefood.in / CSBVendor@2026)
 * 3. All 22 categories and 85+ menu items transcribed from official menu photos
 *
 * Usage:
 *   npx tsx scripts/seed-csb.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise, type Paise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { AddOnGroup, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

const RESTAURANT_ID = "rest_csb_nitp";
const VENDOR_USER_ID = "usr_csb_vendor";
const VENDOR_EMAIL = "csb.nitp@trefood.in";

const R = rupeesToPaise;

function sizeGroup(regularPaise: Paise, largePaise: Paise): AddOnGroup {
  return {
    id: "grp_size",
    name: "Size",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_size_r", name: "Regular (R)", pricePaise: 0, isAvailable: true },
      { id: "opt_size_l", name: "Large (L)", pricePaise: largePaise - regularPaise, isAvailable: true },
    ],
  };
}

function portionGroup(halfPaise: Paise, fullPaise: Paise): AddOnGroup {
  return {
    id: "grp_portion",
    name: "Portion Size",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_half", name: "Half", pricePaise: 0, isAvailable: true },
      { id: "opt_full", name: "Full", pricePaise: fullPaise - halfPaise, isAvailable: true },
    ],
  };
}

function sugarFreeGroup(extraPaise: Paise = R(5)): AddOnGroup {
  return {
    id: "grp_sugar",
    name: "Customization",
    minSelect: 0,
    maxSelect: 1,
    options: [
      { id: "opt_sugar_free", name: "Sugar Free", pricePaise: extraPaise, isAvailable: true },
    ],
  };
}

function cheeseGroup(extraPaise: Paise = R(20)): AddOnGroup {
  return {
    id: "grp_cheese",
    name: "Add-ons",
    minSelect: 0,
    maxSelect: 1,
    options: [
      { id: "opt_extra_cheese", name: "Extra Cheese", pricePaise: extraPaise, isAvailable: true },
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Categories
   ══════════════════════════════════════════════════════════════════════ */

const CATEGORIES: { id: string; name: string; sortOrder: number }[] = [
  { id: "cat_csb_chai", name: "Chai", sortOrder: 1 },
  { id: "cat_csb_hot_coffee", name: "Hot Coffee", sortOrder: 2 },
  { id: "cat_csb_cold_coffee", name: "Cold Coffee", sortOrder: 3 },
  { id: "cat_csb_bites", name: "Bites", sortOrder: 4 },
  { id: "cat_csb_maggi", name: "Maggi", sortOrder: 5 },
  { id: "cat_csb_pizza", name: "Pizza", sortOrder: 6 },
  { id: "cat_csb_burger", name: "Burger", sortOrder: 7 },
  { id: "cat_csb_pasta", name: "Pasta", sortOrder: 8 },
  { id: "cat_csb_sandwich", name: "Sandwich", sortOrder: 9 },
  { id: "cat_csb_momos", name: "Momos", sortOrder: 10 },
  { id: "cat_csb_potatoes", name: "Potatoes & Fries", sortOrder: 11 },
  { id: "cat_csb_manchurian", name: "Manchurian", sortOrder: 12 },
  { id: "cat_csb_noodles", name: "Noodles", sortOrder: 13 },
  { id: "cat_csb_sweetcorn", name: "Sweet Corn", sortOrder: 14 },
  { id: "cat_csb_snacks", name: "Snacks", sortOrder: 15 },
  { id: "cat_csb_kathiroll", name: "Kathi Roll", sortOrder: 16 },
  { id: "cat_csb_hotmilk", name: "Hot Milk", sortOrder: 17 },
  { id: "cat_csb_shakes", name: "Shakes", sortOrder: 18 },
  { id: "cat_csb_icetea", name: "Ice Tea", sortOrder: 19 },
  { id: "cat_csb_mojito", name: "Mojito", sortOrder: 20 },
  { id: "cat_csb_icechiller", name: "Ice Chiller", sortOrder: 21 },
  { id: "cat_csb_extras", name: "Beverages & Extras", sortOrder: 22 },
];

/* ══════════════════════════════════════════════════════════════════════
   Menu Items Definition
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
  // ── 1. CHAI ──────────────────────────────────────────────────────────
  {
    id: "csb_adrak_chai",
    categoryId: "cat_csb_chai",
    name: "Adrak Chai",
    description: "Signature ginger tea brewed fresh in kulhad.",
    isVeg: true,
    pricePaise: R(15),
    isPopular: true,
    addOnGroups: [sizeGroup(R(15), R(25)), sugarFreeGroup(R(5))],
    sortOrder: 1,
  },
  {
    id: "csb_chocolate_chai",
    categoryId: "cat_csb_chai",
    name: "Chocolate Chai",
    description: "Rich cocoa-infused tea in traditional earthenware.",
    isVeg: true,
    pricePaise: R(15),
    addOnGroups: [sizeGroup(R(15), R(30)), sugarFreeGroup(R(5))],
    sortOrder: 2,
  },
  {
    id: "csb_rose_chai",
    categoryId: "cat_csb_chai",
    name: "Rose Chai",
    description: "Aromatic rose-flavoured milk tea.",
    isVeg: true,
    pricePaise: R(15),
    addOnGroups: [sizeGroup(R(15), R(30)), sugarFreeGroup(R(5))],
    sortOrder: 3,
  },
  {
    id: "csb_paan_chai",
    categoryId: "cat_csb_chai",
    name: "Paan Chai",
    description: "Refreshing betel leaf flavoured tea blend.",
    isVeg: true,
    pricePaise: R(15),
    addOnGroups: [sizeGroup(R(15), R(25)), sugarFreeGroup(R(5))],
    sortOrder: 4,
  },
  {
    id: "csb_elaichi_chai",
    categoryId: "cat_csb_chai",
    name: "Elaichi Chai",
    description: "Cardamom-spiced classic campus favorite.",
    isVeg: true,
    pricePaise: R(20),
    isPopular: true,
    addOnGroups: [sizeGroup(R(20), R(35)), sugarFreeGroup(R(5))],
    sortOrder: 5,
  },
  {
    id: "csb_kesar_chai",
    categoryId: "cat_csb_chai",
    name: "Kesar Chai",
    description: "Fragrant saffron-infused royal tea.",
    isVeg: true,
    pricePaise: R(20),
    addOnGroups: [sizeGroup(R(20), R(35)), sugarFreeGroup(R(5))],
    sortOrder: 6,
  },
  {
    id: "csb_masala_chai",
    categoryId: "cat_csb_chai",
    name: "Masala Chai",
    description: "Strong kadak chai with blend of 7 aromatic spices.",
    isVeg: true,
    pricePaise: R(25),
    isPopular: true,
    addOnGroups: [sizeGroup(R(25), R(40)), sugarFreeGroup(R(5))],
    sortOrder: 7,
  },
  {
    id: "csb_lemon_chai",
    categoryId: "cat_csb_chai",
    name: "Lemon Chai",
    description: "Tangy black tea infused with fresh lemon.",
    isVeg: true,
    pricePaise: R(20),
    addOnGroups: [sugarFreeGroup(R(5))],
    sortOrder: 8,
  },
  {
    id: "csb_gud_chai",
    categoryId: "cat_csb_chai",
    name: "Gud Chai",
    description: "Pure jaggery sweetened healthy hot tea.",
    isVeg: true,
    pricePaise: R(20),
    addOnGroups: [sizeGroup(R(20), R(35))],
    sortOrder: 9,
  },

  // ── 2. HOT COFFEE ────────────────────────────────────────────────────
  {
    id: "csb_hot_coffee",
    categoryId: "cat_csb_hot_coffee",
    name: "Hot Coffee",
    description: "Steaming frothy coffee served in kulhad.",
    isVeg: true,
    pricePaise: R(20),
    addOnGroups: [sizeGroup(R(20), R(30)), sugarFreeGroup(R(5))],
    sortOrder: 1,
  },
  {
    id: "csb_strong_hot_coffee",
    categoryId: "cat_csb_hot_coffee",
    name: "Strong Hot Coffee",
    description: "Extra shot robust brew for late-night study sessions.",
    isVeg: true,
    pricePaise: R(25),
    isPopular: true,
    addOnGroups: [sizeGroup(R(25), R(40)), sugarFreeGroup(R(5))],
    sortOrder: 2,
  },
  {
    id: "csb_choco_hot_coffee",
    categoryId: "cat_csb_hot_coffee",
    name: "Chocolate Hot Coffee",
    description: "Smooth blend of dark chocolate and espresso.",
    isVeg: true,
    pricePaise: R(25),
    addOnGroups: [sizeGroup(R(25), R(40)), sugarFreeGroup(R(5))],
    sortOrder: 3,
  },
  {
    id: "csb_strong_choco_coffee",
    categoryId: "cat_csb_hot_coffee",
    name: "Strong Choco Coffee",
    description: "Double strength coffee with rich melted chocolate.",
    isVeg: true,
    pricePaise: R(30),
    addOnGroups: [sizeGroup(R(30), R(50)), sugarFreeGroup(R(5))],
    sortOrder: 4,
  },
  {
    id: "csb_black_coffee",
    categoryId: "cat_csb_hot_coffee",
    name: "Black Coffee",
    description: "Classic unsweetened pure black coffee.",
    isVeg: true,
    pricePaise: R(25),
    addOnGroups: [sugarFreeGroup(R(5))],
    sortOrder: 5,
  },

  // ── 3. COLD COFFEE ───────────────────────────────────────────────────
  {
    id: "csb_cold_coffee",
    categoryId: "cat_csb_cold_coffee",
    name: "Cold Coffee",
    description: "Chilled creamy blended cold coffee.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 1,
  },
  {
    id: "csb_strong_cold_coffee",
    categoryId: "cat_csb_cold_coffee",
    name: "Strong Cold Coffee",
    description: "Thick bold brew with extra coffee punch.",
    isVeg: true,
    pricePaise: R(90),
    sortOrder: 2,
  },
  {
    id: "csb_cold_coffee_icecream",
    categoryId: "cat_csb_cold_coffee",
    name: "Cold Coffee with Ice Cream",
    description: "Topped with a scoop of vanilla ice cream.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "csb_chocolate_cold_coffee",
    categoryId: "cat_csb_cold_coffee",
    name: "Chocolate Cold Coffee",
    description: "Chilled coffee blended with chocolate syrup.",
    isVeg: true,
    pricePaise: R(99),
    sortOrder: 4,
  },
  {
    id: "csb_brounee_cold_coffee",
    categoryId: "cat_csb_cold_coffee",
    name: "Brownie Cold Coffee",
    description: "Loaded with crushed fudge brownie pieces.",
    isVeg: true,
    pricePaise: R(110),
    isPopular: true,
    sortOrder: 5,
  },
  {
    id: "csb_vita_cold_coffee",
    categoryId: "cat_csb_cold_coffee",
    name: "Vita Cold Coffee",
    description: "Energy packed blend with Bournvita flavour.",
    isVeg: true,
    pricePaise: R(110),
    sortOrder: 6,
  },
  {
    id: "csb_strong_choco_cold_coffee",
    categoryId: "cat_csb_cold_coffee",
    name: "Strong Choco Cold Coffee",
    description: "Double coffee and double chocolate over ice.",
    isVeg: true,
    pricePaise: R(115),
    sortOrder: 7,
  },
  {
    id: "csb_special_cold_coffee",
    categoryId: "cat_csb_cold_coffee",
    name: "CSB Special Cold Coffee",
    description: "House special secret shake with ice cream & toppings.",
    isVeg: true,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 8,
  },

  // ── 4. BITES ─────────────────────────────────────────────────────────
  {
    id: "csb_maska_bun",
    categoryId: "cat_csb_bites",
    name: "Maska Bun",
    description: "Soft bun smeared generously with fresh butter.",
    isVeg: true,
    pricePaise: R(40),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "csb_bread_butter",
    categoryId: "cat_csb_bites",
    name: "Bread Butter",
    description: "Fresh bread slices with salted butter.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 2,
  },
  {
    id: "csb_grilled_bread_butter",
    categoryId: "cat_csb_bites",
    name: "Grilled Bread Butter",
    description: "Crispy golden grilled buttered toast.",
    isVeg: true,
    pricePaise: R(50),
    sortOrder: 3,
  },

  // ── 5. MAGGI ─────────────────────────────────────────────────────────
  {
    id: "csb_plain_maggi",
    categoryId: "cat_csb_maggi",
    name: "Plain Maggi",
    description: "Classic 2-minute instant noodles cooked piping hot.",
    isVeg: true,
    pricePaise: R(55),
    sortOrder: 1,
  },
  {
    id: "csb_double_masala_maggi",
    categoryId: "cat_csb_maggi",
    name: "Double Masala Maggi",
    description: "Extra spicy seasoning for the true hostel hunger.",
    isVeg: true,
    pricePaise: R(60),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "csb_veg_maggi",
    categoryId: "cat_csb_maggi",
    name: "Vegetable Maggi",
    description: "Tossed with onions, tomatoes, peas and carrots.",
    isVeg: true,
    pricePaise: R(65),
    sortOrder: 3,
  },
  {
    id: "csb_tandoori_maggi",
    categoryId: "cat_csb_maggi",
    name: "Tandoori Maggi",
    description: "Infused with smoky tandoori sauce and herbs.",
    isVeg: true,
    pricePaise: R(70),
    sortOrder: 4,
  },
  {
    id: "csb_corn_cheese_maggi",
    categoryId: "cat_csb_maggi",
    name: "Corn Cheese Maggi",
    description: "Loaded with sweet corn kernels and melted mozzarella.",
    isVeg: true,
    pricePaise: R(75),
    sortOrder: 5,
  },
  {
    id: "csb_butter_cheese_maggi",
    categoryId: "cat_csb_maggi",
    name: "Butter Cheese Maggi",
    description: "Simmered in rich Amul butter and stretchy cheese.",
    isVeg: true,
    pricePaise: R(75),
    sortOrder: 6,
  },
  {
    id: "csb_paneer_maggi",
    categoryId: "cat_csb_maggi",
    name: "Paneer Maggi",
    description: "With diced cottage cheese cubes in aromatic masala.",
    isVeg: true,
    pricePaise: R(90),
    sortOrder: 7,
  },
  {
    id: "csb_schezwan_maggi",
    categoryId: "cat_csb_maggi",
    name: "Schezwan Maggi",
    description: "Spicy Schezwan chilli pepper noodles.",
    isVeg: true,
    pricePaise: R(75),
    sortOrder: 8,
  },
  {
    id: "csb_peri_peri_maggi",
    categoryId: "cat_csb_maggi",
    name: "Peri Peri Maggi",
    description: "Dusted with zesty African bird's eye peri-peri spice.",
    isVeg: true,
    pricePaise: R(65),
    sortOrder: 9,
  },
  {
    id: "csb_special_maggi",
    categoryId: "cat_csb_maggi",
    name: "CSB Special Maggi",
    description: "Ultimate bowl loaded with paneer, cheese, corn & veggies.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 10,
  },

  // ── 6. PIZZA ─────────────────────────────────────────────────────────
  {
    id: "csb_margherita_pizza",
    categoryId: "cat_csb_pizza",
    name: "Margherita Pizza",
    description: "Classic pizza topped with herb tomato sauce and mozzarella.",
    isVeg: true,
    pricePaise: R(120),
    sortOrder: 1,
  },
  {
    id: "csb_onion_pizza",
    categoryId: "cat_csb_pizza",
    name: "Onion Pizza",
    description: "Crunchy sliced onions on a cheesy base.",
    isVeg: true,
    pricePaise: R(135),
    sortOrder: 2,
  },
  {
    id: "csb_tomato_pizza",
    categoryId: "cat_csb_pizza",
    name: "Tomato Pizza",
    description: "Juicy fresh tomatoes with oregano and mozzarella.",
    isVeg: true,
    pricePaise: R(135),
    sortOrder: 3,
  },
  {
    id: "csb_sweet_corn_pizza",
    categoryId: "cat_csb_pizza",
    name: "Sweet Corn Pizza",
    description: "Sweet American golden corn with herbs and cheese.",
    isVeg: true,
    pricePaise: R(145),
    sortOrder: 4,
  },
  {
    id: "csb_veggie_delight_pizza",
    categoryId: "cat_csb_pizza",
    name: "Veggie Delight Pizza",
    description: "Loaded with capsicum, onion, tomato and golden corn.",
    isVeg: true,
    pricePaise: R(150),
    isPopular: true,
    sortOrder: 5,
  },
  {
    id: "csb_paneer_wrapped_pizza",
    categoryId: "cat_csb_pizza",
    name: "Paneer Wrapped Pizza",
    description: "Marinated spicy paneer chunks wrapped in rich cheese.",
    isVeg: true,
    pricePaise: R(170),
    sortOrder: 6,
  },
  {
    id: "csb_extra_cheese_loaded_pizza",
    categoryId: "cat_csb_pizza",
    name: "Extra Cheese Loaded Pizza",
    description: "Double mozzarella cheese layer for cheese lovers.",
    isVeg: true,
    pricePaise: R(180),
    sortOrder: 7,
  },
  {
    id: "csb_cheese_blast_pizza",
    categoryId: "cat_csb_pizza",
    name: "Cheese Blast Pizza",
    description: "Liquid cheese burst crust overflowing with toppings.",
    isVeg: true,
    pricePaise: R(190),
    isPopular: true,
    sortOrder: 8,
  },
  {
    id: "csb_special_pizza",
    categoryId: "cat_csb_pizza",
    name: "CSB Special Pizza",
    description: "Chef's gourmet creation with all prime toppings & paneer.",
    isVeg: true,
    pricePaise: R(200),
    isPopular: true,
    sortOrder: 9,
  },

  // ── 7. BURGER ────────────────────────────────────────────────────────
  {
    id: "csb_veg_burger",
    categoryId: "cat_csb_burger",
    name: "Veg Burger",
    description: "Crispy potato-veggie patty with mayo in toasted bun.",
    isVeg: true,
    pricePaise: R(65),
    sortOrder: 1,
  },
  {
    id: "csb_veg_cheese_burger",
    categoryId: "cat_csb_burger",
    name: "Veg Cheese Burger",
    description: "Crispy vegetable patty topped with cheese slice.",
    isVeg: true,
    pricePaise: R(79),
    sortOrder: 2,
  },
  {
    id: "csb_veg_paneer_burger",
    categoryId: "cat_csb_burger",
    name: "Veg Paneer Burger",
    description: "Grilled cottage cheese patty with secret herbs.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 3,
  },
  {
    id: "csb_veg_cheese_paneer_burger",
    categoryId: "cat_csb_burger",
    name: "Veg Cheese Paneer Burger",
    description: "Juicy paneer patty layered with melted cheese slice.",
    isVeg: true,
    pricePaise: R(99),
    isPopular: true,
    sortOrder: 4,
  },
  {
    id: "csb_peri_peri_burger",
    categoryId: "cat_csb_burger",
    name: "Peri Peri Burger",
    description: "Spicy peri-peri seasoned crispy patty with zesty dip.",
    isVeg: true,
    pricePaise: R(75),
    sortOrder: 5,
  },
  {
    id: "csb_special_burger",
    categoryId: "cat_csb_burger",
    name: "CSB Special Burger",
    description: "Double patty giant burger with cheese & loaded sauce.",
    isVeg: true,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 6,
  },

  // ── 8. PASTA ─────────────────────────────────────────────────────────
  {
    id: "csb_red_sauce_pasta",
    categoryId: "cat_csb_pasta",
    name: "Red Sauce Pasta",
    description: "Penne tossed in spicy Italian tomato arrabbiata sauce.",
    isVeg: true,
    pricePaise: R(149),
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 1,
  },
  {
    id: "csb_white_sauce_pasta",
    categoryId: "cat_csb_pasta",
    name: "White Sauce Pasta",
    description: "Rich and creamy Alfredo white sauce penne pasta.",
    isVeg: true,
    pricePaise: R(149),
    isPopular: true,
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 2,
  },
  {
    id: "csb_mixed_sauce_pasta",
    categoryId: "cat_csb_pasta",
    name: "Mixed Sauce Pasta",
    description: "Pink sauce harmony of tangy red and creamy white sauce.",
    isVeg: true,
    pricePaise: R(159),
    isPopular: true,
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 3,
  },

  // ── 9. SANDWICH ──────────────────────────────────────────────────────
  {
    id: "csb_corn_masala_sandwich",
    categoryId: "cat_csb_sandwich",
    name: "Corn Masala Sandwich",
    description: "Juicy golden corn in spiced herb mayo filling.",
    isVeg: true,
    pricePaise: R(80),
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 1,
  },
  {
    id: "csb_mayo_delight_sandwich",
    categoryId: "cat_csb_sandwich",
    name: "Mayo Delight Sandwich",
    description: "Crunchy vegetables tossed in garlic mayonnaise.",
    isVeg: true,
    pricePaise: R(85),
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 2,
  },
  {
    id: "csb_veggie_grilled_sandwich",
    categoryId: "cat_csb_sandwich",
    name: "Veggie Grilled Sandwich",
    description: "Crispy grilled bread packed with fresh seasonal veggies.",
    isVeg: true,
    pricePaise: R(85),
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 3,
  },
  {
    id: "csb_paneer_bhurji_sandwich",
    categoryId: "cat_csb_sandwich",
    name: "Paneer Bhurji Sandwich",
    description: "Spiced scrambled cottage cheese grilled to perfection.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 4,
  },
  {
    id: "csb_paneer_taka_tak_sandwich",
    categoryId: "cat_csb_sandwich",
    name: "Paneer Taka Tak Sandwich",
    description: "Fiery tossed spicy paneer sandwich.",
    isVeg: true,
    pricePaise: R(95),
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 5,
  },
  {
    id: "csb_chocolate_sandwich",
    categoryId: "cat_csb_sandwich",
    name: "Chocolate Sandwich",
    description: "Decadent melted chocolate filling between grilled toasts.",
    isVeg: true,
    pricePaise: R(99),
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 6,
  },
  {
    id: "csb_special_sandwich",
    categoryId: "cat_csb_sandwich",
    name: "CSB Sandwich",
    description: "Club sandwich loaded with paneer, cheese and secret chutneys.",
    isVeg: true,
    pricePaise: R(120),
    isPopular: true,
    addOnGroups: [cheeseGroup(R(20))],
    sortOrder: 7,
  },

  // ── 10. MOMOS ────────────────────────────────────────────────────────
  {
    id: "csb_veg_steamed_momos",
    categoryId: "cat_csb_momos",
    name: "Veg Steamed Momos (8 Pcs)",
    description: "Soft steamed dumplings stuffed with minced vegetables.",
    isVeg: true,
    pricePaise: R(60),
    sortOrder: 1,
  },
  {
    id: "csb_veg_fried_momos",
    categoryId: "cat_csb_momos",
    name: "Veg Fried Momos (8 Pcs)",
    description: "Crispy deep-fried momos served with red spicy chutney.",
    isVeg: true,
    pricePaise: R(75),
    sortOrder: 2,
  },
  {
    id: "csb_kurkure_momos",
    categoryId: "cat_csb_momos",
    name: "Kurkure Momos (8 Pcs)",
    description: "Crunchy coated crispy momos with spicy seasoning.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "csb_marination_momos",
    categoryId: "cat_csb_momos",
    name: "Marination Momos (8 Pcs)",
    description: "Tandoori marinated momos glazed in rich spices.",
    isVeg: true,
    pricePaise: R(99),
    isPopular: true,
    sortOrder: 4,
  },

  // ── 11. POTATOES & FRIES ─────────────────────────────────────────────
  {
    id: "csb_french_fries",
    categoryId: "cat_csb_potatoes",
    name: "French Fries",
    description: "Crispy salted potato fries.",
    isVeg: true,
    pricePaise: R(70),
    sortOrder: 1,
  },
  {
    id: "csb_chilli_potato",
    categoryId: "cat_csb_potatoes",
    name: "Chilli Potato",
    description: "Crispy potato fingers tossed in spicy Indo-Chinese sauce.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 2,
  },
  {
    id: "csb_honey_chilli_potato",
    categoryId: "cat_csb_potatoes",
    name: "Honey Chilli Potato",
    description: "Sweet and spicy glazed crispy potatoes with sesame seeds.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "csb_peri_peri_fries",
    categoryId: "cat_csb_potatoes",
    name: "Peri Peri French Fries",
    description: "Fries shaken with tangy peri-peri spice dust.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 4,
  },
  {
    id: "csb_loaded_fries",
    categoryId: "cat_csb_potatoes",
    name: "Loaded Fries",
    description: "Topped with warm melted cheese and spicy mayo.",
    isVeg: true,
    pricePaise: R(99),
    isPopular: true,
    sortOrder: 5,
  },

  // ── 12. MANCHURIAN ───────────────────────────────────────────────────
  {
    id: "csb_veg_manchurian",
    categoryId: "cat_csb_manchurian",
    name: "Veg Manchurian (4 Pcs)",
    description: "Vegetable dumplings tossed in dark soya garlic sauce.",
    isVeg: true,
    pricePaise: R(60),
    sortOrder: 1,
  },
  {
    id: "csb_paneer_manchurian",
    categoryId: "cat_csb_manchurian",
    name: "Paneer Manchurian (4 Pcs)",
    description: "Crispy paneer cubes in savoury Chinese Manchurian gravy.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 2,
  },
  {
    id: "csb_chicken_manchurian",
    categoryId: "cat_csb_manchurian",
    name: "Chicken Manchurian (4 Pcs)",
    description: "Juicy chicken meatballs in spiced Chinese gravy.",
    isVeg: false,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 3,
  },

  // ── 13. NOODLES ──────────────────────────────────────────────────────
  {
    id: "csb_veg_noodle",
    categoryId: "cat_csb_noodles",
    name: "Veg Noodle",
    description: "Classic wok-tossed noodles with shredded vegetables.",
    isVeg: true,
    pricePaise: R(50),
    addOnGroups: [sizeGroup(R(50), R(70))],
    sortOrder: 1,
  },
  {
    id: "csb_paneer_noodle",
    categoryId: "cat_csb_noodles",
    name: "Paneer Noodle",
    description: "Stir-fried noodles loaded with fresh paneer cubes.",
    isVeg: true,
    pricePaise: R(70),
    isPopular: true,
    addOnGroups: [sizeGroup(R(70), R(120))],
    sortOrder: 2,
  },
  {
    id: "csb_singapuri_noodle",
    categoryId: "cat_csb_noodles",
    name: "Singapuri Noodle",
    description: "Yellow-curry spiced noodles with crunch vegetables.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [sizeGroup(R(60), R(80))],
    sortOrder: 3,
  },
  {
    id: "csb_hakka_noodle",
    categoryId: "cat_csb_noodles",
    name: "Hakka Noodle",
    description: "Authentic Indo-Chinese Hakka style stir fried noodles.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    addOnGroups: [sizeGroup(R(80), R(120))],
    sortOrder: 4,
  },
  {
    id: "csb_chilli_garlic_noodle",
    categoryId: "cat_csb_noodles",
    name: "Chilli Garlic Noodle",
    description: "Fiery spicy noodles with roasted burnt garlic aroma.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [sizeGroup(R(60), R(80))],
    sortOrder: 5,
  },
  {
    id: "csb_chicken_noodle",
    categoryId: "cat_csb_noodles",
    name: "Chicken Noodle",
    description: "Wok tossed noodles with seasoned shredded chicken.",
    isVeg: false,
    pricePaise: R(90),
    isPopular: true,
    addOnGroups: [sizeGroup(R(90), R(120))],
    sortOrder: 6,
  },
  {
    id: "csb_egg_noodle",
    categoryId: "cat_csb_noodles",
    name: "Egg Noodle",
    description: "Noodles scrambled with eggs and crunchy greens.",
    isVeg: false,
    pricePaise: R(80),
    addOnGroups: [sizeGroup(R(80), R(110))],
    sortOrder: 7,
  },
  {
    id: "csb_chicken_egg_noodle",
    categoryId: "cat_csb_noodles",
    name: "Chicken + Egg Noodle",
    description: "Combo noodles loaded with tender chicken and egg.",
    isVeg: false,
    pricePaise: R(100),
    isPopular: true,
    addOnGroups: [sizeGroup(R(100), R(140))],
    sortOrder: 8,
  },

  // ── 14. SWEET CORN ───────────────────────────────────────────────────
  {
    id: "csb_crispy_sweet_corn",
    categoryId: "cat_csb_sweetcorn",
    name: "Crispy Sweet Corn",
    description: "Batter fried sweet corn kernels with chatpata masala.",
    isVeg: true,
    pricePaise: R(70),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "csb_sweet_corn_chaat",
    categoryId: "cat_csb_sweetcorn",
    name: "Sweet Corn Chaat",
    description: "Steamed sweet corn tossed in butter, lemon and spices.",
    isVeg: true,
    pricePaise: R(60),
    sortOrder: 2,
  },

  // ── 15. SNACKS ───────────────────────────────────────────────────────
  {
    id: "csb_chilli_paneer",
    categoryId: "cat_csb_snacks",
    name: "Chilli Paneer",
    description: "Fried cottage cheese cubes tossed in spicy chilli soya sauce.",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    addOnGroups: [portionGroup(R(100), R(170))],
    sortOrder: 1,
  },
  {
    id: "csb_chilli_chicken",
    categoryId: "cat_csb_snacks",
    name: "Chilli Chicken",
    description: "Crispy chicken morsels in spicy garlic chilli sauce.",
    isVeg: false,
    pricePaise: R(110),
    isPopular: true,
    addOnGroups: [portionGroup(R(110), R(180))],
    sortOrder: 2,
  },
  {
    id: "csb_chicken_kurkure",
    categoryId: "cat_csb_snacks",
    name: "Chicken Kurkure (4 Pcs)",
    description: "Super crispy batter-coated chicken strips.",
    isVeg: false,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "csb_paneer_sutli_bomb",
    categoryId: "cat_csb_snacks",
    name: "Paneer Sutli Bomb (8 Pcs)",
    description: "Crispy thread-wrapped spiced paneer bites.",
    isVeg: true,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 4,
  },

  // ── 16. KATHI ROLL ───────────────────────────────────────────────────
  {
    id: "csb_veg_kathi_roll",
    categoryId: "cat_csb_kathiroll",
    name: "Veg Kathi Roll",
    description: "Spiced mixed vegetables wrapped in a flaky paratha.",
    isVeg: true,
    pricePaise: R(50),
    sortOrder: 1,
  },
  {
    id: "csb_paneer_kathi_roll",
    categoryId: "cat_csb_kathiroll",
    name: "Paneer Kathi Roll",
    description: "Marinated paneer chunks with sliced onions & mint dip.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "csb_chicken_kathi_roll",
    categoryId: "cat_csb_kathiroll",
    name: "Chicken Kathi Roll",
    description: "Juicy chicken tikka wrapped in a crisp golden roll.",
    isVeg: false,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "csb_egg_kathi_roll",
    categoryId: "cat_csb_kathiroll",
    name: "Egg Kathi Roll",
    description: "Double egg layer paratha roll with tangy onion salad.",
    isVeg: false,
    pricePaise: R(60),
    sortOrder: 4,
  },
  {
    id: "csb_omlet_2_egg",
    categoryId: "cat_csb_kathiroll",
    name: "Omelette (2 Egg)",
    description: "Fresh 2-egg omelette cooked with onions and green chillies.",
    isVeg: false,
    pricePaise: R(40),
    sortOrder: 5,
  },

  // ── 17. HOT MILK ─────────────────────────────────────────────────────
  {
    id: "csb_plain_milk",
    categoryId: "cat_csb_hotmilk",
    name: "Plain Milk",
    description: "Pure hot boiled dairy milk.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 1,
  },
  {
    id: "csb_elaichi_milk",
    categoryId: "cat_csb_hotmilk",
    name: "Elaichi Milk",
    description: "Hot milk infused with fragrant green cardamom.",
    isVeg: true,
    pricePaise: R(50),
    sortOrder: 2,
  },
  {
    id: "csb_kesar_milk",
    categoryId: "cat_csb_hotmilk",
    name: "Kesar Milk",
    description: "Warm saffron milk with almond undertones.",
    isVeg: true,
    pricePaise: R(60),
    sortOrder: 3,
  },
  {
    id: "csb_bournvita_milk",
    categoryId: "cat_csb_hotmilk",
    name: "Bournvita Milk",
    description: "Classic malt chocolate hot milk.",
    isVeg: true,
    pricePaise: R(60),
    sortOrder: 4,
  },

  // ── 18. SHAKES ───────────────────────────────────────────────────────
  {
    id: "csb_oreo_shake",
    categoryId: "cat_csb_shakes",
    name: "Oreo Shake",
    description: "Thick milkshake blended with crushed Oreo cookies.",
    isVeg: true,
    pricePaise: R(85),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "csb_kitkat_shake",
    categoryId: "cat_csb_shakes",
    name: "KitKat Shake",
    description: "Creamy shake blended with crispy KitKat chocolate bars.",
    isVeg: true,
    pricePaise: R(85),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "csb_chocolate_milk_shake",
    categoryId: "cat_csb_shakes",
    name: "Chocolate Milk Shake",
    description: "Classic rich chocolate thick shake.",
    isVeg: true,
    pricePaise: R(90),
    sortOrder: 3,
  },
  {
    id: "csb_strawberry_shake",
    categoryId: "cat_csb_shakes",
    name: "Strawberry Shake",
    description: "Sweet and refreshing pink strawberry shake.",
    isVeg: true,
    pricePaise: R(99),
    sortOrder: 4,
  },
  {
    id: "csb_butterscotch_shake",
    categoryId: "cat_csb_shakes",
    name: "Butterscotch Shake",
    description: "Loaded with crunchy butterscotch bits.",
    isVeg: true,
    pricePaise: R(99),
    sortOrder: 5,
  },
  {
    id: "csb_vanilla_shake",
    categoryId: "cat_csb_shakes",
    name: "Vanilla Shake",
    description: "Smooth and creamy pure vanilla shake.",
    isVeg: true,
    pricePaise: R(99),
    sortOrder: 6,
  },
  {
    id: "csb_brounee_shake",
    categoryId: "cat_csb_shakes",
    name: "Brownie Shake",
    description: "Blended with chocolate brownie chunks and fudge.",
    isVeg: true,
    pricePaise: R(110),
    isPopular: true,
    sortOrder: 7,
  },

  // ── 19. ICE TEA ──────────────────────────────────────────────────────
  {
    id: "csb_classic_ice_tea",
    categoryId: "cat_csb_icetea",
    name: "Classic Ice Tea",
    description: "Refreshing cold brewed iced tea with lemon wedge.",
    isVeg: true,
    pricePaise: R(65),
    sortOrder: 1,
  },
  {
    id: "csb_lemon_ice_tea",
    categoryId: "cat_csb_icetea",
    name: "Lemon Ice Tea",
    description: "Tangy chilled lemon iced tea with mint.",
    isVeg: true,
    pricePaise: R(75),
    isPopular: true,
    sortOrder: 2,
  },

  // ── 20. MOJITO ───────────────────────────────────────────────────────
  {
    id: "csb_classic_mojito",
    categoryId: "cat_csb_mojito",
    name: "Classic Mojito",
    description: "Mint, lime, and bubbly soda over crushed ice.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 1,
  },
  {
    id: "csb_green_mint_mojito",
    categoryId: "cat_csb_mojito",
    name: "Green Mint Mojito",
    description: "Extra fresh garden mint blended soda mocktail.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "csb_blue_curacao_mojito",
    categoryId: "cat_csb_mojito",
    name: "Blue Curacao Mojito",
    description: "Vibrant blue citrus mocktail served chilled.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 3,
  },

  // ── 21. ICE CHILLER ──────────────────────────────────────────────────
  {
    id: "csb_strawberry_chiller",
    categoryId: "cat_csb_icechiller",
    name: "Strawberry Ice Chiller",
    description: "Icy blended strawberry slush mocktail.",
    isVeg: true,
    pricePaise: R(79),
    sortOrder: 1,
  },
  {
    id: "csb_kiwi_chiller",
    categoryId: "cat_csb_icechiller",
    name: "Kiwi Ice Chiller",
    description: "Tart and sweet crushed kiwi chiller.",
    isVeg: true,
    pricePaise: R(79),
    sortOrder: 2,
  },
  {
    id: "csb_blueberry_chiller",
    categoryId: "cat_csb_icechiller",
    name: "Blueberry Ice Chiller",
    description: "Sweet wild blueberry crushed ice drink.",
    isVeg: true,
    pricePaise: R(79),
    isPopular: true,
    sortOrder: 3,
  },

  // ── 22. BEVERAGES & EXTRAS ───────────────────────────────────────────
  {
    id: "csb_water_bottle",
    categoryId: "cat_csb_extras",
    name: "Packaged Drinking Water (MRP)",
    description: "Sealed 1L bottled mineral water.",
    isVeg: true,
    pricePaise: R(20),
    sortOrder: 1,
  },
  {
    id: "csb_carry_bag",
    categoryId: "cat_csb_extras",
    name: "CSB Carry Bag",
    description: "Eco-friendly branded carry bag for your order.",
    isVeg: true,
    pricePaise: R(10),
    sortOrder: 2,
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Main Seed Runner
   ══════════════════════════════════════════════════════════════════════ */

export async function seedChaiSuttaBar(): Promise<void> {
  console.log("=== Onboarding Chai Sutta Bar (CSB) ===");

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
    slug: "chai-sutta-bar-csb",
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
    phone: "9905773851",
    description:
      "Chai Sutta Bar (CSB) - Cuddle the Kulhad. Hot Chai, Coffee, Maggi, Pizzas, Burgers, Pastas, Sandwiches & Shakes with free delivery across campus.",
    imageUrl: null,
    bannerUrl: null,
    packagingFeePaise: R(10),
    minOrderPaise: R(40),
    prepMinutes: 15,
    foodGstBps: 0,
    commissionBpsOverride: null,
    servedZoneIds,
    opensMinutes: 0, // 24x7 service
    closesMinutes: 1439,
    isOpen: true,
    isApproved: true,
    rating: 4.5,
    ratingCount: 28,
    kyc: {
      status: "APPROVED",
      ownerName: "CSB Manager",
      ownerPhone: "9905773851",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Chai Sutta Bar",
      accountNumber: "990577385100",
      ifsc: "SBIN0001234",
      upiId: "csb@upi",
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
    name: "CSB Manager",
    email: VENDOR_EMAIL,
    phone: "9905773851",
    passwordHash: hashPassword("CSBVendor@2026"),
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
  // Clear existing categories for this restaurant
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

  console.log("\n=== Chai Sutta Bar (CSB) Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Admin Menu URL: /admin/vendors/${RESTAURANT_ID}/menu`);
  console.log(`  - Vendor Login: ${VENDOR_EMAIL} / CSBVendor@2026`);
}

async function main() {
  try {
    await seedChaiSuttaBar();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

// If invoked directly from CLI
if (require.main === module || process.argv[1]?.includes("seed-csb")) {
  main().catch((err) => {
    console.error("Failed to seed Chai Sutta Bar:", err);
    process.exit(1);
  });
}
