/**
 * Crave Restaurant Onboarding & Seeding Script.
 *
 * Menu:
 *   No menu right now, vendor will add later via /vendor/menu.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-crave.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

export const CRAVE_RESTAURANT_ID = "rest_crave_nitp";
export const CRAVE_VENDOR_USER_ID = "usr_crave_vendor";
export const CRAVE_VENDOR_EMAIL = "adityanitp26@gmail.com";

const getInitialSecret = (): string =>
  process.env.CRAVE_VENDOR_INIT_SECRET ||
  Buffer.from("QURJVFlBQDIwMjYyMDI3", "base64").toString("utf-8");

const R = rupeesToPaise;

export async function seedCrave(): Promise<void> {
  console.log("=== Onboarding Crave ===");

  const campusesCollection = await db.campuses();
  const campus = await campusesCollection.findOne({ _id: CAMPUS_ID });
  if (!campus) {
    throw new Error(`Campus "${CAMPUS_ID}" not found. Run "npm run seed" first.`);
  }

  const now = new Date();
  const servedZoneIds = campus.zones.map((z) => z.id);

  // 1. Upsert Restaurant
  const restaurant: Restaurant = {
    _id: CRAVE_RESTAURANT_ID,
    campusId: CAMPUS_ID,
    slug: "crave",
    name: "Crave",
    cuisines: ["Biryani", "North Indian", "Mughlai", "Fast Food"],
    phone: "9876543220",
    phones: ["9876543220"],
    description:
      "Crave - Authentic, flavorful Dum Biryani, North Indian specialties and late-night cravings on campus.",
    imageUrl: "/crave/crave1.png",
    bannerUrl: "/crave/crave3.png",
    packagingFeePaise: R(10),
    minOrderPaise: R(50),
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
    ratingCount: 18,
    kyc: {
      status: "APPROVED",
      ownerName: "Aditya",
      ownerPhone: "9876543220",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Crave",
      accountNumber: "987654322000",
      ifsc: "SBIN0001234",
      upiId: "adityanitp26@okaxis",
    },
    expiryCountToday: 0,
    autoClosedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const restaurantsCollection = await db.restaurants();
  await restaurantsCollection.replaceOne({ _id: CRAVE_RESTAURANT_ID }, restaurant, { upsert: true });
  console.log(`[x] Restaurant "${restaurant.name}" created/updated with slug "${restaurant.slug}".`);

  // 2. Upsert Vendor Account
  const usersCollection = await db.users();
  const rawSecret = getInitialSecret();
  const vendorUser: User = {
    _id: CRAVE_VENDOR_USER_ID,
    authId: null,
    role: ROLE.VENDOR_OWNER,
    name: "Aditya",
    email: CRAVE_VENDOR_EMAIL,
    emailVerified: true,
    phone: "9876543220",
    passwordHash: hashPassword(rawSecret),
    campusId: CAMPUS_ID,
    restaurantId: CRAVE_RESTAURANT_ID,
    strikes: 0,
    ordersBlocked: false,
    ordersBlockedReason: null,
    createdAt: now,
    updatedAt: now,
  };

  // If a user with this email exists, update them to be VENDOR_OWNER with Crave
  const existingUser = await usersCollection.findOne({ email: CRAVE_VENDOR_EMAIL });
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
    console.log(`[x] Existing user "${CRAVE_VENDOR_EMAIL}" updated to Vendor Owner for Crave.`);
  } else {
    await usersCollection.replaceOne({ _id: CRAVE_VENDOR_USER_ID }, vendorUser, { upsert: true });
    console.log(`[x] Vendor User "${CRAVE_VENDOR_EMAIL}" created.`);
  }

  // 3. Clear/ensure categories and items (no menu right now, vendor will add later)
  const categoriesCollection = await db.menuCategories();
  const existingCategoriesCount = await categoriesCollection.countDocuments({
    restaurantId: CRAVE_RESTAURANT_ID,
  });

  const itemsCollection = await db.menuItems();
  const existingItemsCount = await itemsCollection.countDocuments({
    restaurantId: CRAVE_RESTAURANT_ID,
  });

  console.log(
    `[x] Menu status: ${existingCategoriesCount} category(ies), ${existingItemsCount} item(s). (No initial menu seeded; vendor can add items from /vendor/menu).`,
  );

  console.log("\n=== Crave Restaurant Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Vendor Menu Management: /vendor/menu`);
  console.log(`  - Vendor Login: ${CRAVE_VENDOR_EMAIL}`);
}

async function main() {
  try {
    await seedCrave();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-crave")) {
  main().catch((err) => {
    console.error("Failed to seed Crave:", err);
    process.exit(1);
  });
}
