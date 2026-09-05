/**
 * Migration / Sync script to apply updated restaurant timings,
 * minimum order rules (including late-night rules), and campus gate curfews
 * directly to the MongoDB database.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/update-restaurant-timings.ts
 */

import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import { rupeesToPaise } from "@/lib/money";
import { CAMPUS_ID, ZONES } from "./seed-data";

const R = rupeesToPaise;

async function updateTimingsAndCurfews(): Promise<void> {
  console.log("=== Updating Restaurant Timings, Min Orders & Delivery Gate Curfews ===\n");

  // 1. Update Campus Delivery Gate Curfews
  const campusesCollection = await db.campuses();
  const campus = await campusesCollection.findOne({ _id: CAMPUS_ID });

  if (campus) {
    // Map current zones with updated curfewMinutes from ZONES definition
    const updatedZones = campus.zones.map((zone) => {
      const match = ZONES.find((z) => z.id === zone.id);
      if (match) {
        return {
          ...zone,
          curfewMinutes: match.curfewMinutes,
          opensMinutes: match.opensMinutes,
        };
      }
      return zone;
    });

    await campusesCollection.updateOne(
      { _id: CAMPUS_ID },
      {
        $set: {
          zones: updatedZones,
          updatedAt: new Date(),
        },
      },
    );
    console.log("  [x] Updated campus delivery gate curfews:");
    for (const z of updatedZones) {
      const curfewStr =
        z.curfewMinutes === null
          ? "24x7"
          : `${String(Math.trunc(z.curfewMinutes / 60)).padStart(2, "0")}:${String(
              z.curfewMinutes % 60,
            ).padStart(2, "0")}`;
      console.log(`      - ${z.name}: ${curfewStr}`);
    }
  } else {
    console.log(`  [!] Campus ${CAMPUS_ID} not found in database.`);
  }

  // 2. Update Restaurants
  const restaurantsCollection = await db.restaurants();

  // (a) Chai Sutta Bar (CSB)
  // 10:30 am to 1:00 am. After 12:00 am min order = 300 rs. Regular min order = 40 rs.
  const csbResult = await restaurantsCollection.updateOne(
    { $or: [{ _id: "rest_csb_nitp" }, { slug: "chai-sutta-bar-csb" }] },
    {
      $set: {
        opensMinutes: 10 * 60 + 30, // 10:30 AM
        closesMinutes: 1 * 60, // 01:00 AM (past midnight)
        minOrderPaise: R(40),
        lateNightMinOrderPaise: R(300),
        lateNightStartMinutes: 0, // 12:00 AM (midnight)
        lateNightEndMinutes: 60, // 01:00 AM
        updatedAt: new Date(),
      },
    },
  );
  console.log(`  [x] Chai Sutta Bar (CSB): matched ${csbResult.matchedCount}, modified ${csbResult.modifiedCount}`);

  // (b) Kolkata Biryani
  // 10:00 am to 10:00 pm, min order 50 rs.
  const kolkataResult = await restaurantsCollection.updateOne(
    {
      $or: [
        { _id: "rest_kolkata_nitp" },
        { slug: "kolkata-biryani-fast-food-pizza-house" },
        { name: { $regex: /kolkata/i } },
      ],
    },
    {
      $set: {
        opensMinutes: 10 * 60, // 10:00 AM
        closesMinutes: 22 * 60, // 10:00 PM
        minOrderPaise: R(50),
        updatedAt: new Date(),
      },
    },
  );
  console.log(`  [x] Kolkata Biryani: matched ${kolkataResult.matchedCount}, modified ${kolkataResult.modifiedCount}`);

  // (c) Raj Darbar
  // 7:00 am to 10:00 pm, min order 50 rs.
  const rajDarbarResult = await restaurantsCollection.updateOne(
    { $or: [{ _id: "rest_rajdarbar_nitp" }, { slug: "raj-darbar" }, { name: { $regex: /raj darbar/i } }] },
    {
      $set: {
        opensMinutes: 7 * 60, // 07:00 AM
        closesMinutes: 22 * 60, // 10:00 PM
        minOrderPaise: R(50),
        updatedAt: new Date(),
      },
    },
  );
  console.log(`  [x] Raj Darbar: matched ${rajDarbarResult.matchedCount}, modified ${rajDarbarResult.modifiedCount}`);

  // (d) Sone Zone Cafe
  // 10:00 am to 11:00 pm, min order 50 rs.
  const soneZoneResult = await restaurantsCollection.updateOne(
    { $or: [{ _id: "rest_sonezone_nitp" }, { slug: "sone-zone-cafe" }, { name: { $regex: /sone zone/i } }] },
    {
      $set: {
        opensMinutes: 10 * 60, // 10:00 AM
        closesMinutes: 23 * 60, // 11:00 PM
        minOrderPaise: R(50),
        updatedAt: new Date(),
      },
    },
  );
  console.log(`  [x] Sone Zone Cafe: matched ${soneZoneResult.matchedCount}, modified ${soneZoneResult.modifiedCount}`);

  // (e) Wrapchik Pizza
  // 10:00 am to 11:00 pm, min order 50 rs.
  const wrapchikResult = await restaurantsCollection.updateOne(
    { $or: [{ _id: "rest_wrapchik_nitp" }, { slug: "wrapchik-pizza" }, { name: { $regex: /wrapchik/i } }] },
    {
      $set: {
        opensMinutes: 10 * 60, // 10:00 AM
        closesMinutes: 23 * 60, // 11:00 PM
        minOrderPaise: R(50),
        updatedAt: new Date(),
      },
    },
  );
  console.log(`  [x] Wrapchik Pizza: matched ${wrapchikResult.matchedCount}, modified ${wrapchikResult.modifiedCount}`);

  // (f) The Royal Bihar Restaurant
  // 10:00 am to 11:00 pm
  const royalBiharResult = await restaurantsCollection.updateOne(
    {
      $or: [
        { _id: "rest_royalbihar_nitp" },
        { slug: "the-royal-bihar-restaurant" },
        { name: { $regex: /royal bihar/i } },
      ],
    },
    {
      $set: {
        opensMinutes: 10 * 60, // 10:00 AM
        closesMinutes: 23 * 60, // 11:00 PM
        minOrderPaise: R(50),
        updatedAt: new Date(),
      },
    },
  );
  console.log(`  [x] Royal Bihar: matched ${royalBiharResult.matchedCount}, modified ${royalBiharResult.modifiedCount}`);

  // (g) Prince Juice & Shakes Corner
  // min order 100 rs.
  const princeResult = await restaurantsCollection.updateOne(
    {
      $or: [
        { _id: "rest_princejuice_nitp" },
        { slug: "prince-juice-and-shakes-corner" },
        { name: { $regex: /prince juice/i } },
      ],
    },
    {
      $set: {
        minOrderPaise: R(100),
        updatedAt: new Date(),
      },
    },
  );
  console.log(`  [x] Prince Juice: matched ${princeResult.matchedCount}, modified ${princeResult.modifiedCount}`);

  console.log("\n=== Timings & Curfews successfully synced to database! ===");
}

async function main() {
  try {
    await updateTimingsAndCurfews();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

main().catch((err) => {
  console.error("Failed to update timings and curfews:", err);
  process.exit(1);
});
