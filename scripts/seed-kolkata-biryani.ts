/**
 * Kolkata Biryani Fast-Food Pizza House Onboarding & Menu Seeding Script.
 *
 * Seeds:
 * 1. The restaurant profile for Kolkata Biryani Fast-Food Pizza House
 * 2. The vendor account login (kolkatabiryani273@gmail.com / kolkatatraefood123)
 * 3. All categories and 40 menu items transcribed from official menu photo
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-kolkata-biryani.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise, type Paise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { AddOnGroup, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

const RESTAURANT_ID = "rest_kolkata_biryani_nitp";
const VENDOR_USER_ID = "usr_kolkata_biryani_vendor";
const VENDOR_EMAIL = "kolkatabiryani273@gmail.com";

const R = rupeesToPaise;

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

/* ══════════════════════════════════════════════════════════════════════
   Categories
   ══════════════════════════════════════════════════════════════════════ */

const CATEGORIES: { id: string; name: string; sortOrder: number }[] = [
  { id: "cat_kb_biryani", name: "Biryani Specials", sortOrder: 1 },
  { id: "cat_kb_rolls", name: "Rolls & Breads", sortOrder: 2 },
  { id: "cat_kb_chowmein", name: "Chowmein & Noodles", sortOrder: 3 },
  { id: "cat_kb_rice", name: "Fried Rice", sortOrder: 4 },
  { id: "cat_kb_starters", name: "Starters & Chilli", sortOrder: 5 },
  { id: "cat_kb_curry", name: "Main Course", sortOrder: 6 },
  { id: "cat_kb_momos_soup", name: "Momos & Soups", sortOrder: 7 },
  { id: "cat_kb_burgers_pasta", name: "Burgers & Pasta", sortOrder: 8 },
  { id: "cat_kb_pizza", name: "Pizza House", sortOrder: 9 },
  { id: "cat_kb_beverages", name: "Beverages & Desserts", sortOrder: 10 },
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
  // ── 1. BIRYANI SPECIALS ──────────────────────────────────────────────
  {
    id: "kb_chicken_biryani",
    categoryId: "cat_kb_biryani",
    name: "Chicken Biryani",
    description: "Authentic fragrant Kolkata style spiced dum biryani with tender chicken.",
    isVeg: false,
    pricePaise: R(120),
    isPopular: true,
    addOnGroups: [portionGroup(R(120), R(240))],
    sortOrder: 1,
  },
  {
    id: "kb_egg_biryani",
    categoryId: "cat_kb_biryani",
    name: "Egg Biryani",
    description: "Aromatic basmati rice cooked with boiled spiced eggs and rich gravy.",
    isVeg: false,
    pricePaise: R(100),
    addOnGroups: [portionGroup(R(100), R(200))],
    sortOrder: 2,
  },
  {
    id: "kb_mutton_biryani",
    categoryId: "cat_kb_biryani",
    name: "Mutton Biryani",
    description: "Slow-cooked royal biryani with succulent mutton pieces and potatoes.",
    isVeg: false,
    pricePaise: R(180),
    isPopular: true,
    addOnGroups: [portionGroup(R(180), R(360))],
    sortOrder: 3,
  },
  {
    id: "kb_hyderabadi_biryani",
    categoryId: "cat_kb_biryani",
    name: "Hyderabadi Biryani",
    description: "Spicy Hyderabadi dum biryani cooked with rich saffron masala.",
    isVeg: false,
    pricePaise: R(240),
    isPopular: true,
    sortOrder: 4,
  },

  // ── 2. ROLLS & BREADS ────────────────────────────────────────────────
  {
    id: "kb_laccha_paratha",
    categoryId: "cat_kb_rolls",
    name: "Laccha Paratha",
    description: "Crispy layered flaky multi-layered flatbread.",
    isVeg: true,
    pricePaise: R(30),
    sortOrder: 1,
  },
  {
    id: "kb_veg_roll",
    categoryId: "cat_kb_rolls",
    name: "Veg Roll",
    description: "Crunchy spiced vegetables wrapped in a hot paratha.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 2,
  },
  {
    id: "kb_double_egg_roll",
    categoryId: "cat_kb_rolls",
    name: "Double Egg Roll",
    description: "Classic street roll with double egg layer, sliced onions and tangy sauce.",
    isVeg: false,
    pricePaise: R(70),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "kb_paneer_roll",
    categoryId: "cat_kb_rolls",
    name: "Paneer Roll",
    description: "Seasoned cottage cheese cubes rolled with zesty onions and chutney.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 4,
  },
  {
    id: "kb_chicken_egg_roll",
    categoryId: "cat_kb_rolls",
    name: "Chicken Egg Roll",
    description: "Juicy marinated chicken and egg loaded roll.",
    isVeg: false,
    pricePaise: R(100),
    isPopular: true,
    sortOrder: 5,
  },

  // ── 3. CHOWMEIN & NOODLES ────────────────────────────────────────────
  {
    id: "kb_veg_chowmin",
    categoryId: "cat_kb_chowmein",
    name: "Veg Chowmein",
    description: "Stir-fried street style noodles with shredded fresh vegetables.",
    isVeg: true,
    pricePaise: R(50),
    addOnGroups: [portionGroup(R(50), R(90))],
    sortOrder: 1,
  },
  {
    id: "kb_egg_chowmin",
    categoryId: "cat_kb_chowmein",
    name: "Egg Chowmein",
    description: "Wok tossed noodles scrambled with eggs and crunchy greens.",
    isVeg: false,
    pricePaise: R(70),
    addOnGroups: [portionGroup(R(70), R(140))],
    sortOrder: 2,
  },
  {
    id: "kb_paneer_chowmin",
    categoryId: "cat_kb_chowmein",
    name: "Paneer Chowmein",
    description: "Noodles tossed with soft paneer cubes in Indo-Chinese sauce.",
    isVeg: true,
    pricePaise: R(80),
    addOnGroups: [portionGroup(R(80), R(160))],
    sortOrder: 3,
  },
  {
    id: "kb_chicken_chowmin",
    categoryId: "cat_kb_chowmein",
    name: "Chicken Chowmein",
    description: "Spicy wok-tossed noodles with seasoned chicken pieces.",
    isVeg: false,
    pricePaise: R(100),
    isPopular: true,
    addOnGroups: [portionGroup(R(100), R(200))],
    sortOrder: 4,
  },

  // ── 4. FRIED RICE ────────────────────────────────────────────────────
  {
    id: "kb_veg_fried_rice",
    categoryId: "cat_kb_rice",
    name: "Veg Fried Rice",
    description: "Classic wok-tossed rice with spring onions, carrots and soya sauce.",
    isVeg: true,
    pricePaise: R(120),
    sortOrder: 1,
  },
  {
    id: "kb_egg_chicken_fried_rice",
    categoryId: "cat_kb_rice",
    name: "Egg Chicken Fried Rice",
    description: "Fragrant fried rice loaded with scrambled egg and chicken chunks.",
    isVeg: false,
    pricePaise: R(160),
    isPopular: true,
    sortOrder: 2,
  },

  // ── 5. STARTERS & CHILLI ─────────────────────────────────────────────
  {
    id: "kb_potato_chilli",
    categoryId: "cat_kb_starters",
    name: "Potato Chilli",
    description: "Crispy fried potatoes tossed in spicy chilli garlic sauce.",
    isVeg: true,
    pricePaise: R(70),
    addOnGroups: [portionGroup(R(70), R(140))],
    sortOrder: 1,
  },
  {
    id: "kb_paneer_chilli",
    categoryId: "cat_kb_starters",
    name: "Paneer Chilli",
    description: "Fried cottage cheese cubes tossed in spicy chilli soya glaze.",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    addOnGroups: [portionGroup(R(100), R(200))],
    sortOrder: 2,
  },
  {
    id: "kb_baby_corn_chilli",
    categoryId: "cat_kb_starters",
    name: "Baby Corn Chilli",
    description: "Crispy golden baby corn tossed in hot chilli sauce.",
    isVeg: true,
    pricePaise: R(160),
    addOnGroups: [portionGroup(R(160), R(320))],
    sortOrder: 3,
  },
  {
    id: "kb_mushroom_chilli",
    categoryId: "cat_kb_starters",
    name: "Mushroom Chilli",
    description: "Fresh mushrooms battered and fried in spicy Indo-Chinese sauce.",
    isVeg: true,
    pricePaise: R(100),
    addOnGroups: [portionGroup(R(100), R(200))],
    sortOrder: 4,
  },
  {
    id: "kb_paneer_pakoda",
    categoryId: "cat_kb_starters",
    name: "Paneer Pakoda (10 Pcs)",
    description: "Gram-flour coated crispy golden paneer fritters served with chutney.",
    isVeg: true,
    pricePaise: R(200),
    sortOrder: 5,
  },
  {
    id: "kb_manchurian",
    categoryId: "cat_kb_starters",
    name: "Veg Manchurian",
    description: "Crisp vegetable dumplings in rich savoury Manchurian gravy.",
    isVeg: true,
    pricePaise: R(120),
    sortOrder: 6,
  },
  {
    id: "kb_chicken_chilli_bone",
    categoryId: "cat_kb_starters",
    name: "Chicken Chilli (Bone)",
    description: "Bone-in tender chicken tossed in spicy green chilli garlic sauce.",
    isVeg: false,
    pricePaise: R(100),
    addOnGroups: [portionGroup(R(100), R(200))],
    sortOrder: 7,
  },
  {
    id: "kb_chicken_chilli_boneless",
    categoryId: "cat_kb_starters",
    name: "Chicken Chilli (Boneless)",
    description: "Boneless chicken morsels tossed in fiery chilli pepper gravy.",
    isVeg: false,
    pricePaise: R(100),
    isPopular: true,
    addOnGroups: [portionGroup(R(100), R(200))],
    sortOrder: 8,
  },
  {
    id: "kb_chicken_lollipop",
    categoryId: "cat_kb_starters",
    name: "Chicken Lollipop (5 Pcs)",
    description: "Crispy frenched chicken drumettes fried to perfection with hot dip.",
    isVeg: false,
    pricePaise: R(300),
    isPopular: true,
    sortOrder: 9,
  },

  // ── 6. MAIN COURSE ───────────────────────────────────────────────────
  {
    id: "kb_paneer_do_pyaza",
    categoryId: "cat_kb_curry",
    name: "Paneer Do Pyaza",
    description: "Cottage cheese simmered in rich gravy with double the onions.",
    isVeg: true,
    pricePaise: R(200),
    sortOrder: 1,
  },
  {
    id: "kb_chicken_curry",
    categoryId: "cat_kb_curry",
    name: "Chicken Curry",
    description: "Home style spicy Kolkata chicken curry cooked in aromatic spices.",
    isVeg: false,
    pricePaise: R(220),
    isPopular: true,
    sortOrder: 2,
  },

  // ── 7. MOMOS & SOUPS ─────────────────────────────────────────────────
  {
    id: "kb_veg_momo",
    categoryId: "cat_kb_momos_soup",
    name: "Veg Momo",
    description: "Steamed vegetable dumplings served with spicy red chutney.",
    isVeg: true,
    pricePaise: R(40),
    addOnGroups: [portionGroup(R(40), R(70))],
    sortOrder: 1,
  },
  {
    id: "kb_paneer_momo",
    categoryId: "cat_kb_momos_soup",
    name: "Paneer Momo",
    description: "Delicious steamed momos stuffed with spiced paneer filling.",
    isVeg: true,
    pricePaise: R(40),
    addOnGroups: [portionGroup(R(40), R(80))],
    sortOrder: 2,
  },
  {
    id: "kb_paneer_soup",
    categoryId: "cat_kb_momos_soup",
    name: "Paneer Soup",
    description: "Warm soothing soup with paneer cubes and herbs.",
    isVeg: true,
    pricePaise: R(60),
    sortOrder: 3,
  },
  {
    id: "kb_chicken_soup",
    categoryId: "cat_kb_momos_soup",
    name: "Chicken Soup",
    description: "Hot comforting chicken broth soup with pepper.",
    isVeg: false,
    pricePaise: R(80),
    sortOrder: 4,
  },

  // ── 8. BURGERS & PASTA ───────────────────────────────────────────────
  {
    id: "kb_burger",
    categoryId: "cat_kb_burgers_pasta",
    name: "Veg Burger",
    description: "Crispy potato veggie patty in toasted sesame bun with mayo.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 1,
  },
  {
    id: "kb_paneer_special_burger",
    categoryId: "cat_kb_burgers_pasta",
    name: "Paneer Special Burger",
    description: "Grilled paneer patty topped with special cheese sauce.",
    isVeg: true,
    pricePaise: R(60),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "kb_chicken_burger",
    categoryId: "cat_kb_burgers_pasta",
    name: "Chicken Burger",
    description: "Crispy fried chicken patty layered with lettuce and mayo.",
    isVeg: false,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "kb_pasta",
    categoryId: "cat_kb_burgers_pasta",
    name: "Pasta",
    description: "Delicious penne pasta tossed in savoury spicy sauce.",
    isVeg: true,
    pricePaise: R(50),
    addOnGroups: [portionGroup(R(50), R(100))],
    sortOrder: 4,
  },

  // ── 9. PIZZA HOUSE ───────────────────────────────────────────────────
  {
    id: "kb_onion_pizza",
    categoryId: "cat_kb_pizza",
    name: "Onion Pizza",
    description: "Classic pizza topped with crisp sliced onions and mozzarella cheese.",
    isVeg: true,
    pricePaise: R(99),
    sortOrder: 1,
  },
  {
    id: "kb_paneer_tikka_pizza",
    categoryId: "cat_kb_pizza",
    name: "Paneer Tikka Pizza",
    description: "Topped with tandoori marinated paneer, capsicum and melted cheese.",
    isVeg: true,
    pricePaise: R(180),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "kb_onion_paneer_pizza",
    categoryId: "cat_kb_pizza",
    name: "Onion Paneer Pizza",
    description: "Loaded combination of crunchy onions and diced paneer.",
    isVeg: true,
    pricePaise: R(200),
    sortOrder: 3,
  },
  {
    id: "kb_chicken_pizza",
    categoryId: "cat_kb_pizza",
    name: "Chicken Pizza",
    description: "Loaded with spiced chicken chunks and melted mozzarella.",
    isVeg: false,
    pricePaise: R(200),
    isPopular: true,
    sortOrder: 4,
  },

  // ── 10. BEVERAGES & DESSERTS ─────────────────────────────────────────
  {
    id: "kb_tea",
    categoryId: "cat_kb_beverages",
    name: "Hot Tea",
    description: "Freshly brewed hot milk tea.",
    isVeg: true,
    pricePaise: R(15),
    sortOrder: 1,
  },
  {
    id: "kb_ice_cream",
    categoryId: "cat_kb_beverages",
    name: "Ice Cream",
    description: "Chilled scoop of delicious vanilla ice cream.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 2,
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Main Seed Runner
   ══════════════════════════════════════════════════════════════════════ */

export async function seedKolkataBiryani(): Promise<void> {
  console.log("=== Onboarding Kolkata Biryani Fast-Food Pizza House ===");

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
    slug: "kolkata-biryani-fast-food-pizza-house",
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
    phone: "6203875025",
    description:
      "Kolkata Biryani Fast-Food Pizza House - Delicious Kolkata Dum Biryani, Rolls, Fried Rice, Chowmein, Chilli Starters, Momos & Pizzas at NIT Patna.",
    imageUrl: null,
    bannerUrl: null,
    packagingFeePaise: R(10),
    minOrderPaise: R(50),
    prepMinutes: 15,
    foodGstBps: 0,
    commissionBpsOverride: null,
    servedZoneIds,
    opensMinutes: 0, // Open for campus orders
    closesMinutes: 1439,
    isOpen: true,
    isApproved: true,
    rating: 4.6,
    ratingCount: 34,
    kyc: {
      status: "APPROVED",
      ownerName: "Kolkata Biryani Manager",
      ownerPhone: "6203875025",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Kolkata Biryani Pizza House",
      accountNumber: "620387502500",
      ifsc: "SBIN0001234",
      upiId: "6203875025@upi",
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
    name: "Kolkata Biryani Manager",
    email: VENDOR_EMAIL,
    phone: "6203875025",
    passwordHash: hashPassword("kolkatatraefood123"),
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
  console.log(`[x] ${itemDocs.length} menu items seeded with portion & size options.`);

  console.log("\n=== Kolkata Biryani Fast-Food Pizza House Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Admin Menu URL: /admin/vendors/${RESTAURANT_ID}/menu`);
  console.log(`  - Vendor Login: ${VENDOR_EMAIL} / kolkatatraefood123`);
}

async function main() {
  try {
    await seedKolkataBiryani();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-kolkata")) {
  main().catch((err) => {
    console.error("Failed to seed Kolkata Biryani:", err);
    process.exit(1);
  });
}
