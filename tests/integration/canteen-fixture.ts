import * as db from "@/server/db/collections";
import { isRestaurantServing } from "@/server/services/catalog";
import { formatMinutes } from "@/server/services/curfew";
import { rupeesToPaise } from "@/lib/money";
import type { MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";

/**
 * The canteen the integration tests order from.
 *
 * These tests used to lean on the demo seed for `rest_nit_canteen` and its
 * menu. Vendors are REAL data now — created from the admin console, never
 * scripted — so the suite brings its own restaurant and takes it away
 * afterwards. Nothing here touches production data: the ids are the same
 * deterministic ones the assertions were written against, and every document
 * is deleted in `tearDownCanteenFixture`.
 *
 * `vitest.config.mts` sets `fileParallelism: false`, so the two integration
 * files run one after the other against the same database and can safely share
 * this fixture without racing each other's setup/teardown.
 *
 * The prices below are load-bearing: order-lifecycle.test.ts asserts
 *   Veg Thali (90) + Full (30) x2 = 240, Masala Maggi (45)  -> 285 subtotal
 * and settlement.test.ts settles the same cart. Change a number here and those
 * assertions move with it.
 */

const R = rupeesToPaise;

export const CANTEEN_ID = "rest_nit_canteen";
const CAMPUS_ID = "campus_nitp";

/* --- Add-on groups ---------------------------------------------------- */

const THALI_SIZE = {
  id: "grp_thali_size",
  name: "Portion",
  minSelect: 1, // required choice
  maxSelect: 1,
  options: [
    { id: "opt_half", name: "Half", pricePaise: 0, isAvailable: true },
    { id: "opt_full", name: "Full", pricePaise: R(30), isAvailable: true },
  ],
};

const SPICE_LEVEL = {
  id: "grp_spice",
  name: "Spice level",
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: "opt_mild", name: "Mild", pricePaise: 0, isAvailable: true },
    { id: "opt_medium", name: "Medium", pricePaise: 0, isAvailable: true },
    { id: "opt_hot", name: "Extra hot", pricePaise: 0, isAvailable: true },
  ],
};

const MAGGI_EXTRAS = {
  id: "grp_maggi_extras",
  name: "Add extras",
  minSelect: 0, // optional
  maxSelect: 2,
  options: [
    { id: "opt_maggi_cheese", name: "Cheese", pricePaise: R(20), isAvailable: true },
    { id: "opt_maggi_egg", name: "Egg", pricePaise: R(15), isAvailable: true },
  ],
};

/* --- Documents -------------------------------------------------------- */

function canteen(servedZoneIds: string[]): Restaurant {
  return {
    _id: CANTEEN_ID,
    campusId: CAMPUS_ID,
    slug: "nit-canteen",
    name: "NIT Canteen",
    cuisines: ["North Indian", "Chinese"],
    phone: "+919430000001",
    description: "Test fixture canteen — created and removed by the integration suite.",
    imageUrl: null,
    bannerUrl: null,
    packagingFeePaise: R(10),
    minOrderPaise: R(50), // a single 45-rupee Maggi is below this, on purpose (F12)
    prepMinutes: 15,
    foodGstBps: 0,
    commissionBpsOverride: null, // use the campus rate, so 10% is exact
    servedZoneIds,
    // Open around the clock. `isGateOpenAt` treats opens === closes as a full
    // 24-hour window, and that is deliberate here: these hours used to be
    // 07:00–23:30, which meant the whole integration suite failed with
    // "NIT Canteen is currently closed" for seven and a half hours out of
    // every twenty-four. A settlement test that only passes before bedtime is
    // a settlement test nobody can trust at 2 AM, which is exactly when the
    // nightly run fires. No test asserts these hours; the lockout suite closes
    // the restaurant through `isOpen`, which still works.
    opensMinutes: 0,
    closesMinutes: 0,
    isOpen: true,
    isApproved: true,
    rating: 4.4,
    ratingCount: 312,
    kyc: {
      status: "APPROVED",
      ownerName: "Owner",
      ownerPhone: "+919430000001",
      gstin: null,
      fssai: null,
      reviewedAt: new Date("2026-08-05T00:00:00Z"),
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "NIT Canteen",
      accountNumber: "000000000000",
      ifsc: "SBIN0000000",
      upiId: null,
    },
    expiryCountToday: 0,
    autoClosedAt: null,
    createdAt: new Date("2026-08-05T00:00:00Z"),
    updatedAt: new Date("2026-08-05T00:00:00Z"),
  };
}

