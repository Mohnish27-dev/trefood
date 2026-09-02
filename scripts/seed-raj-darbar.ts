/**
 * Raj Darbar Onboarding & Menu Seeding Script.
 *
 * Special features:
 * - Exclusive Campus Vendor for Farm-Fresh Fruits (Apple, Pomegranate, Kiwi, Banana, Mango, Grapes, Litchi, Strawberries, etc.)
 * - Fresh Fruit Juices & Coconut Water
 * - Fast Food, Chowmein, Rolls, Burgers & Soups
 * - Homestyle Bihari Thalis, Sattu Parathas, Paneer & Chicken Dehati Curries, Biryanis.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-raj-darbar.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise, type Paise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { AddOnGroup, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

const RESTAURANT_ID = "rest_raj_darbar_nitp";
const VENDOR_USER_ID = "usr_raj_darbar_vendor";
const VENDOR_EMAIL = "rajdarbar.nitp@trefood.in";

const R = rupeesToPaise;

function portionGroup(halfPaise: Paise, fullPaise: Paise, label1 = "Half", label2 = "Full"): AddOnGroup {
  return {
    id: "grp_portion",
    name: "Portion / Quantity",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_portion_half", name: label1, pricePaise: 0, isAvailable: true },
      { id: "opt_portion_full", name: label2, pricePaise: fullPaise - halfPaise, isAvailable: true },
    ],
  };
}

function weightGroup(halfKgPaise: Paise, oneKgPaise: Paise): AddOnGroup {
  return {
    id: "grp_weight",
    name: "Weight / Quantity",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_weight_500g", name: "500 g", pricePaise: 0, isAvailable: true },
      { id: "opt_weight_1kg", name: "1 kg", pricePaise: oneKgPaise - halfKgPaise, isAvailable: true },
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Categories (Featuring Fresh Fruits & Juices Prominently at the Top)
   ══════════════════════════════════════════════════════════════════════ */

