/**
 * Idempotent seed.
 *
 *   npm run seed
 *
 * Seeds exactly two things — the campus (gates, curfews, pricing defaults)
 * and the admin account — and removes the old scripted demo catalogue
 * (fictional restaurants, their menus, demo orders and the demo student)
 * from any database it runs against.
 *
 * Re-runnable: every document is upserted on its deterministic _id and every
 * cleanup delete simply matches nothing on an already-clean database. Real
 * vendors come from /admin/vendors; real students from Supabase sign-in.
 */

import { ensureIndexes } from "@/server/db/indexes";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import {
  ADMIN_EMAIL,
  CAMPUS,
  LEGACY_ADMIN_EMAILS,
  LEGACY_DEMO_ORDER_KEY_PATTERN,
  LEGACY_DEMO_RESTAURANT_IDS,
  LEGACY_DEMO_USER_EMAILS,
  LEGACY_DEMO_USER_IDS,
  USERS,
} from "./seed-data";

/**
 * Remove the prototype's scripted fixtures and everything that references
 * them, so only real data remains. Audit logs of deleted demo orders go with
 * them — the trail is append-only for documents that exist, not for fixtures
 * that never should have outlived the demo.
 */
async function removeLegacyDemoData(): Promise<number> {
  const removed = { total: 0 };
  const count = (result: { deletedCount?: number }): number => result.deletedCount ?? 0;

  // Orders: anything the demo panel or the demo-order script created, plus
  // any real-looking order against a fictional restaurant.
  const orders = await db.orders();
  const doomedOrders = await orders
    .find({
      $or: [
        { idempotencyKey: { $regex: LEGACY_DEMO_ORDER_KEY_PATTERN } },
        { restaurantId: { $in: LEGACY_DEMO_RESTAURANT_IDS } },
        { customerId: { $in: LEGACY_DEMO_USER_IDS } },
      ],
    })
    .project<{ _id: string }>({ _id: 1 })
    .toArray();
  const doomedOrderIds = doomedOrders.map((order) => order._id);

  if (doomedOrderIds.length > 0) {
    removed.total += count(await orders.deleteMany({ _id: { $in: doomedOrderIds } }));
    removed.total += count(
      await (await db.auditLogs()).deleteMany({ orderId: { $in: doomedOrderIds } }),
    );
    removed.total += count(
      await (await db.disputes()).deleteMany({ orderId: { $in: doomedOrderIds } }),
    );
  }

  // The fictional restaurants and everything hanging off them.
  removed.total += count(
    await (await db.restaurants()).deleteMany({ _id: { $in: LEGACY_DEMO_RESTAURANT_IDS } }),
  );
  removed.total += count(
    await (await db.menuCategories()).deleteMany({
      restaurantId: { $in: LEGACY_DEMO_RESTAURANT_IDS },
    }),
  );
  removed.total += count(
    await (await db.menuItems()).deleteMany({
      restaurantId: { $in: LEGACY_DEMO_RESTAURANT_IDS },
    }),
  );
  removed.total += count(
    await (await db.coupons()).deleteMany({
      restaurantId: { $in: LEGACY_DEMO_RESTAURANT_IDS },
    }),
  );
  removed.total += count(
    await (await db.settlements()).deleteMany({
      restaurantId: { $in: LEGACY_DEMO_RESTAURANT_IDS },
    }),
  );
  removed.total += count(
    await (await db.ledgerEntries()).deleteMany({
      restaurantId: { $in: LEGACY_DEMO_RESTAURANT_IDS },
    }),
  );

  // Demo accounts, and the old pre-real-auth admin login (the fresh admin
  // document is upserted immediately after, so the seat is never empty).
  const users = await db.users();
  removed.total += count(
    await users.deleteMany({
      $or: [
        { _id: { $in: LEGACY_DEMO_USER_IDS } },
        { email: { $in: LEGACY_DEMO_USER_EMAILS } },
        { restaurantId: { $in: LEGACY_DEMO_RESTAURANT_IDS } },
        { email: { $in: LEGACY_ADMIN_EMAILS } },
      ],
    }),
  );

  // Audit trails left dangling by everything deleted above.
  removed.total += count(
    await (
      await db.auditLogs()
    ).deleteMany({
      $or: [
        { entityId: { $in: LEGACY_DEMO_RESTAURANT_IDS } },
        { entityId: { $in: LEGACY_DEMO_USER_IDS } },
        { actorId: { $in: LEGACY_DEMO_USER_IDS } },
      ],
    }),
  );

  // Orphaned settlement audit entries: the demo settlement cron logged one per
  // fictional restaurant, and deleting those settlements (above) left the log
  // rows pointing at documents that no longer exist. Drop any SETTLEMENT audit
  // whose settlement is gone — on a live database that set is empty, so real
  // history is untouched.
  const auditLogs = await db.auditLogs();
  const survivingSettlementIds = (await (await db.settlements()).find({}).project<{ _id: string }>({ _id: 1 }).toArray()).map(
    (s) => s._id,
  );
  removed.total += count(
    await auditLogs.deleteMany({
      entity: "SETTLEMENT",
      entityId: { $nin: survivingSettlementIds },
    }),
  );

  return removed.total;
}

async function main(): Promise<void> {
  console.log("TREFOOD seed\n");

  console.log("  indexes...");
  const reports = await ensureIndexes();
  const failed = reports.filter((r) => r.error !== null);
  for (const r of failed) console.error(`    ! ${r.collection}: ${r.error ?? ""}`);
  const created = reports.reduce((n, r) => n + r.created.length, 0);
  console.log(`    ${created} index(es) ensured across ${reports.length} collections`);

  console.log("  legacy demo data...");
  const removed = await removeLegacyDemoData();
  console.log(
    removed === 0
      ? "    nothing to remove — database already clean"
      : `    ${removed} demo document(s) removed`,
  );

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

  console.log("  accounts...");
  const users = await db.users();
  for (const u of USERS) {
    // The admin email may already exist as a Supabase-provisioned student
    // (users.email_unique). Promote that account in place instead of colliding
    // — keeping its authId so Google sign-in lands on the admin seat.
    const existing = await users.findOne({ email: u.email });
    if (existing && existing._id !== u._id) {
      await users.updateOne(
        { _id: existing._id },
        { $set: { role: u.role, email: u.email, passwordHash: u.passwordHash ?? null } },
      );
    } else {
      await users.replaceOne({ _id: u._id }, u, { upsert: true });
    }
  }
  console.log(`    admin: ${ADMIN_EMAIL}`);

  console.log("\nSeed complete.\n");
  console.log("  1. Sign in as admin       /signin");
  console.log("  2. Add your real vendors  /admin/vendors  (Add Vendor)");
  console.log("  3. Each vendor adds their own menu and hours from /vendor/menu");
  console.log("  4. Students simply sign in with Google — accounts are auto-created");

  const client = await getMongoClient();
  await client.close();
}

main().catch((error: unknown) => {
  console.error("\nSeed failed:\n", error);
  process.exitCode = 1;
});
