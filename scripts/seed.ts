/**
 * Idempotent seed.
 *
 *   npm run seed
 *
 * Re-runnable: every document is upserted on its deterministic _id, so
 * running this twice leaves the database in exactly the same state. Orders
 * and audit logs are never touched — a reseed refreshes the catalogue without
 * destroying a demo already in flight.
 */

import { ensureIndexes } from "@/server/db/indexes";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import { CAMPUS, CATEGORIES, MENU_ITEMS, RESTAURANTS, USERS } from "./seed-data";

async function main(): Promise<void> {
  console.log("TREFOOD seed\n");

  console.log("  indexes...");
  const reports = await ensureIndexes();
  const failed = reports.filter((r) => r.error !== null);
  for (const r of failed) console.error(`    ! ${r.collection}: ${r.error ?? ""}`);
  const created = reports.reduce((n, r) => n + r.created.length, 0);
  console.log(`    ${created} index(es) ensured across ${reports.length} collections`);

  console.log("  campus...");
  await (await db.campuses()).replaceOne({ _id: CAMPUS._id }, CAMPUS, { upsert: true });
  console.log(`    ${CAMPUS.name} with ${CAMPUS.zones.length} gates`);
  for (const zone of CAMPUS.zones) {
    const curfew =
      zone.curfewMinutes === null
        ? "24x7"
        : `curfew ${String(Math.trunc(zone.curfewMinutes / 60)).padStart(2, "0")}:${String(
            zone.curfewMinutes % 60,
          ).padStart(2, "0")}`;
    console.log(`      - ${zone.name} (${curfew})`);
  }

  console.log("  restaurants...");
  const restaurants = await db.restaurants();
  for (const r of RESTAURANTS) {
    await restaurants.replaceOne({ _id: r._id }, r, { upsert: true });
    console.log(`    ${r.name} — ${r.isOpen ? "open" : "closed"}, serves ${r.servedZoneIds.length} zone(s)`);
  }

  console.log("  menu...");
  const categories = await db.menuCategories();
  for (const c of CATEGORIES) await categories.replaceOne({ _id: c._id }, c, { upsert: true });

  const items = await db.menuItems();
  for (const i of MENU_ITEMS) await items.replaceOne({ _id: i._id }, i, { upsert: true });

  const unavailable = MENU_ITEMS.filter((i) => !i.isAvailable).length;
  console.log(`    ${CATEGORIES.length} categories, ${MENU_ITEMS.length} items (${unavailable} seeded 86-ed)`);

  console.log("  accounts...");
  const users = await db.users();
  for (const u of USERS) await users.replaceOne({ _id: u._id }, u, { upsert: true });
  console.log(`    ${USERS.length} demo accounts (1 of them COD-blocked, for the F9 screen)`);

  console.log("\nSeed complete.\n");
  console.log("  Student   /c/nit-patna");
  console.log("  Vendor    /vendor/orders");
  console.log("  Admin     /admin/orders");

  const client = await getMongoClient();
  await client.close();
}

main().catch((error: unknown) => {
  console.error("\nSeed failed:\n", error);
  process.exitCode = 1;
});
