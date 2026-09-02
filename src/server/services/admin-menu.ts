import "server-only";

import * as db from "@/server/db/collections";
import { ACTOR } from "@/lib/constants";
import { newId } from "@/lib/ids";
import { type Paise } from "@/lib/money";
import { writeAudit } from "./audit";
import type { AddOnGroup, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";

export interface AdminMenuSection {
  category: MenuCategory;
  items: MenuItem[];
}

/**
 * Retrieve the full menu for admin management (including empty categories and unavailable items).
 */
export async function getVendorMenuForAdmin(restaurantId: string): Promise<{
  restaurant: Restaurant | null;
  sections: AdminMenuSection[];
}> {
  const [restaurant, categories, items] = await Promise.all([
    (await db.restaurants()).findOne({ _id: restaurantId }),
    (await db.menuCategories()).find({ restaurantId }).sort({ sortOrder: 1 }).toArray(),
    (await db.menuItems()).find({ restaurantId }).sort({ sortOrder: 1 }).toArray(),
  ]);

  const itemsByCategory = new Map<string, MenuItem[]>();
  for (const item of items) {
    const list = itemsByCategory.get(item.categoryId) ?? [];
    list.push(item);
    itemsByCategory.set(item.categoryId, list);
  }

  const sections: AdminMenuSection[] = categories.map((category) => ({
    category,
    items: itemsByCategory.get(category._id) ?? [],
  }));

  return { restaurant, sections };
}

/* ══════════════════════════════════════════════════════════════════════
   Categories
   ══════════════════════════════════════════════════════════════════════ */

export async function createMenuCategoryAdmin(params: {
  restaurantId: string;
  name: string;
  sortOrder?: number | undefined;
  actorId: string;
}): Promise<{ ok: true; category: MenuCategory } | { ok: false; message: string }> {
  const restaurants = await db.restaurants();
  const restaurant = await restaurants.findOne({ _id: params.restaurantId });
  if (!restaurant) return { ok: false, message: "Restaurant not found." };

  const categoriesCollection = await db.menuCategories();
  
  let sortOrder = params.sortOrder;
  if (sortOrder === undefined) {
    const lastCategory = await categoriesCollection
      .find({ restaurantId: params.restaurantId })
      .sort({ sortOrder: -1 })
      .limit(1)
      .toArray();
    const first = lastCategory[0];
    sortOrder = first ? first.sortOrder + 1 : 1;
  }

  const category: MenuCategory = {
    _id: newId("cat"),
    restaurantId: params.restaurantId,
    name: params.name.trim(),
    sortOrder,
  };

  await categoriesCollection.insertOne(category);

  await writeAudit({
    entity: "RESTAURANT",
    entityId: params.restaurantId,
    from: "NONE",
    to: `category:${category.name}`,
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Added category "${category.name}" to ${restaurant.name}`,
  });

  return { ok: true, category };
}

export async function updateMenuCategoryAdmin(params: {
  categoryId: string;
  restaurantId: string;
  name: string;
  sortOrder?: number | undefined;
  actorId: string;
}): Promise<{ ok: true; category: MenuCategory } | { ok: false; message: string }> {
  const categoriesCollection = await db.menuCategories();
  const before = await categoriesCollection.findOne({
    _id: params.categoryId,
    restaurantId: params.restaurantId,
  });
  if (!before) return { ok: false, message: "Category not found." };

  const updateFields: Partial<MenuCategory> = {
    name: params.name.trim(),
  };
  if (params.sortOrder !== undefined) {
    updateFields.sortOrder = params.sortOrder;
  }

  const updated = await categoriesCollection.findOneAndUpdate(
    { _id: params.categoryId, restaurantId: params.restaurantId },
    { $set: updateFields },
    { returnDocument: "after" },
  );

  if (!updated) return { ok: false, message: "Failed to update category." };

  await writeAudit({
    entity: "RESTAURANT",
    entityId: params.restaurantId,
    from: `category:${before.name}`,
    to: `category:${updated.name}`,
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Updated category "${updated.name}"`,
  });

  return { ok: true, category: updated };
}

export async function deleteMenuCategoryAdmin(params: {
  categoryId: string;
  restaurantId: string;
  actorId: string;
}): Promise<{ ok: true; deletedItemsCount: number } | { ok: false; message: string }> {
  const categoriesCollection = await db.menuCategories();
  const category = await categoriesCollection.findOne({
    _id: params.categoryId,
    restaurantId: params.restaurantId,
  });
  if (!category) return { ok: false, message: "Category not found." };

  // Delete all items under this category
  const itemsCollection = await db.menuItems();
  const deletedItems = await itemsCollection.deleteMany({
    categoryId: params.categoryId,
    restaurantId: params.restaurantId,
  });

  await categoriesCollection.deleteOne({
    _id: params.categoryId,
    restaurantId: params.restaurantId,
  });

  await writeAudit({
    entity: "RESTAURANT",
    entityId: params.restaurantId,
    from: `category:${category.name}`,
    to: "DELETED",
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Deleted category "${category.name}" and ${deletedItems.deletedCount ?? 0} item(s)`,
  });

  return { ok: true, deletedItemsCount: deletedItems.deletedCount ?? 0 };
}

/* ══════════════════════════════════════════════════════════════════════
   Menu Items
   ══════════════════════════════════════════════════════════════════════ */

export interface CreateMenuItemAdminParams {
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string | undefined;
  isVeg: boolean;
  pricePaise: Paise;
  imageUrl?: string | null | undefined;
  isAvailable?: boolean | undefined;
  isPopular?: boolean | undefined;
  addOnGroups?: AddOnGroup[] | undefined;
  sortOrder?: number | undefined;
  actorId: string;
}

export async function createMenuItemAdmin(
  params: CreateMenuItemAdminParams,
): Promise<{ ok: true; item: MenuItem } | { ok: false; message: string }> {
  const categoriesCollection = await db.menuCategories();
  const category = await categoriesCollection.findOne({
    _id: params.categoryId,
    restaurantId: params.restaurantId,
  });
  if (!category) return { ok: false, message: "Category does not exist." };

  const itemsCollection = await db.menuItems();

  let sortOrder = params.sortOrder;
  if (sortOrder === undefined) {
    const lastItem = await itemsCollection
      .find({ restaurantId: params.restaurantId, categoryId: params.categoryId })
      .sort({ sortOrder: -1 })
      .limit(1)
      .toArray();
    const first = lastItem[0];
    sortOrder = first ? first.sortOrder + 1 : 1;
  }

  const item: MenuItem = {
    _id: newId("item"),
    restaurantId: params.restaurantId,
    categoryId: params.categoryId,
    name: params.name.trim(),
    description: params.description?.trim() ?? "",
    isVeg: params.isVeg,
    pricePaise: params.pricePaise,
    imageUrl: params.imageUrl ?? null,
    isAvailable: params.isAvailable ?? true,
    isPopular: params.isPopular ?? false,
    addOnGroups: params.addOnGroups ?? [],
    sortOrder,
  };

  await itemsCollection.insertOne(item);

  await writeAudit({
    entity: "RESTAURANT",
    entityId: params.restaurantId,
    from: "NONE",
    to: `item:${item.name}`,
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Added menu item "${item.name}" (₹${item.pricePaise / 100}) to category "${category.name}"`,
  });

  return { ok: true, item };
}

export interface UpdateMenuItemAdminParams {
  itemId: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string | undefined;
  isVeg: boolean;
  pricePaise: Paise;
  imageUrl?: string | null | undefined;
  isAvailable: boolean;
  isPopular: boolean;
  addOnGroups?: AddOnGroup[] | undefined;
  sortOrder?: number | undefined;
  actorId: string;
}

export async function updateMenuItemAdmin(
  params: UpdateMenuItemAdminParams,
): Promise<{ ok: true; item: MenuItem } | { ok: false; message: string }> {
  const itemsCollection = await db.menuItems();
  const before = await itemsCollection.findOne({
    _id: params.itemId,
    restaurantId: params.restaurantId,
  });
  if (!before) return { ok: false, message: "Item not found." };

  const updateFields: Partial<MenuItem> = {
    categoryId: params.categoryId,
    name: params.name.trim(),
    description: params.description?.trim() ?? "",
    isVeg: params.isVeg,
    pricePaise: params.pricePaise,
    imageUrl: params.imageUrl !== undefined ? params.imageUrl : before.imageUrl,
    isAvailable: params.isAvailable,
    isPopular: params.isPopular,
    addOnGroups: params.addOnGroups ?? before.addOnGroups,
  };
  if (params.sortOrder !== undefined) {
    updateFields.sortOrder = params.sortOrder;
  }

  const updated = await itemsCollection.findOneAndUpdate(
    { _id: params.itemId, restaurantId: params.restaurantId },
    { $set: updateFields },
    { returnDocument: "after" },
  );

  if (!updated) return { ok: false, message: "Failed to update item." };

  await writeAudit({
    entity: "RESTAURANT",
    entityId: params.restaurantId,
    from: `item:${before.name} (₹${before.pricePaise / 100})`,
    to: `item:${updated.name} (₹${updated.pricePaise / 100})`,
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Updated menu item "${updated.name}"`,
  });

  return { ok: true, item: updated };
}

export async function deleteMenuItemAdmin(params: {
  itemId: string;
  restaurantId: string;
  actorId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const itemsCollection = await db.menuItems();
  const item = await itemsCollection.findOne({
    _id: params.itemId,
    restaurantId: params.restaurantId,
  });
  if (!item) return { ok: false, message: "Item not found." };

  await itemsCollection.deleteOne({ _id: params.itemId, restaurantId: params.restaurantId });

  await writeAudit({
    entity: "RESTAURANT",
    entityId: params.restaurantId,
    from: `item:${item.name}`,
    to: "DELETED",
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Deleted menu item "${item.name}"`,
  });

  return { ok: true };
}

export async function toggleMenuItemAvailabilityAdmin(params: {
  itemId: string;
  restaurantId: string;
  isAvailable: boolean;
  actorId: string;
}): Promise<{ ok: true; isAvailable: boolean } | { ok: false; message: string }> {
  const itemsCollection = await db.menuItems();
  const updated = await itemsCollection.findOneAndUpdate(
    { _id: params.itemId, restaurantId: params.restaurantId },
    { $set: { isAvailable: params.isAvailable } },
    { returnDocument: "after" },
  );

  if (!updated) return { ok: false, message: "Item not found." };

  await writeAudit({
    entity: "RESTAURANT",
    entityId: params.restaurantId,
    from: params.isAvailable ? "unavailable" : "available",
    to: params.isAvailable ? "available" : "unavailable",
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: `Item "${updated.name}" set to ${params.isAvailable ? "available" : "86-ed (out of stock)"}`,
  });

  return { ok: true, isAvailable: params.isAvailable };
}