const CATEGORIES: { id: string; name: string; sortOrder: number }[] = [
  { id: "cat_rd_fresh_fruits", name: "Fresh Fruits (Exclusive)", sortOrder: 1 },
  { id: "cat_rd_fresh_juices", name: "Fresh Juices & Coconut Water", sortOrder: 2 },
  { id: "cat_rd_thalis", name: "Special Thalis", sortOrder: 3 },
  { id: "cat_rd_fast_food", name: "Fast Food & Chowmein", sortOrder: 4 },
  { id: "cat_rd_rolls", name: "Rolls", sortOrder: 5 },
  { id: "cat_rd_biryani", name: "Biryani Specials", sortOrder: 6 },
  { id: "cat_rd_paneer_main", name: "Paneer Specialties", sortOrder: 7 },
  { id: "cat_rd_nonveg_main", name: "Non-Veg Main Course & Fish", sortOrder: 8 },
  { id: "cat_rd_dal_sabji", name: "Dals & Homestyle Sabji", sortOrder: 9 },
  { id: "cat_rd_rice", name: "Rice & Fried Rice", sortOrder: 10 },
  { id: "cat_rd_rotis", name: "Tawa Rotis & Sattu Parathas", sortOrder: 11 },
  { id: "cat_rd_soups_burgers", name: "Soups & Burgers", sortOrder: 12 },
  { id: "cat_rd_tea_icecream", name: "Tea, Coffee & Ice Cream", sortOrder: 13 },
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
  // ── 1. FRESH FRUITS (EXCLUSIVE) ──────────────────────────────────────
  {
    id: "rd_kiwi",
    categoryId: "cat_rd_fresh_fruits",
    name: "Kiwi (3 Pcs Pack)",
    description: "Farm-fresh ripe green kiwis packed with vitamin C (3 pcs).",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "rd_apple",
    categoryId: "cat_rd_fresh_fruits",
    name: "Fresh Apple",
    description: "Crisp and juicy sweet Kashmiri apples.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    addOnGroups: [weightGroup(R(80), R(160))],
    sortOrder: 2,
  },
  {
    id: "rd_pomegranate",
    categoryId: "cat_rd_fresh_fruits",
    name: "Pomegranate (Anar)",
    description: "Fresh premium ruby red pomegranate pearls.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    addOnGroups: [weightGroup(R(80), R(160))],
    sortOrder: 3,
  },
  {
    id: "rd_banana",
    categoryId: "cat_rd_fresh_fruits",
    name: "Banana (Kela)",
    description: "Fresh naturally ripened sweet bananas.",
    isVeg: true,
    pricePaise: R(35),
    isPopular: true,
    addOnGroups: [portionGroup(R(35), R(70), "6 Pcs (Half Dozen)", "12 Pcs (1 Dozen)")],
    sortOrder: 4,
  },
  {
    id: "rd_papaya",
    categoryId: "cat_rd_fresh_fruits",
    name: "Papaya (Papita)",
    description: "Sweet and nutritious ripe golden papaya (approx 1 kg).",
    isVeg: true,
    pricePaise: R(70),
    sortOrder: 5,
  },
  {
    id: "rd_green_grapes",
    categoryId: "cat_rd_fresh_fruits",
    name: "Green Grapes",
    description: "Sweet seedless fresh green grapes.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [weightGroup(R(60), R(120))],
    sortOrder: 6,
  },
  {
    id: "rd_black_grapes",
    categoryId: "cat_rd_fresh_fruits",
    name: "Black Grapes",
    description: "Rich sweet fresh black grapes.",
    isVeg: true,
    pricePaise: R(80),
    addOnGroups: [weightGroup(R(80), R(160))],
    sortOrder: 7,
  },
  {
    id: "rd_watermelon",
    categoryId: "cat_rd_fresh_fruits",
    name: "Watermelon (Tarbooz)",
    description: "Refreshing sweet red watermelon (per kg / half fruit).",
    isVeg: true,
    pricePaise: R(30),
    sortOrder: 8,
  },
  {
    id: "rd_pear",
    categoryId: "cat_rd_fresh_fruits",
    name: "Pear (Nashpati)",
    description: "Crisp and juicy seasonal pears.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [weightGroup(R(60), R(120))],
    sortOrder: 9,
  },
  {
    id: "rd_mango",
    categoryId: "cat_rd_fresh_fruits",
    name: "Mango (Aam)",
    description: "Delicious sweet ripe seasonal mangoes.",
    isVeg: true,
    pricePaise: R(40),
    isPopular: true,
    addOnGroups: [weightGroup(R(40), R(80))],
    sortOrder: 10,
  },
  {
    id: "rd_orange",
    categoryId: "cat_rd_fresh_fruits",
    name: "Orange (Santra)",
    description: "Juicy sweet Nagpur oranges.",
    isVeg: true,
    pricePaise: R(40),
    addOnGroups: [weightGroup(R(40), R(80))],
    sortOrder: 11,
  },
  {
    id: "rd_kinnow",
    categoryId: "cat_rd_fresh_fruits",
    name: "Kinnow (Kino)",
    description: "Fresh high-juice citrus kinnow.",
    isVeg: true,
    pricePaise: R(40),
    addOnGroups: [weightGroup(R(40), R(80))],
    sortOrder: 12,
  },
  {
    id: "rd_strawberry",
    categoryId: "cat_rd_fresh_fruits",
    name: "Strawberry (10 Pcs Packet)",
    description: "Fresh sweet red garden strawberries packet.",
    isVeg: true,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 13,
  },
  {
    id: "rd_litchi",
    categoryId: "cat_rd_fresh_fruits",
    name: "Shahi Litchi",
    description: "Famous sweet and aromatic Muzaffarpur Shahi Litchis.",
    isVeg: true,
    pricePaise: R(60),
    isPopular: true,
    addOnGroups: [weightGroup(R(60), R(120))],
    sortOrder: 14,
  },
  {
    id: "rd_guava",
    categoryId: "cat_rd_fresh_fruits",
    name: "Guava (Amrood)",
    description: "Sweet fresh green Allahabad guavas.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [weightGroup(R(60), R(120))],
    sortOrder: 15,
  },

  // ── 2. FRESH JUICES & COCONUT WATER ──────────────────────────────────
  {
    id: "rd_coconut_water",
    categoryId: "cat_rd_fresh_juices",
    name: "Fresh Coconut Water (Daab)",
    description: "100% natural, refreshing green tender coconut water with malai.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "rd_mousambi_juice",
    categoryId: "cat_rd_fresh_juices",
    name: "Fresh Mousambi Juice",
    description: "Freshly squeezed sweet lime juice with no added preservatives.",
    isVeg: true,
    pricePaise: R(30),
    isPopular: true,
    addOnGroups: [portionGroup(R(30), R(50), "Small Glass (₹30)", "Large Glass (₹50)")],
    sortOrder: 2,
  },

  // ── 3. SPECIAL THALIS ────────────────────────────────────────────────
  {
    id: "rd_veg_thali",
    categoryId: "cat_rd_thalis",
    name: "Veg Thali",
    description: "Homestyle Dal + Seasonal Sabji + Rice + 2 Tawa Rotis + Salad.",
    isVeg: true,
    pricePaise: R(70),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "rd_veg_spl_thali",
    categoryId: "cat_rd_thalis",
    name: "Veg Special Thali",
    description: "Paneer Sabji + Dal Fry + Jeera Rice + 2 Butter Rotis + Salad + Papad / Sweet.",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "rd_egg_thali",
    categoryId: "cat_rd_thalis",
    name: "Egg Thali",
    description: "Egg Curry (2 Eggs) + Dal + Rice + 2 Rotis + Salad.",
    isVeg: false,
    pricePaise: R(100),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "rd_fish_thali",
    categoryId: "cat_rd_thalis",
    name: "Fish Thali",
    description: "Bihari Mustard Fish Curry + Rice + Dal + 2 Rotis + Salad.",
    isVeg: false,
    pricePaise: R(120),
    sortOrder: 4,
  },
  {
    id: "rd_chicken_thali",
    categoryId: "cat_rd_thalis",
    name: "Chicken Thali",
    description: "Spicy Chicken Curry + Dal + Rice + 2 Rotis + Salad.",
    isVeg: false,
    pricePaise: R(130),
    isPopular: true,
    sortOrder: 5,
  },
  {
    id: "rd_mutton_thali",
    categoryId: "cat_rd_thalis",
    name: "Mutton Thali",
    description: "Dehati Mutton Curry + Steamed Rice + Dal + 2 Rotis + Salad.",
    isVeg: false,
    pricePaise: R(150),
    isPopular: true,
    sortOrder: 6,
  },

  // ── 4. FAST FOOD & CHOWMEIN ──────────────────────────────────────────
  {
    id: "rd_veg_chowmein",
    categoryId: "cat_rd_fast_food",
    name: "Veg Chowmein",
    description: "Street style wok-tossed noodles with shredded vegetables.",
    isVeg: true,
    pricePaise: R(40),
    addOnGroups: [portionGroup(R(40), R(60))],
    sortOrder: 1,
  },
  {
    id: "rd_egg_chowmein",
    categoryId: "cat_rd_fast_food",
    name: "Egg Chowmein",
    description: "Noodles tossed with scrambled eggs and vegetables.",
    isVeg: false,
    pricePaise: R(50),
    addOnGroups: [portionGroup(R(50), R(80))],
    sortOrder: 2,
  },
  {
    id: "rd_chicken_chowmein",
    categoryId: "cat_rd_fast_food",
    name: "Chicken Chowmein",
    description: "Spicy wok noodles with seasoned chicken pieces.",
    isVeg: false,
    pricePaise: R(60),
    isPopular: true,
    addOnGroups: [portionGroup(R(60), R(100))],
    sortOrder: 3,
  },
  {
    id: "rd_manchurian_chowmein",
    categoryId: "cat_rd_fast_food",
    name: "Manchurian Chowmein",
    description: "Chowmein noodles combined with vegetable Manchurian balls.",
    isVeg: true,
    pricePaise: R(50),
    addOnGroups: [portionGroup(R(50), R(80))],
    sortOrder: 4,
  },
  {
    id: "rd_manchurian_dry",
    categoryId: "cat_rd_fast_food",
    name: "Veg Manchurian Dry",
    description: "Crispy fried vegetable balls tossed in garlic soya glaze.",
    isVeg: true,
    pricePaise: R(40),
    addOnGroups: [portionGroup(R(40), R(80))],
    sortOrder: 5,
  },
  {
    id: "rd_manchurian_gravy",
    categoryId: "cat_rd_fast_food",
    name: "Veg Manchurian Gravy",
    description: "Vegetable balls simmered in hot savoury Manchurian gravy.",
    isVeg: true,
    pricePaise: R(50),
    addOnGroups: [portionGroup(R(50), R(90))],
    sortOrder: 6,
  },

  // ── 5. ROLLS ─────────────────────────────────────────────────────────
  {
    id: "rd_veg_roll",
    categoryId: "cat_rd_rolls",
    name: "Veg Roll",
    description: "Spiced crunchy vegetable filling in a flaky paratha roll.",
    isVeg: true,
    pricePaise: R(50),
    sortOrder: 1,
  },
  {
    id: "rd_egg_roll",
    categoryId: "cat_rd_rolls",
    name: "Egg Roll",
    description: "Paratha wrapped around an egg layer with onions and sauces.",
    isVeg: false,
    pricePaise: R(60),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "rd_paneer_roll",
    categoryId: "cat_rd_rolls",
    name: "Paneer Roll",
    description: "Seasoned cottage cheese cubes with onions and tangy chutney.",
    isVeg: true,
    pricePaise: R(70),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "rd_chicken_roll",
    categoryId: "cat_rd_rolls",
    name: "Chicken Roll",
    description: "Juicy marinated roasted chicken in golden paratha.",
    isVeg: false,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 4,
  },
  {
    id: "rd_egg_chicken_roll",
    categoryId: "cat_rd_rolls",
    name: "Egg Chicken Roll",
    description: "Loaded combination of egg and roasted chicken chunks.",
    isVeg: false,
    pricePaise: R(100),
    isPopular: true,
    sortOrder: 5,
  },

  // ── 6. BIRYANI SPECIALS ──────────────────────────────────────────────
  {
    id: "rd_kolkata_biryani",
    categoryId: "cat_rd_biryani",
    name: "Kolkata Biryani",
    description: "Fragrant Kolkata spiced chicken dum biryani with potato.",
    isVeg: false,
    pricePaise: R(110),
    isPopular: true,
    addOnGroups: [portionGroup(R(110), R(220))],
    sortOrder: 1,
  },
  {
    id: "rd_hyderabadi_biryani",
    categoryId: "cat_rd_biryani",
    name: "Hyderabadi Biryani",
    description: "Rich spicy Hyderabadi dum biryani cooked with aromatic spices.",
    isVeg: false,
    pricePaise: R(130),
    isPopular: true,
    addOnGroups: [portionGroup(R(130), R(260))],
    sortOrder: 2,
  },

  // ── 7. PANEER SPECIALTIES ────────────────────────────────────────────
  {
    id: "rd_paneer_chilli",
    categoryId: "cat_rd_paneer_main",
    name: "Paneer Chilli",
    description: "Cottage cheese tossed with green bell peppers, onions and chillies.",
    isVeg: true,
    pricePaise: R(60),
    isPopular: true,
    addOnGroups: [portionGroup(R(60), R(100))],
    sortOrder: 1,
  },
  {
    id: "rd_paneer_curry",
    categoryId: "cat_rd_paneer_main",
    name: "Paneer Curry",
    description: "Homestyle spiced cottage cheese curry.",
    isVeg: true,
    pricePaise: R(90),
    addOnGroups: [portionGroup(R(90), R(150))],
    sortOrder: 2,
  },
  {
    id: "rd_paneer_kadhai",
    categoryId: "cat_rd_paneer_main",
    name: "Paneer Kadhai",
    description: "Paneer cooked in freshly ground kadai spices and capsicum.",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    addOnGroups: [portionGroup(R(100), R(160))],
    sortOrder: 3,
  },
  {
    id: "rd_paneer_masala",
    categoryId: "cat_rd_paneer_main",
    name: "Paneer Masala",
    description: "Cottage cheese in rich onion-tomato masala gravy.",
    isVeg: true,
    pricePaise: R(100),
    addOnGroups: [portionGroup(R(100), R(180))],
    sortOrder: 4,
  },
  {
    id: "rd_paneer_butter_masala",
    categoryId: "cat_rd_paneer_main",
    name: "Paneer Butter Masala",
    description: "Paneer cubes in silky buttery makhani sauce.",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    addOnGroups: [portionGroup(R(100), R(180))],
    sortOrder: 5,
  },
  {
    id: "rd_paneer_do_pyaza",
    categoryId: "cat_rd_paneer_main",
    name: "Paneer Do Pyaza",
    description: "Paneer simmered with double the onions in spiced gravy.",
    isVeg: true,
    pricePaise: R(80),
    addOnGroups: [portionGroup(R(80), R(150))],
    sortOrder: 6,
  },

  // ── 8. NON-VEG MAIN COURSE & FISH ────────────────────────────────────
  {
    id: "rd_chicken_chilli",
    categoryId: "cat_rd_nonveg_main",
    name: "Chicken Chilli",
    description: "Crispy chicken tossed in fiery chilli soya sauce.",
    isVeg: false,
    pricePaise: R(80),
    isPopular: true,
    addOnGroups: [portionGroup(R(80), R(160))],
    sortOrder: 1,
  },
  {
    id: "rd_chicken_curry",
    categoryId: "cat_rd_nonveg_main",
    name: "Chicken Curry",
    description: "Homestyle Bihari chicken curry.",
    isVeg: false,
    pricePaise: R(100),
    isPopular: true,
    addOnGroups: [portionGroup(R(100), R(180))],
    sortOrder: 2,
  },
  {
    id: "rd_chicken_kadai",
    categoryId: "cat_rd_nonveg_main",
    name: "Chicken Kadai",
    description: "Wok cooked chicken with roasted spices and capsicum.",
    isVeg: false,
    pricePaise: R(120),
    addOnGroups: [portionGroup(R(120), R(200))],
    sortOrder: 3,
  },
  {
    id: "rd_chicken_dehati",
    categoryId: "cat_rd_nonveg_main",
    name: "Chicken Dehati",
    description: "Authentic rustic Bihari claypot spicy chicken.",
    isVeg: false,
    pricePaise: R(240),
    isPopular: true,
    addOnGroups: [portionGroup(R(240), R(420))],
    sortOrder: 4,
  },
  {
    id: "rd_egg_curry",
    categoryId: "cat_rd_nonveg_main",
    name: "Egg Curry",
    description: "Boiled fried eggs simmered in rich gravy.",
    isVeg: false,
    pricePaise: R(40),
    addOnGroups: [portionGroup(R(40), R(80))],
    sortOrder: 5,
  },
  {
    id: "rd_egg_omelette",
    categoryId: "cat_rd_nonveg_main",
    name: "Egg Omelette",
    description: "Fresh egg omelette prepared with onions and chillies.",
    isVeg: false,
    pricePaise: R(20),
    addOnGroups: [portionGroup(R(20), R(35), "Single Egg", "Double Egg")],
    sortOrder: 6,
  },
  {
    id: "rd_egg_bhurji",
    categoryId: "cat_rd_nonveg_main",
    name: "Egg Bhurji",
    description: "Scrambled spiced eggs with tomatoes and coriander.",
    isVeg: false,
    pricePaise: R(20),
    addOnGroups: [portionGroup(R(20), R(35), "Single Egg", "Double Egg")],
    sortOrder: 7,
  },
  {
    id: "rd_fry_fish",
    categoryId: "cat_rd_nonveg_main",
    name: "Fry Fish",
    description: "Crispy shallow-fried fresh Rohu fish in mustard paste.",
    isVeg: false,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 8,
  },
  {
    id: "rd_fish_curry",
    categoryId: "cat_rd_nonveg_main",
    name: "Fish Curry",
    description: "Traditional mustard-based Bihari fish curry.",
    isVeg: false,
    pricePaise: R(90),
    isPopular: true,
    sortOrder: 9,
  },

  // ── 9. DALS & HOMESTYLE SABJI ────────────────────────────────────────
  {
    id: "rd_plain_dal",
    categoryId: "cat_rd_dal_sabji",
    name: "Plain Dal",
    description: "Simple homestyle yellow dal.",
    isVeg: true,
    pricePaise: R(30),
    sortOrder: 1,
  },
  {
    id: "rd_dal_fry",
    categoryId: "cat_rd_dal_sabji",
    name: "Dal Fry",
    description: "Yellow lentils tempered with ghee, garlic and jeera.",
    isVeg: true,
    pricePaise: R(50),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "rd_plain_veg",
    categoryId: "cat_rd_dal_sabji",
    name: "Plain Veg Sabji",
    description: "Homestyle seasonal vegetable sabji.",
    isVeg: true,
    pricePaise: R(30),
    sortOrder: 3,
  },
  {
    id: "rd_mix_veg",
    categoryId: "cat_rd_dal_sabji",
    name: "Mix Veg",
    description: "Assorted vegetables cooked in North Indian curry.",
    isVeg: true,
    pricePaise: R(50),
    sortOrder: 4,
  },

  // ── 10. RICE & FRIED RICE ────────────────────────────────────────────
  {
    id: "rd_plain_rice",
    categoryId: "cat_rd_rice",
    name: "Plain Rice",
    description: "Steamed fluffy long grain rice.",
    isVeg: true,
    pricePaise: R(30),
    addOnGroups: [portionGroup(R(30), R(60))],
    sortOrder: 1,
  },
  {
    id: "rd_jeera_rice",
    categoryId: "cat_rd_rice",
    name: "Jeera Rice",
    description: "Basmati rice tempered with roasted cumin seeds.",
    isVeg: true,
    pricePaise: R(40),
    addOnGroups: [portionGroup(R(40), R(70))],
    sortOrder: 2,
  },
  {
    id: "rd_fry_rice",
    categoryId: "cat_rd_rice",
    name: "Veg Fried Rice",
    description: "Wok tossed fried rice with seasonal vegetables.",
    isVeg: true,
    pricePaise: R(40),
    isPopular: true,
    addOnGroups: [portionGroup(R(40), R(70))],
    sortOrder: 3,
  },

  // ── 11. TAWA ROTIS & SATTU PARATHAS ──────────────────────────────────
  {
    id: "rd_tawa_plain_roti",
    categoryId: "cat_rd_rotis",
    name: "Tawa Plain Roti",
    description: "Fresh hot whole wheat tawa phulka.",
    isVeg: true,
    pricePaise: R(10),
    sortOrder: 1,
  },
  {
    id: "rd_tawa_butter_roti",
    categoryId: "cat_rd_rotis",
    name: "Tawa Butter Roti",
    description: "Tawa roti brushed with butter.",
    isVeg: true,
    pricePaise: R(12),
    sortOrder: 2,
  },
  {
    id: "rd_plain_paratha",
    categoryId: "cat_rd_rotis",
    name: "Plain Paratha",
    description: "Golden pan-fried flatbread.",
    isVeg: true,
    pricePaise: R(15),
    sortOrder: 3,
  },
  {
    id: "rd_aloo_paratha",
    categoryId: "cat_rd_rotis",
    name: "Aloo Paratha",
    description: "Stuffed with spiced mashed potato filling.",
    isVeg: true,
    pricePaise: R(20),
    isPopular: true,
    sortOrder: 4,
  },
  {
    id: "rd_sattu_paratha",
    categoryId: "cat_rd_rotis",
    name: "Bihari Sattu Paratha",
    description: "Famous authentic Bihari paratha stuffed with spicy roasted gram flour (sattu), ajwain & pickle masala.",
    isVeg: true,
    pricePaise: R(35),
    isPopular: true,
    sortOrder: 5,
  },
  {
    id: "rd_paneer_paratha",
    categoryId: "cat_rd_rotis",
    name: "Paneer Paratha",
    description: "Stuffed with seasoned grated paneer.",
    isVeg: true,
    pricePaise: R(50),
    sortOrder: 6,
  },

  // ── 12. SOUPS & BURGERS ──────────────────────────────────────────────
  {
    id: "rd_tomato_soup",
    categoryId: "cat_rd_soups_burgers",
    name: "Tomato Soup",
    description: "Warm soothing creamy tomato soup.",
    isVeg: true,
    pricePaise: R(50),
    sortOrder: 1,
  },
  {
    id: "rd_veg_corn_soup",
    categoryId: "cat_rd_soups_burgers",
    name: "Veg Corn Soup",
    description: "Sweet corn vegetable soup.",
    isVeg: true,
    pricePaise: R(50),
    sortOrder: 2,
  },
  {
    id: "rd_chicken_soup",
    categoryId: "cat_rd_soups_burgers",
    name: "Chicken Soup",
    description: "Comforting hot pepper chicken broth.",
    isVeg: false,
    pricePaise: R(60),
    sortOrder: 3,
  },
  {
    id: "rd_chicken_corn_soup",
    categoryId: "cat_rd_soups_burgers",
    name: "Chicken Corn Soup",
    description: "Sweet corn soup with shredded chicken.",
    isVeg: false,
    pricePaise: R(80),
    sortOrder: 4,
  },
  {
    id: "rd_burger",
    categoryId: "cat_rd_soups_burgers",
    name: "Veg Burger",
    description: "Crispy vegetable patty in toasted bun with mayo.",
    isVeg: true,
    pricePaise: R(50),
    sortOrder: 5,
  },
  {
    id: "rd_chicken_burger",
    categoryId: "cat_rd_soups_burgers",
    name: "Chicken Burger",
    description: "Crispy chicken burger with lettuce and sauce.",
    isVeg: false,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 6,
  },

  // ── 13. TEA, COFFEE & ICE CREAM ──────────────────────────────────────
  {
    id: "rd_kulhar_chai",
    categoryId: "cat_rd_tea_icecream",
    name: "Kulhar Chai",
    description: "Aromatic earthen pot smoky milk tea.",
    isVeg: true,
    pricePaise: R(10),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "rd_cup_chai",
    categoryId: "cat_rd_tea_icecream",
    name: "Cup Chai",
    description: "Standard hot brewed milk tea.",
    isVeg: true,
    pricePaise: R(15),
    sortOrder: 2,
  },
  {
    id: "rd_coffee",
    categoryId: "cat_rd_tea_icecream",
    name: "Hot Coffee",
    description: "Steaming hot frothy coffee.",
    isVeg: true,
    pricePaise: R(15),
    sortOrder: 3,
  },
  {
    id: "rd_vanilla_icecream",
    categoryId: "cat_rd_tea_icecream",
    name: "Vanilla Ice Cream Cup",
    description: "Chilled scoop of classic vanilla ice cream.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 4,
  },
  {
    id: "rd_chocolate_icecream",
    categoryId: "cat_rd_tea_icecream",
    name: "Chocolate Ice Cream Cup",
    description: "Rich chocolate ice cream cup.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 5,
  },
  {
    id: "rd_strawberry_icecream",
    categoryId: "cat_rd_tea_icecream",
    name: "Strawberry Ice Cream Cup",
    description: "Sweet strawberry ice cream cup.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 6,
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Main Seed Runner
   ══════════════════════════════════════════════════════════════════════ */

export async function seedRajDarbar(): Promise<void> {
  console.log("=== Onboarding Raj Darbar ===");

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
    slug: "raj-darbar",
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
    phone: "7209046762",
    description:
      "Raj Darbar - Exclusive campus provider of Farm-Fresh Fruits, Fresh Juices & Coconut Water alongside Homestyle Bihari Meals, Fast Food, Thalis, Rolls & Biryani.",
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
    rating: 4.8,
    ratingCount: 52,
    kyc: {
      status: "APPROVED",
      ownerName: "Raj Darbar Manager",
      ownerPhone: "7209046762",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Raj Darbar",
      accountNumber: "720904676200",
      ifsc: "SBIN0001234",
      upiId: "7209046762@upi",
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
    name: "Raj Darbar Manager",
    email: VENDOR_EMAIL,
    phone: "7209046762",
    passwordHash: hashPassword("RajDarbar@2026"),
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
  console.log(`[x] ${itemDocs.length} menu items seeded with portion & weight options.`);

  console.log("\n=== Raj Darbar Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Admin Menu URL: /admin/vendors/${RESTAURANT_ID}/menu`);
  console.log(`  - Vendor Login: ${VENDOR_EMAIL} / RajDarbar@2026`);
}

async function main() {
  try {
    await seedRajDarbar();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-raj-darbar")) {
  main().catch((err) => {
    console.error("Failed to seed Raj Darbar:", err);
    process.exit(1);
  });
}
