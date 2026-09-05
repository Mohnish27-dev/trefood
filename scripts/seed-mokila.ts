/**
 * Mokila Restaurant (Bihta) Onboarding & Menu Seeding Script.
 *
 * Menu Sections:
 * - Rolls (Egg Roll 2 Eggs, Paneer Roll, Chicken Roll, Veg Roll)
 * - Burgers (Paneer Burger, Normal Burger, Egg Burger)
 * - Manchurian (Veg Manchurian)
 * - Chilli & Gravy (Chicken Chilli 4 Pcs, Paneer Chilli 8 Pcs, Chicken Gravy Half/Full)
 * - Chowmein (Veg Chowmein, Egg Chowmein 4 Eggs, Chicken Chowmein 4 Pcs)
 * - Breads (Lachha Paratha 1 Pc, Normal Roti 1 Pc)
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-mokila.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise, type Paise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { AddOnGroup, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

const RESTAURANT_ID = "rest_mokila_nitp";
const VENDOR_USER_ID = "usr_mokila_vendor";
const VENDOR_EMAIL = "mokila.nitp@trefood.in";

const R = rupeesToPaise;

function portionGroup(halfPaise: Paise, fullPaise: Paise, label1 = "Half", label2 = "Full"): AddOnGroup {
  return {
    id: "grp_portion",
    name: "Portion Size",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_portion_half", name: label1, pricePaise: 0, isAvailable: true },
      { id: "opt_portion_full", name: label2, pricePaise: fullPaise - halfPaise, isAvailable: true },
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Categories
   ══════════════════════════════════════════════════════════════════════ */

