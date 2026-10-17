/**
 * Update script to populate food item images for The Royal Bihar Restaurant
 * directly in the MongoDB database without wiping existing data or orders.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/update-royal-bihar-images.ts
 */

import { getDishImage } from "@/lib/dish-media";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";

const RESTAURANT_ID = "rest_royal_bihar_nitp";

async function updateRoyalBiharImages(): Promise<void> {
  console.log("=== Updating Food Item Images for The Royal Bihar Restaurant ===\n");

  const itemsCollection = await db.menuItems();
  const items = await itemsCollection.find({ restaurantId: RESTAURANT_ID }).toArray();

  if (items.length === 0) {
    console.log(`[!] No menu items found for restaurant "${RESTAURANT_ID}".`);
    console.log("    Run \"npm run seed:royal\" to onboard and seed the restaurant first.");
    return;
  }

  console.log(`Found ${items.length} items for Royal Bihar Restaurant in database.`);

  let updatedCount = 0;
  for (const item of items) {
    const imageUrl = getDishImage({
      id: item._id,
      name: item.name,
      categoryId: item.categoryId,
      isVeg: item.isVeg,
      imageUrl: item.imageUrl,
    });

    if (imageUrl) {
      await itemsCollection.updateOne(
        { _id: item._id },
        { $set: { imageUrl } },
      );
      updatedCount++;
    }
  }

  console.log(`\n[x] Successfully updated ${updatedCount} / ${items.length} food items with high-resolution images!`);
  
  // Print a few sample items to verify
  const sample = await itemsCollection.find({ restaurantId: RESTAURANT_ID }).limit(5).toArray();
  console.log("\nSample updated items:");
  for (const s of sample) {
    console.log(`  - ${s.name} (${s.isVeg ? "Veg" : "Non-Veg"}): ${s.imageUrl?.slice(0, 60)}...`);
  }
}

async function main() {
  try {
    await updateRoyalBiharImages();
  } catch (err) {
    console.error("Failed to update Royal Bihar food images:", err);
    process.exit(1);
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

main();
