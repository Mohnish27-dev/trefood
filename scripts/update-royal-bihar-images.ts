/**
 * Points every Royal Bihar menu item at its photo in public/menu/royalBihar/,
 * without reseeding (orders and availability toggles are kept). Overwrites
 * whatever imageUrl is stored, including the wrong stock photos written by
 * the earlier version of this script.
 *
 * Usage:
 *   npm run db:update-royal-images
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import { royalBiharItemImage } from "./seed-royal-bihar";

const RESTAURANT_ID = "rest_royal_bihar_nitp";

async function updateRoyalBiharImages(): Promise<void> {
  const itemsCollection = await db.menuItems();
  const items = await itemsCollection
    .find({ restaurantId: RESTAURANT_ID }, { projection: { _id: 1, name: 1 } })
    .toArray();

  if (items.length === 0) {
    console.log(`[!] No menu items for "${RESTAURANT_ID}". Run "npm run seed:royal" first.`);
    return;
  }

  let updated = 0;
  const missing: string[] = [];
  for (const item of items) {
    const imageUrl = royalBiharItemImage(item._id);
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
    await updateRoyalBiharImages();
  } catch (err) {
    console.error("Failed to update Royal Bihar images:", err);
    process.exit(1);
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

main();
