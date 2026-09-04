/**
 * Prince Juice & Shakes Corner Onboarding & Menu Seeding Script.
 *
 * Menu:
 * - Special Thick Shakes (Small / Medium / Large)
 * - Fresh Fruit & Sugarcane Juices (Small / Medium / Large)
 * - Mix Fruit Chaat & Fresh Tender Coconut (Dabh)
 * - Complete Farm-Fresh Fruits Selection (Apples, Pomegranates, Kiwi, Bananas, Papayas, Grapes, etc.)
 *
 * Contact & Location:
 *   Prop: Kumar Bablu | Mob: 9113723907, 9234761050
 *   Address: In front of NIT Campus, Sikanderpur, Bihta, Patna
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-prince-juice.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise, type Paise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { AddOnGroup, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

const RESTAURANT_ID = "rest_prince_juice_nitp";
const VENDOR_USER_ID = "usr_prince_juice_vendor";
const VENDOR_EMAIL = "princejuice.nitp@trefood.in";

const R = rupeesToPaise;

function beverageSizeGroup(prices: { small: Paise; medium: Paise; large: Paise }): AddOnGroup {
  return {
    id: "grp_beverage_size",
    name: "Cup Size",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_size_small", name: "Small", pricePaise: 0, isAvailable: true },
      { id: "opt_size_medium", name: "Medium", pricePaise: prices.medium - prices.small, isAvailable: true },
      { id: "opt_size_large", name: "Large", pricePaise: prices.large - prices.small, isAvailable: true },
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

function portionGroup(halfPaise: Paise, fullPaise: Paise, label1 = "Half", label2 = "Full"): AddOnGroup {
  return {
    id: "grp_portion",
    name: "Portion / Quantity",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_portion_1", name: label1, pricePaise: 0, isAvailable: true },
      { id: "opt_portion_2", name: label2, pricePaise: fullPaise - halfPaise, isAvailable: true },
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Categories
   ══════════════════════════════════════════════════════════════════════ */

