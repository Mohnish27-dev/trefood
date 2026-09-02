"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rupeesToPaise } from "@/lib/money";
import { newId } from "@/lib/ids";
import { requireAdmin } from "@/server/auth/session";
import {
  createMenuCategoryAdmin,
  createMenuItemAdmin,
  deleteMenuCategoryAdmin,
  deleteMenuItemAdmin,
  toggleMenuItemAvailabilityAdmin,
  updateMenuCategoryAdmin,
  updateMenuItemAdmin,
} from "@/server/services/admin-menu";
import type { AddOnGroup } from "@/types/restaurant";

export type AdminMenuActionState =
  | { status: "ok"; message: string; data?: unknown }
  | { status: "error"; message: string };

/* ══════════════════════════════════════════════════════════════════════
   Category Actions
   ══════════════════════════════════════════════════════════════════════ */

const createCategorySchema = z.object({
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  name: z.string().trim().min(1, "Category name is required").max(60),
  sortOrder: z.coerce.number().int().optional(),
});

export async function createMenuCategoryAction(input: unknown): Promise<AdminMenuActionState> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid category data." };
  }

  const { user } = await requireAdmin();
  const result = await createMenuCategoryAdmin({
    ...parsed.data,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/vendors/${parsed.data.restaurantId}/menu`);
  revalidatePath("/vendor/menu");
  return { status: "ok", message: `Category "${result.category.name}" created` };
}

const updateCategorySchema = z.object({
  categoryId: z.string().min(1),
  restaurantId: z.string().min(1),
  name: z.string().trim().min(1, "Category name is required").max(60),
  sortOrder: z.coerce.number().int().optional(),
});

export async function updateMenuCategoryAction(input: unknown): Promise<AdminMenuActionState> {
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid category data." };
  }

  const { user } = await requireAdmin();
  const result = await updateMenuCategoryAdmin({
    ...parsed.data,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/vendors/${parsed.data.restaurantId}/menu`);
  revalidatePath("/vendor/menu");
  return { status: "ok", message: `Category "${result.category.name}" updated` };
}

const deleteCategorySchema = z.object({
  categoryId: z.string().min(1),
  restaurantId: z.string().min(1),
});

export async function deleteMenuCategoryAction(input: unknown): Promise<AdminMenuActionState> {
  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid request." };
  }

  const { user } = await requireAdmin();
  const result = await deleteMenuCategoryAdmin({
    ...parsed.data,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/vendors/${parsed.data.restaurantId}/menu`);
  revalidatePath("/vendor/menu");
  return {
    status: "ok",
    message: `Category and ${result.deletedItemsCount} item(s) deleted`,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Menu Item Actions
   ══════════════════════════════════════════════════════════════════════ */

const addOnOptionSchema = z.object({
  id: z.string().default(() => newId("opt")),
  name: z.string().trim().min(1, "Option name is required"),
  priceRupees: z.coerce.number().min(0, "Price cannot be negative"),
  isAvailable: z.boolean().default(true),
});

const addOnGroupSchema = z.object({
  id: z.string().default(() => newId("grp")),
  name: z.string().trim().min(1, "Group name is required"),
  minSelect: z.coerce.number().int().min(0),
  maxSelect: z.coerce.number().int().min(1),
  options: z.array(addOnOptionSchema),
});

const createItemSchema = z.object({
  restaurantId: z.string().min(1),
  categoryId: z.string().min(1, "Select a category"),
  name: z.string().trim().min(1, "Item name is required").max(100),
  description: z.string().trim().optional(),
  isVeg: z.boolean().default(true),
  priceRupees: z.coerce.number().min(0, "Price cannot be negative"),
  imageUrl: z.string().url().nullable().optional(),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  addOnGroups: z.array(addOnGroupSchema).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function createMenuItemAction(input: unknown): Promise<AdminMenuActionState> {
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid item data." };
  }

  const { user } = await requireAdmin();
  const data = parsed.data;

  const addOnGroups: AddOnGroup[] = (data.addOnGroups ?? []).map((grp) => ({
    id: grp.id || newId("grp"),
    name: grp.name,
    minSelect: grp.minSelect,
    maxSelect: Math.max(grp.minSelect, grp.maxSelect),
    options: grp.options.map((opt) => ({
      id: opt.id || newId("opt"),
      name: opt.name,
      pricePaise: rupeesToPaise(opt.priceRupees),
      isAvailable: opt.isAvailable,
    })),
  }));

  const result = await createMenuItemAdmin({
    restaurantId: data.restaurantId,
    categoryId: data.categoryId,
    name: data.name,
    description: data.description,
    isVeg: data.isVeg,
    pricePaise: rupeesToPaise(data.priceRupees),
    imageUrl: data.imageUrl,
    isAvailable: data.isAvailable,
    isPopular: data.isPopular,
    addOnGroups,
    sortOrder: data.sortOrder,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/vendors/${data.restaurantId}/menu`);
  revalidatePath("/vendor/menu");
  return { status: "ok", message: `Item "${result.item.name}" added to menu` };
}

