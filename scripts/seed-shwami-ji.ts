/**
 * Shwami Ji Restaurant Onboarding & Seeding Script.
 *
 * Menu:
 *   No menu right now, vendor will add later via /vendor/menu.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-shwami-ji.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

export const SHWAMI_JI_RESTAURANT_ID = "rest_shwami_ji_nitp";
export const SHWAMI_JI_VENDOR_USER_ID = "usr_shwami_ji_vendor";
export const SHWAMI_JI_VENDOR_EMAIL = "swamjimalai26@gmail.com";

const getInitialSecret = (): string =>
  process.env.SHWAMI_JI_VENDOR_INIT_SECRET ||
  Buffer.from("U3dhbWppdHJlZm9vZEAyMDI2MjAyNw==", "base64").toString("utf-8");

const R = rupeesToPaise;

export async function seedShwamiJi(): Promise<void> {
  console.log("=== Onboarding Shwami Ji ===");

  const campusesCollection = await db.campuses();
  const campus = await campusesCollection.findOne({ _id: CAMPUS_ID });
  if (!campus) {
    throw new Error(`Campus "${CAMPUS_ID}" not found. Run "npm run seed" first.`);
  }

  const now = new Date();
  const servedZoneIds = campus.zones.map((z) => z.id);

  // 1. Upsert Restaurant
  const restaurant: Restaurant = {
    _id: SHWAMI_JI_RESTAURANT_ID,
    campusId: CAMPUS_ID,
    slug: "shwami-ji",
    name: "Shwami Ji",
    cuisines: ["North Indian", "Sweets", "Snacks", "Fast Food"],
    phone: "9876543221",
    phones: ["9876543221"],
    description:
      "Shwami Ji - Authentic sweets, snacks, North Indian meals and delicacies on campus.",
    imageUrl: null,
    bannerUrl: null,
    packagingFeePaise: R(10),
    minOrderPaise: R(40),
    prepMinutes: 15,
    foodGstBps: 0,
    commissionBpsOverride: null,
    platformFeePaise: 0,
    servedZoneIds,
    opensMinutes: 0, // 24x7 service initially
    closesMinutes: 1439,
    isOpen: true,
    adminClosed: false,
    isDineInAvailable: false,
    isApproved: true,
    rating: 4.8,
    ratingCount: 16,
    kyc: {
      status: "APPROVED",
      ownerName: "Shwami Ji Manager",
      ownerPhone: "9876543221",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Shwami Ji",
      accountNumber: "987654322100",
      ifsc: "SBIN0001234",
      upiId: "swamjimalai26@upi",
    },
    expiryCountToday: 0,
    autoClosedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const restaurantsCollection = await db.restaurants();
  await restaurantsCollection.replaceOne({ _id: SHWAMI_JI_RESTAURANT_ID }, restaurant, { upsert: true });
  console.log(`[x] Restaurant "${restaurant.name}" created/updated with slug "${restaurant.slug}".`);

  // 2. Upsert Vendor Account
  const usersCollection = await db.users();
  const rawSecret = getInitialSecret();
  const vendorUser: User = {
    _id: SHWAMI_JI_VENDOR_USER_ID,
    authId: null,
    role: ROLE.VENDOR_OWNER,
    name: "Shwami Ji",
    email: SHWAMI_JI_VENDOR_EMAIL,
    emailVerified: true,
    phone: "9876543221",
    passwordHash: hashPassword(rawSecret),
    campusId: CAMPUS_ID,
    restaurantId: SHWAMI_JI_RESTAURANT_ID,
    strikes: 0,
    ordersBlocked: false,
    ordersBlockedReason: null,
    createdAt: now,
    updatedAt: now,
  };

  // If a user with this email exists, update them to be VENDOR_OWNER with Shwami Ji
  const existingUser = await usersCollection.findOne({ email: SHWAMI_JI_VENDOR_EMAIL });
  if (existingUser) {
    await usersCollection.updateOne(
      { _id: existingUser._id },
      {
        $set: {
          role: vendorUser.role,
          name: vendorUser.name,
          emailVerified: true,
          passwordHash: vendorUser.passwordHash ?? null,
          campusId: vendorUser.campusId,
          restaurantId: vendorUser.restaurantId,
          updatedAt: now,
        },
      },
    );
    console.log(`[x] Existing user "${SHWAMI_JI_VENDOR_EMAIL}" updated to Vendor Owner for Shwami Ji.`);
  } else {
    await usersCollection.replaceOne({ _id: SHWAMI_JI_VENDOR_USER_ID }, vendorUser, { upsert: true });
    console.log(`[x] Vendor User "${SHWAMI_JI_VENDOR_EMAIL}" created.`);
  }

  // 3. Clear/ensure categories and items (no menu right now, vendor will add later)
  const categoriesCollection = await db.menuCategories();
  const existingCategoriesCount = await categoriesCollection.countDocuments({
    restaurantId: SHWAMI_JI_RESTAURANT_ID,
  });

  const itemsCollection = await db.menuItems();
  const existingItemsCount = await itemsCollection.countDocuments({
    restaurantId: SHWAMI_JI_RESTAURANT_ID,
  });

  console.log(
    `[x] Menu status: ${existingCategoriesCount} category(ies), ${existingItemsCount} item(s). (No initial menu seeded; vendor can add items from /vendor/menu).`,
  );

  console.log("\n=== Shwami Ji Restaurant Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Vendor Menu Management: /vendor/menu`);
  console.log(`  - Vendor Login: ${SHWAMI_JI_VENDOR_EMAIL}`);
}

async function main() {
  try {
    await seedShwamiJi();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-shwami-ji")) {
  main().catch((err) => {
    console.error("Failed to seed Shwami Ji:", err);
    process.exit(1);
  });
}
