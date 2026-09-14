/**
 * Sync the real contact numbers of onboarded vendors into the database.
 *
 * Only phone fields are touched — unlike the per-vendor seed scripts, this does
 * NOT replace the restaurant document or wipe and re-insert the menu, so it is
 * safe to run against a live database.
 *
 * Updates, per vendor:
 *   - restaurants.phone and restaurants.kyc.ownerPhone
 *   - users.phone for the vendor owner account(s) of that restaurant
 *   - orders.restaurantSnapshot.phone on orders that are still in progress, so
 *     a student with an active order is shown the number that actually rings.
 *     Finished orders keep their snapshot untouched.
 *
 * Usage:
 *   npm run db:update-vendor-phones            # apply
 *   npm run db:update-vendor-phones -- --dry   # report only, write nothing
 */

import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import { ROLE, TERMINAL_STATUSES } from "@/lib/constants";

interface VendorPhone {
  label: string;
  restaurantId: string;
  /** Fallback when the restaurant was created with a different id. */
  nameMatch: RegExp;
  phone: string;
}

const VENDOR_PHONES: VendorPhone[] = [
  { label: "Raj Darbar", restaurantId: "rest_raj_darbar_nitp", nameMatch: /raj\s*darbar/i, phone: "7209046762" },
  { label: "Vrindavan Bhog", restaurantId: "rest_vrindavan_bhog_nitp", nameMatch: /vrindavan/i, phone: "7482066766" },
  { label: "Chai Sutta Bar (CSB)", restaurantId: "rest_csb_nitp", nameMatch: /chai\s*sutta/i, phone: "9905773851" },
  { label: "Wrapchik", restaurantId: "rest_wrapchik_nitp", nameMatch: /wrapchi/i, phone: "8928727495" },
  { label: "The Royal Bihar", restaurantId: "rest_royal_bihar_nitp", nameMatch: /royal\s*bihar/i, phone: "9031726976" },
  { label: "Kolkata Biryani", restaurantId: "rest_kolkata_biryani_nitp", nameMatch: /kolkata/i, phone: "6203875025" },
  { label: "Sone Zone", restaurantId: "rest_sone_zone_nitp", nameMatch: /sone\s*zone/i, phone: "9821136151" },
  { label: "Mokila", restaurantId: "rest_mokila_nitp", nameMatch: /mokila/i, phone: "7479892202" },
];

async function updateVendorPhones(dryRun: boolean): Promise<void> {
  console.log(`=== Syncing vendor phone numbers${dryRun ? " (dry run)" : ""} ===\n`);

  const restaurants = await db.restaurants();
  const users = await db.users();
  const orders = await db.orders();
  const now = new Date();

  for (const vendor of VENDOR_PHONES) {
    const matches = await restaurants
      .find({ $or: [{ _id: vendor.restaurantId }, { name: { $regex: vendor.nameMatch } }] })
      .toArray();

    if (matches.length === 0) {
      console.log(`  [!] ${vendor.label}: no restaurant found — run its seed script first.`);
      continue;
    }
    const [restaurant, ...extra] = matches;
    if (!restaurant || extra.length > 0) {
      console.log(
        `  [!] ${vendor.label}: ${matches.length} restaurants matched (${matches
          .map((r) => r.name)
          .join(", ")}) — skipped, fix the match rule.`,
      );
      continue;
    }
    const activeOrderFilter = {
      restaurantId: restaurant._id,
      status: { $nin: [...TERMINAL_STATUSES] },
      "restaurantSnapshot.phone": { $ne: vendor.phone },
    };

    if (dryRun) {
      const [vendorUsers, staleOrders] = await Promise.all([
        users.countDocuments({ restaurantId: restaurant._id, role: ROLE.VENDOR_OWNER, phone: { $ne: vendor.phone } }),
        orders.countDocuments(activeOrderFilter),
      ]);
      console.log(
        `  [ ] ${restaurant.name}: ${restaurant.phone} -> ${vendor.phone} ` +
          `(vendor users to update: ${vendorUsers}, active orders to update: ${staleOrders})`,
      );
      continue;
    }

    const [restaurantResult, userResult, orderResult] = await Promise.all([
      restaurants.updateOne(
        { _id: restaurant._id },
        { $set: { phone: vendor.phone, "kyc.ownerPhone": vendor.phone, updatedAt: now } },
      ),
      users.updateMany(
        { restaurantId: restaurant._id, role: ROLE.VENDOR_OWNER },
        { $set: { phone: vendor.phone, updatedAt: now } },
      ),
      orders.updateMany(activeOrderFilter, { $set: { "restaurantSnapshot.phone": vendor.phone } }),
    ]);

    console.log(
      `  [x] ${restaurant.name}: ${restaurant.phone} -> ${vendor.phone} ` +
        `(restaurant ${restaurantResult.modifiedCount}, vendor users ${userResult.modifiedCount}, ` +
        `active orders ${orderResult.modifiedCount})`,
    );
  }

  console.log(`\n=== Vendor phones ${dryRun ? "checked" : "synced"} ===`);
}

async function main() {
  try {
    await updateVendorPhones(process.argv.includes("--dry"));
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

main().catch((err) => {
  console.error("Failed to update vendor phones:", err);
  process.exit(1);
});