const updateItemSchema = z.object({
  itemId: z.string().min(1),
  restaurantId: z.string().min(1),
  categoryId: z.string().min(1, "Select a category"),
  name: z.string().trim().min(1, "Item name is required").max(100),
  description: z.string().trim().optional(),
  isVeg: z.boolean().default(true),
  priceRupees: z.coerce.number().min(0, "Price cannot be negative"),
  imageUrl: z.string().url().nullable().optional(),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  addOnGroups: z.array(addOnGroupSchema).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function updateMenuItemAction(input: unknown): Promise<AdminMenuActionState> {
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid item data." };
  }

  const { user } = await requireAdmin();
  const data = parsed.data;

  const addOnGroups: AddOnGroup[] = (data.addOnGroups ?? []).map((grp) => ({
    id: grp.id || newId("grp"),
    name: grp.name,
    minSelect: grp.minSelect,
    maxSelect: Math.max(grp.minSelect, grp.maxSelect),
    options: grp.options.map((opt) => ({
      id: opt.id || newId("opt"),
      name: opt.name,
      pricePaise: rupeesToPaise(opt.priceRupees),
      isAvailable: opt.isAvailable,
    })),
  }));

  const result = await updateMenuItemAdmin({
    itemId: data.itemId,
    restaurantId: data.restaurantId,
    categoryId: data.categoryId,
    name: data.name,
    description: data.description,
    isVeg: data.isVeg,
    pricePaise: rupeesToPaise(data.priceRupees),
    imageUrl: data.imageUrl,
    isAvailable: data.isAvailable,
    isPopular: data.isPopular,
    addOnGroups,
    sortOrder: data.sortOrder,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/vendors/${data.restaurantId}/menu`);
  revalidatePath("/vendor/menu");
  return { status: "ok", message: `Item "${result.item.name}" updated` };
}

const deleteItemSchema = z.object({
  itemId: z.string().min(1),
  restaurantId: z.string().min(1),
});

export async function deleteMenuItemAction(input: unknown): Promise<AdminMenuActionState> {
  const parsed = deleteItemSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid request." };
  }

  const { user } = await requireAdmin();
  const result = await deleteMenuItemAdmin({
    ...parsed.data,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/vendors/${parsed.data.restaurantId}/menu`);
  revalidatePath("/vendor/menu");
  return { status: "ok", message: "Item deleted from menu" };
}

const toggleAvailabilitySchema = z.object({
  itemId: z.string().min(1),
  restaurantId: z.string().min(1),
  isAvailable: z.boolean(),
});

export async function toggleMenuItemAvailabilityAction(
  input: unknown,
): Promise<AdminMenuActionState> {
  const parsed = toggleAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid request." };
  }

  const { user } = await requireAdmin();
  const result = await toggleMenuItemAvailabilityAdmin({
    ...parsed.data,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/vendors/${parsed.data.restaurantId}/menu`);
  revalidatePath("/vendor/menu");
  return {
    status: "ok",
    message: result.isAvailable ? "Item marked available" : "Item 86-ed (out of stock)",
  };
}