const CATEGORIES: { id: string; name: string; sortOrder: number }[] = [
  { id: "cat_pj_shakes", name: "Special Thick Shakes", sortOrder: 1 },
  { id: "cat_pj_juices", name: "Fresh Fruit & Sugarcane Juices", sortOrder: 2 },
  { id: "cat_pj_chaat_coconut", name: "Fruit Chaat & Fresh Coconut Water", sortOrder: 3 },
  { id: "cat_pj_fresh_fruits", name: "Farm-Fresh Fruits (By KG / Pack)", sortOrder: 4 },
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
  // ── 1. SPECIAL THICK SHAKES (Small / Medium / Large) ─────────────────
  {
    id: "pj_oreo_shake",
    categoryId: "cat_pj_shakes",
    name: "Oreo Shake (ओरियो शेक)",
    description: "Thick creamy shake blended with real crunchy Oreo cookies and ice cream.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(80), medium: R(120), large: R(150) })],
    sortOrder: 1,
  },
  {
    id: "pj_kitkat_shake",
    categoryId: "cat_pj_shakes",
    name: "KitKat Shake (किटकेट शेक)",
    description: "Delicious thick chocolate shake blended with crunchy KitKat bars.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(80), medium: R(120), large: R(150) })],
    sortOrder: 2,
  },
  {
    id: "pj_chocolate_shake",
    categoryId: "cat_pj_shakes",
    name: "Chocolate Shake (चॉकलेट शेक)",
    description: "Rich dark chocolate shake blended thick and smooth.",
    isVeg: true,
    pricePaise: R(90),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(90), medium: R(125), large: R(160) })],
    sortOrder: 3,
  },
  {
    id: "pj_strawberry_shake",
    categoryId: "cat_pj_shakes",
    name: "Strawberry Shake (स्ट्रॉबेरी शेक)",
    description: "Luscious chilled strawberry shake with rich milk and cream.",
    isVeg: true,
    pricePaise: R(90),
    addOnGroups: [beverageSizeGroup({ small: R(90), medium: R(125), large: R(160) })],
    sortOrder: 4,
  },
  {
    id: "pj_butterscotch_shake",
    categoryId: "cat_pj_shakes",
    name: "Butter Scotch Shake (बटरस्कॉच शेक)",
    description: "Sweet creamy shake loaded with crunchy butterscotch praline.",
    isVeg: true,
    pricePaise: R(99),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(99), medium: R(139), large: R(169) })],
    sortOrder: 5,
  },
  {
    id: "pj_banana_shake",
    categoryId: "cat_pj_shakes",
    name: "Banana Shake (बनाना शेक)",
    description: "Fresh banana milkshake full of natural nutrition and energy.",
    isVeg: true,
    pricePaise: R(70),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(70), medium: R(100), large: R(130) })],
    sortOrder: 6,
  },
  {
    id: "pj_mango_shake",
    categoryId: "cat_pj_shakes",
    name: "Mango Shake (मैंगो शेक)",
    description: "Classic thick mango pulp shake made with rich milk.",
    isVeg: true,
    pricePaise: R(70),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(70), medium: R(100), large: R(130) })],
    sortOrder: 7,
  },
  {
    id: "pj_papaya_shake",
    categoryId: "cat_pj_shakes",
    name: "Papaya Shake (पपाया शेक)",
    description: "Healthy and refreshing sweet papaya shake.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [beverageSizeGroup({ small: R(60), medium: R(90), large: R(120) })],
    sortOrder: 8,
  },

  // ── 2. FRESH FRUIT & SUGARCANE JUICES ────────────────────────────────
  {
    id: "pj_pomegranate_juice",
    categoryId: "cat_pj_juices",
    name: "Pomegranate Juice (अनार का जूस)",
    description: "100% pure cold-pressed fresh pomegranate juice with rich antioxidants.",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(100), medium: R(150), large: R(200) })],
    sortOrder: 1,
  },
  {
    id: "pj_sweet_lime_juice",
    categoryId: "cat_pj_juices",
    name: "Sweet Lime Juice (मोसम्बी का जूस)",
    description: "Freshly squeezed vitamin-C rich sweet mosambi juice.",
    isVeg: true,
    pricePaise: R(50),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(50), medium: R(75), large: R(100) })],
    sortOrder: 2,
  },
  {
    id: "pj_mix_juice",
    categoryId: "cat_pj_juices",
    name: "Mix Fruit Juice (मिक्स जूस)",
    description: "Power-packed blend of seasonal fresh fruits with a dash of chaat masala.",
    isVeg: true,
    pricePaise: R(60),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(60), medium: R(90), large: R(120) })],
    sortOrder: 3,
  },
  {
    id: "pj_pineapple_juice",
    categoryId: "cat_pj_juices",
    name: "Pineapple Juice (अनानास का जूस)",
    description: "Tangy and sweet pure freshly extracted pineapple juice.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [beverageSizeGroup({ small: R(60), medium: R(90), large: R(120) })],
    sortOrder: 4,
  },
  {
    id: "pj_sugarcane_juice",
    categoryId: "cat_pj_juices",
    name: "Sugarcane Juice (गन्ने का जूस)",
    description: "Refreshing natural sugarcane juice with ginger, lemon and mint.",
    isVeg: true,
    pricePaise: R(30),
    isPopular: true,
    addOnGroups: [beverageSizeGroup({ small: R(30), medium: R(45), large: R(60) })],
    sortOrder: 5,
  },

  // ── 3. FRUIT CHAAT & FRESH COCONUT WATER ─────────────────────────────
  {
    id: "pj_mix_fruit_chaat",
    categoryId: "cat_pj_chaat_coconut",
    name: "Mix Fruit Chaat (मिक्स फ्रूट चाट)",
    description: "Assorted fresh cut seasonal fruits tossed with special tangy chaat spices and lemon juice.",
    isVeg: true,
    pricePaise: R(50),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "pj_pineapple_fruit_chaat",
    categoryId: "cat_pj_chaat_coconut",
    name: "Pineapple Fruit Chaat (केवल अनानास फ्रूट चाट)",
    description: "Freshly sliced juicy pineapple pieces seasoned with rock salt and roasted spices.",
    isVeg: true,
    pricePaise: R(50),
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "pj_dabh_coconut",
    categoryId: "cat_pj_chaat_coconut",
    name: "Fresh Coconut Water / Dabh (नारियल / डाब)",
    description: "100% natural, refreshing green tender coconut with sweet hydrating water and malai.",
    isVeg: true,
    pricePaise: R(70),
    isPopular: true,
    addOnGroups: [portionGroup(R(70), R(80), "Regular (₹70)", "Large Sweet Tender (₹80)")],
    sortOrder: 3,
  },

  // ── 4. FARM-FRESH FRUITS (BY KG / PACK) ──────────────────────────────
  {
    id: "pj_kiwi",
    categoryId: "cat_pj_fresh_fruits",
    name: "Kiwi (3 Pcs Pack)",
    description: "Farm-fresh ripe green kiwis packed with vitamin C (3 pcs pack).",
    isVeg: true,
    pricePaise: R(100),
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "pj_apple",
    categoryId: "cat_pj_fresh_fruits",
    name: "Fresh Apple",
    description: "Crisp and juicy sweet Kashmiri apples.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    addOnGroups: [weightGroup(R(80), R(160))],
    sortOrder: 2,
  },
  {
    id: "pj_pomegranate",
    categoryId: "cat_pj_fresh_fruits",
    name: "Pomegranate (Anar)",
    description: "Fresh premium ruby red pomegranate pearls.",
    isVeg: true,
    pricePaise: R(80),
    isPopular: true,
    addOnGroups: [weightGroup(R(80), R(160))],
    sortOrder: 3,
  },
  {
    id: "pj_banana",
    categoryId: "cat_pj_fresh_fruits",
    name: "Banana (Kela)",
    description: "Fresh naturally ripened sweet bananas.",
    isVeg: true,
    pricePaise: R(35),
    isPopular: true,
    addOnGroups: [portionGroup(R(35), R(70), "6 Pcs (Half Dozen)", "12 Pcs (1 Dozen)")],
    sortOrder: 4,
  },
  {
    id: "pj_papaya",
    categoryId: "cat_pj_fresh_fruits",
    name: "Papaya (Papita)",
    description: "Sweet and nutritious ripe golden papaya (approx 1 kg).",
    isVeg: true,
    pricePaise: R(70),
    sortOrder: 5,
  },
  {
    id: "pj_green_grapes",
    categoryId: "cat_pj_fresh_fruits",
    name: "Green Grapes",
    description: "Sweet seedless fresh green grapes.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [weightGroup(R(60), R(120))],
    sortOrder: 6,
  },
  {
    id: "pj_black_grapes",
    categoryId: "cat_pj_fresh_fruits",
    name: "Black Grapes",
    description: "Rich sweet fresh black grapes.",
    isVeg: true,
    pricePaise: R(80),
    addOnGroups: [weightGroup(R(80), R(160))],
    sortOrder: 7,
  },
  {
    id: "pj_watermelon",
    categoryId: "cat_pj_fresh_fruits",
    name: "Watermelon (Tarbooz)",
    description: "Refreshing sweet red watermelon (per kg / half fruit).",
    isVeg: true,
    pricePaise: R(30),
    sortOrder: 8,
  },
  {
    id: "pj_pear",
    categoryId: "cat_pj_fresh_fruits",
    name: "Pear (Nashpati)",
    description: "Crisp and juicy seasonal pears.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [weightGroup(R(60), R(120))],
    sortOrder: 9,
  },
  {
    id: "pj_mango",
    categoryId: "cat_pj_fresh_fruits",
    name: "Mango (Aam)",
    description: "Delicious sweet ripe seasonal mangoes.",
    isVeg: true,
    pricePaise: R(40),
    isPopular: true,
    addOnGroups: [weightGroup(R(40), R(80))],
    sortOrder: 10,
  },
  {
    id: "pj_orange",
    categoryId: "cat_pj_fresh_fruits",
    name: "Orange (Santra)",
    description: "Juicy sweet Nagpur oranges.",
    isVeg: true,
    pricePaise: R(40),
    addOnGroups: [weightGroup(R(40), R(80))],
    sortOrder: 11,
  },
  {
    id: "pj_kinnow",
    categoryId: "cat_pj_fresh_fruits",
    name: "Kinnow (Kino)",
    description: "Fresh high-juice citrus kinnow.",
    isVeg: true,
    pricePaise: R(40),
    addOnGroups: [weightGroup(R(40), R(80))],
    sortOrder: 12,
  },
  {
    id: "pj_strawberry",
    categoryId: "cat_pj_fresh_fruits",
    name: "Strawberry (10 Pcs Packet)",
    description: "Fresh sweet red garden strawberries packet.",
    isVeg: true,
    pricePaise: R(120),
    isPopular: true,
    sortOrder: 13,
  },
  {
    id: "pj_litchi",
    categoryId: "cat_pj_fresh_fruits",
    name: "Shahi Litchi",
    description: "Famous sweet and aromatic Muzaffarpur Shahi Litchis.",
    isVeg: true,
    pricePaise: R(60),
    isPopular: true,
    addOnGroups: [weightGroup(R(60), R(120))],
    sortOrder: 14,
  },
  {
    id: "pj_guava",
    categoryId: "cat_pj_fresh_fruits",
    name: "Guava (Amrood)",
    description: "Sweet fresh green Allahabad guavas.",
    isVeg: true,
    pricePaise: R(60),
    addOnGroups: [weightGroup(R(60), R(120))],
    sortOrder: 15,
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Main Seed Runner
   ══════════════════════════════════════════════════════════════════════ */

export async function seedPrinceJuice(): Promise<void> {
  console.log("=== Onboarding Prince Juice & Shakes Corner ===");

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
    slug: "prince-juice-and-shakes-corner",
    name: "Prince Juice & Shakes Corner",
    cuisines: [
      "Fresh Juices",
      "Shakes",
      "Fresh Fruits",
      "Fruit Chaat",
      "Beverages",
      "Healthy Food",
    ],
    phone: "9113723907",
    description:
      "Prince Juice & Shakes Corner - Special Thick Shakes, Cold-Pressed Fresh Juices, Sugarcane Juice, Fruit Chaat & Farm-Fresh Fruits by KG delivered to your hostel.",
    imageUrl: null,
    bannerUrl: null,
    packagingFeePaise: R(10),
    minOrderPaise: R(40),
    prepMinutes: 10,
    foodGstBps: 0,
    commissionBpsOverride: null,
    servedZoneIds,
    opensMinutes: 0, // 24x7 service
    closesMinutes: 1439,
    isOpen: true,
    isApproved: true,
    rating: 4.8,
    ratingCount: 46,
    kyc: {
      status: "APPROVED",
      ownerName: "Kumar Bablu",
      ownerPhone: "9113723907",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Prince Juice & Shakes Corner",
      accountNumber: "911372390700",
      ifsc: "SBIN0001234",
      upiId: "9113723907@upi",
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
    name: "Kumar Bablu",
    email: VENDOR_EMAIL,
    phone: "9113723907",
    passwordHash: hashPassword("PrinceJuice@2026"),
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
  console.log(`[x] ${itemDocs.length} menu items seeded with size & weight options.`);

  console.log("\n=== Prince Juice & Shakes Corner Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Admin Menu URL: /admin/vendors/${RESTAURANT_ID}/menu`);
  console.log(`  - Vendor Login: ${VENDOR_EMAIL} / PrinceJuice@2026`);
}

async function main() {
  try {
    await seedPrinceJuice();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-prince-juice")) {
  main().catch((err) => {
    console.error("Failed to seed Prince Juice & Shakes Corner:", err);
    process.exit(1);
  });
}
