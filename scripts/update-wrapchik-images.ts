/**
 * Points every Wrapchik Pizza menu item at its photo in public/menu/wrapchik/,
 * without reseeding (orders and availability toggles are kept). Overwrites
 * whatever imageUrl is stored.
 *
 * Usage:
 *   npm run db:update-wrapchik-images
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import { wrapchikItemImage } from "./seed-wrapchik";

const RESTAURANT_ID = "rest_wrapchik_nitp";

async function updateWrapchikImages(): Promise<void> {
  const itemsCollection = await db.menuItems();
  const items = await itemsCollection
    .find({ restaurantId: RESTAURANT_ID }, { projection: { _id: 1, name: 1 } })
    .toArray();

  if (items.length === 0) {
    console.log(`[!] No menu items for "${RESTAURANT_ID}". Run "npm run seed:wrapchik" first.`);
    return;
  }

  let updated = 0;
  const missing: string[] = [];
  for (const item of items) {
    const imageUrl = wrapchikItemImage(item._id);
    if (!existsSync(path.join(process.cwd(), "public", imageUrl))) {
      missing.push(`${item._id} (${item.name})`);
      continue;
    }
    await itemsCollection.updateOne({ _id: item._id }, { $set: { imageUrl } });
    updated++;
  }

  console.log(`[x] ${updated} / ${items.length} items now use their own photo.`);
  if (missing.length > 0) {
    console.log(`[!] No photo on disk for ${missing.length} item(s), left unchanged:`);
    for (const m of missing) console.log(`    - ${m}`);
  }
}

async function main() {
  try {
    await updateWrapchikImages();
  } catch (err) {
    console.error("Failed to update Wrapchik Pizza images:", err);
    process.exit(1);
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

main();
