/**
 * Zaika Biryani Onboarding & Menu Seeding Script.
 *
 * Menu:
 * - Chicken Biryani (Half ₹140 / Full 210)
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-zaika-biryani.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise, type Paise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { AddOnGroup, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

const RESTAURANT_ID = "rest_zaika_biryani_nitp";
const VENDOR_USER_ID = "usr_zaika_biryani_vendor";
const VENDOR_EMAIL = "zaikabiryani.nitp@trefood.in";

const R = rupeesToPaise;

function portionGroup(halfPaise: Paise, fullPaise: Paise): AddOnGroup {
  return {
    id: "grp_portion",
    name: "Portion Size",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_portion_half", name: "Half", pricePaise: 0, isAvailable: true },
      { id: "opt_portion_full", name: "Full", pricePaise: fullPaise - halfPaise, isAvailable: true },
    ],
  };
}

const CATEGORIES: { id: string; name: string; sortOrder: number }[] = [
  { id: "cat_zb_biryani", name: "Biryani Specials", sortOrder: 1 },
];

const ITEMS: MenuItem[] = [
  {
    _id: "zb_chicken_biryani",
    restaurantId: RESTAURANT_ID,
    categoryId: "cat_zb_biryani",
    name: "Chicken Biryani",
    description: "Signature fragrant dum chicken biryani prepared with aromatic basmati rice, tender chicken and special Zaika spices.",
    isVeg: false,
    pricePaise: R(140),
    imageUrl: null,
    isAvailable: true,
    isPopular: true,
    addOnGroups: [portionGroup(R(140), R(210))],
    sortOrder: 1,
  },
];

export async function seedZaikaBiryani(): Promise<void> {
  console.log("=== Onboarding Zaika Biryani ===");

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
    slug: "zaika-biryani",
    name: "Zaika Biryani",
    cuisines: ["Biryani", "Mughlai"],
    phone: "9876543213",
    description:
      "Zaika Biryani - Authentic, flavorful, slow-cooked Dum Chicken Biryani served hot with raita and gravy.",
    imageUrl: null,
    bannerUrl: null,
    packagingFeePaise: R(10),
    minOrderPaise: R(50),
    prepMinutes: 15,
    foodGstBps: 0,
    commissionBpsOverride: null,
    servedZoneIds,
    opensMinutes: 0, // 24x7 service
    closesMinutes: 1439,
    isOpen: true,
    isApproved: true,
    rating: 4.7,
    ratingCount: 29,
    kyc: {
      status: "APPROVED",
      ownerName: "Zaika Biryani Manager",
      ownerPhone: "9876543213",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Zaika Biryani",
      accountNumber: "987654321300",
      ifsc: "SBIN0001234",
      upiId: "zaikabiryani@upi",
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
    name: "Zaika Biryani Manager",
    email: VENDOR_EMAIL,
    phone: "9876543213",
    passwordHash: hashPassword("ZaikaBiryani@2026"),
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

  await itemsCollection.insertMany(ITEMS);
  console.log(`[x] ${ITEMS.length} menu item(s) seeded with portion options.`);

  console.log("\n=== Zaika Biryani Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Admin Menu URL: /admin/vendors/${RESTAURANT_ID}/menu`);
  console.log(`  - Vendor Login: ${VENDOR_EMAIL} / ZaikaBiryani@2026`);
}

async function main() {
  try {
    await seedZaikaBiryani();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-zaika-biryani")) {
  main().catch((err) => {
    console.error("Failed to seed Zaika Biryani:", err);
    process.exit(1);
  });
}