const CATEGORIES: MenuCategory[] = [
  { _id: "cat_nc_thali", restaurantId: CANTEEN_ID, name: "Thalis & Rice", sortOrder: 1 },
  { _id: "cat_nc_chinese", restaurantId: CANTEEN_ID, name: "Chinese", sortOrder: 2 },
  { _id: "cat_nc_snacks", restaurantId: CANTEEN_ID, name: "Snacks", sortOrder: 3 },
];

const ITEMS: MenuItem[] = [
  {
    _id: "item_nc_veg_thali",
    restaurantId: CANTEEN_ID,
    categoryId: "cat_nc_thali",
    name: "Veg Thali",
    description: "Dal, seasonal sabzi, rice, four rotis, salad and papad.",
    isVeg: true,
    pricePaise: R(90),
    imageUrl: null,
    isAvailable: true,
    addOnGroups: [THALI_SIZE],
    sortOrder: 1,
    isPopular: true,
  },
  {
    _id: "item_nc_maggi",
    restaurantId: CANTEEN_ID,
    categoryId: "cat_nc_snacks",
    name: "Masala Maggi",
    description: "The 1 AM staple.",
    isVeg: true,
    pricePaise: R(45),
    imageUrl: null,
    isAvailable: true,
    addOnGroups: [MAGGI_EXTRAS],
    sortOrder: 2,
    isPopular: true,
  },
  {
    _id: "item_nc_chilli_paneer",
    restaurantId: CANTEEN_ID,
    categoryId: "cat_nc_chinese",
    name: "Chilli Paneer",
    description: "Dry, with capsicum and onion.",
    isVeg: true,
    pricePaise: R(110),
    imageUrl: null,
    // Seeded 86-ed, so F14 has an unavailable item to refuse.
    isAvailable: false,
    addOnGroups: [SPICE_LEVEL],
    sortOrder: 2,
    isPopular: false,
  },
];

/**
 * The canteen must be serving at every minute of the day, and this asserts it
 * rather than trusting the two numbers above.
 *
 * `createOrder` refuses a restaurant that is not serving, so hours that close
 * at 23:30 turn the whole integration suite red between 23:30 and 07:00 IST —
 * and green again by morning, which is how it survived review the first time.
 * A CI run at 01:54 IST failed nine tests with `false !== true` and
 * "NIT Canteen is currently closed", none of which name the clock.
 *
 * Checking the real predicate (not just `opensMinutes === closesMinutes`) also
 * catches the other way back into that hole: a change to how `isGateOpenAt`
 * reads an equal open/close pair, or to `isApproved`. Failing here says which
 * minute broke, once, instead of nine assertions in three files.
 */
function assertServesAllDay(restaurant: Restaurant): void {
  for (let minute = 0; minute < 24 * 60; minute += 1) {
    if (isRestaurantServing(restaurant, minute)) continue;
    throw new Error(
      `canteen-fixture: the test canteen is closed at ${formatMinutes(minute)}. ` +
        "The integration suite must not depend on the hour it runs at: keep " +
        "opensMinutes === closesMinutes (a full 24-hour window), isOpen and isApproved.",
    );
  }
}

/**
 * Creates the canteen, its categories and its menu. Idempotent: safe to call
 * from every file's `beforeAll`, and safe to re-run if a previous suite crashed
 * before its teardown. Serves every gate on the campus so any zone the tests
 * pick is reachable.
 */
export async function setUpCanteenFixture(): Promise<void> {
  const campus = await (await db.campuses()).findOne({ _id: CAMPUS_ID });
  const servedZoneIds = campus
    ? campus.zones.map((zone) => zone.id)
    : ["zone_main_gate", "zone_boys_hostel"];

  const doc = canteen(servedZoneIds);
  assertServesAllDay(doc);

  await (await db.restaurants()).replaceOne({ _id: CANTEEN_ID }, doc, {
    upsert: true,
  });

  const categories = await db.menuCategories();
  for (const category of CATEGORIES) {
    await categories.replaceOne({ _id: category._id }, category, { upsert: true });
  }

  const items = await db.menuItems();
  for (const item of ITEMS) {
    await items.replaceOne({ _id: item._id }, item, { upsert: true });
  }
}

/** Removes exactly what `setUpCanteenFixture` created, and nothing else. */
export async function tearDownCanteenFixture(): Promise<void> {
  await (await db.menuItems()).deleteMany({ restaurantId: CANTEEN_ID });
  await (await db.menuCategories()).deleteMany({ restaurantId: CANTEEN_ID });
  await (await db.restaurants()).deleteOne({ _id: CANTEEN_ID });
}