const CATEGORIES: { id: string; name: string; sortOrder: number }[] = [
  { id: "cat_mr_rolls", name: "Rolls", sortOrder: 1 },
  { id: "cat_mr_burgers", name: "Burgers", sortOrder: 2 },
  { id: "cat_mr_manchurian", name: "Manchurian", sortOrder: 3 },
  { id: "cat_mr_chilli_gravy", name: "Chilli & Gravy", sortOrder: 4 },
  { id: "cat_mr_chowmein", name: "Chowmein & Noodles", sortOrder: 5 },
  { id: "cat_mr_breads", name: "Breads & Parathas", sortOrder: 6 },
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
  // ── 1. ROLLS ─────────────────────────────────────────────────────────
  {
    id: "mr_veg_roll",
    categoryId: "cat_mr_rolls",
    name: "Veg Roll",
    description: "Crisp and crunchy spiced vegetable filling wrapped in a flaky golden paratha.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 1,
  },
  {
    id: "mr_egg_roll_2eggs",
    categoryId: "cat_mr_rolls",
    name: "Egg Roll (2 Eggs)",
    description: "Classic street roll with double egg layer, chopped onions, green chillies and tangy sauces.",
    isVeg: false,
    pricePaise: R(50),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "mr_paneer_roll",
    categoryId: "cat_mr_rolls",
    name: "Paneer Roll",
    description: "Fresh seasoned cottage cheese cubes tossed with sliced onions and mint mayo.",
    isVeg: true,
    pricePaise: R(60),
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "mr_chicken_roll",
    categoryId: "cat_mr_rolls",
    name: "Chicken Roll",
    description: "Juicy marinated roasted chicken chunks rolled in a hot paratha with salad.",
    isVeg: false,
    pricePaise: R(80),
    isPopular: true,
    sortOrder: 4,
  },

  // ── 2. BURGERS ───────────────────────────────────────────────────────
  {
    id: "mr_normal_burger",
    categoryId: "cat_mr_burgers",
    name: "Normal Burger (Veg)",
    description: "Crispy potato patty in toasted sesame bun with lettuce and creamy mayo.",
    isVeg: true,
    pricePaise: R(30),
    sortOrder: 1,
  },
  {
    id: "mr_paneer_burger",
    categoryId: "cat_mr_burgers",
    name: "Paneer Burger",
    description: "Thick grilled cottage cheese slice seasoned with special herbs and sauce.",
    isVeg: true,
    pricePaise: R(40),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "mr_egg_burger",
    categoryId: "cat_mr_burgers",
    name: "Egg Burger",
    description: "Toasted burger layered with seasoned fluffy fried egg and sliced onions.",
    isVeg: false,
    pricePaise: R(50),
    isPopular: true,
    sortOrder: 3,
  },

  // ── 3. MANCHURIAN ────────────────────────────────────────────────────
  {
    id: "mr_veg_manchurian",
    categoryId: "cat_mr_manchurian",
    name: "Veg Manchurian",
    description: "Crispy fried vegetable dumplings tossed in savoury garlic soya sauce.",
    isVeg: true,
    pricePaise: R(70),
    isPopular: true,
    sortOrder: 1,
  },

  // ── 4. CHILLI & GRAVY ────────────────────────────────────────────────
  {
    id: "mr_chicken_chilli_4pcs",
    categoryId: "cat_mr_chilli_gravy",
    name: "Chicken Chilli (4 Pieces)",
    description: "Tender chicken morsels tossed in spicy green chilli garlic soya glaze with bell peppers.",
    isVeg: false,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "mr_paneer_chilli_8pcs",
    categoryId: "cat_mr_chilli_gravy",
    name: "Paneer Chilli (8 Pieces)",
    description: "Fried cottage cheese cubes tossed with capsicum, crunchy onions and chillies.",
    isVeg: true,
    pricePaise: R(140),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "mr_chicken_gravy",
    categoryId: "cat_mr_chilli_gravy",
    name: "Chicken Gravy",
    description: "Flavorful homestyle chicken curry cooked in aromatic spices and thick gravy.",
    isVeg: false,
    pricePaise: R(150),
    isPopular: true,
    addOnGroups: [portionGroup(R(150), R(240))],
    sortOrder: 3,
  },

  // ── 5. CHOWMEIN & NOODLES ────────────────────────────────────────────
  {
    id: "mr_veg_chowmein",
    categoryId: "cat_mr_chowmein",
    name: "Veg Chowmein",
    description: "Desi street style wok-tossed noodles with cabbage, carrots, capsicum and soya sauce.",
    isVeg: true,
    pricePaise: R(60),
    sortOrder: 1,
  },
  {
    id: "mr_egg_chowmein_4eggs",
    categoryId: "cat_mr_chowmein",
    name: "Egg Chowmein (4 Eggs)",
    description: "Loaded noodles scrambled with 4 fresh eggs, shredded vegetables and spices.",
    isVeg: false,
    pricePaise: R(110),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "mr_chicken_chowmein_4pcs",
    categoryId: "cat_mr_chowmein",
    name: "Chicken Chowmein (4 Pieces)",
    description: "Spicy wok-tossed noodles loaded with 4 pieces of seasoned tender chicken.",
    isVeg: false,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 3,
  },

  // ── 6. BREADS & PARATHAS ─────────────────────────────────────────────
  {
    id: "mr_normal_roti",
    categoryId: "cat_mr_breads",
    name: "Normal Roti (1 Piece)",
    description: "Freshly made hot whole wheat tawa roti.",
    isVeg: true,
    pricePaise: R(15),
    sortOrder: 1,
  },
  {
    id: "mr_lachha_paratha",
    categoryId: "cat_mr_breads",
    name: "Lachha Paratha (1 Piece)",
    description: "Multi-layered crispy, flaky golden pan-fried paratha.",
    isVeg: true,
    pricePaise: R(30),
    isPopular: true,
    sortOrder: 2,
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Main Seed Runner
   ══════════════════════════════════════════════════════════════════════ */

export async function seedMokila(): Promise<void> {
  console.log("=== Onboarding Mokila Restaurant (Bihta) ===");

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
    slug: "mokila-restaurant",
    name: "Mokila Restaurant",
    cuisines: [
      "Rolls",
      "Burgers",
      "Chowmein",
      "Chinese",
      "Chilli & Gravy",
      "Fast Food",
      "North Indian",
    ],
    phone: "9876543214",
    description:
      "Mokila Restaurant Bihta - Good Food Good Mood. Freshly prepared Rolls, Burgers, Manchurian, Chilli & Gravy, Chowmein and Lachha Parathas delivered fast.",
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
    rating: 4.7,
    ratingCount: 36,
    kyc: {
      status: "APPROVED",
      ownerName: "Mokila Restaurant Manager",
      ownerPhone: "9876543214",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Mokila Restaurant",
      accountNumber: "987654321400",
      ifsc: "SBIN0001234",
      upiId: "mokila@upi",
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
    name: "Mokila Manager",
    email: VENDOR_EMAIL,
    phone: "9876543214",
    passwordHash: hashPassword("Mokila@2026"),
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
  console.log(`[x] ${itemDocs.length} menu items seeded with portion options.`);

  console.log("\n=== Mokila Restaurant Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Admin Menu URL: /admin/vendors/${RESTAURANT_ID}/menu`);
  console.log(`  - Vendor Login: ${VENDOR_EMAIL} / Mokila@2026`);
}

async function main() {
  try {
    await seedMokila();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-mokila")) {
  main().catch((err) => {
    console.error("Failed to seed Mokila Restaurant:", err);
    process.exit(1);
  });
}
