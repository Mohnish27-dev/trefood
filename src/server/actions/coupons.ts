"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { pctToBps, rupeesToPaise } from "@/lib/money";
import { requireAdmin } from "@/server/auth/session";
import {
  createCouponDirectly,
  deleteCoupon,
  toggleCouponStatus,
} from "@/server/services/coupons";

export type ActionResponse =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const createCouponSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(20, "Code cannot exceed 20 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Code must contain only letters, numbers, and dashes"),
  description: z.string().max(100).optional(),
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  campusId: z.string().optional(),
  type: z.enum(["FLAT", "PERCENT"]),
  value: z.number().positive("Discount value must be greater than 0"),
  maxDiscountRupees: z.number().nonnegative().optional(),
  minOrderRupees: z.number().nonnegative().default(0),
  perStudentLimit: z.number().int().min(1).default(1),
  /** First N distinct customers. 0 = everyone, until the coupon closes. */
  personLimit: z.number().int().min(0, "Person limit cannot be negative").default(0),
  /** Empty = the whole menu. */
  menuItemIds: z.array(z.string().min(1)).max(200).default([]),
});

export async function createRestaurantCouponAction(input: unknown): Promise<ActionResponse> {
  const session = await requireAdmin();
  const parsed = createCouponSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid coupon details" };
  }

  const {
    code,
    description,
    restaurantId,
    campusId,
    type,
    value,
    maxDiscountRupees,
    minOrderRupees,
    perStudentLimit,
    personLimit,
    menuItemIds,
  } = parsed.data;

  const valuePaise = type === "FLAT" ? rupeesToPaise(value) : 0;
  const valueBps = type === "PERCENT" ? pctToBps(value) : 0;
  const maxDiscountPaise =
    type === "PERCENT" && maxDiscountRupees !== undefined
      ? rupeesToPaise(maxDiscountRupees)
      : valuePaise;
  const minOrderPaise = rupeesToPaise(minOrderRupees);

  const res = await createCouponDirectly({
    code,
    description: description || null,
    restaurantId,
    campusId: campusId || null,
    type,
    valuePaise,
    valueBps,
    maxDiscountPaise,
    minOrderPaise,
    perStudentLimit,
    personLimit,
    menuItemIds,
    // No validUntil: every coupon closes at the end of the campus day it was made.
    actorId: session.user._id,
  });

  if (!res.ok) {
    return { status: "error", message: res.message };
  }

  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${restaurantId}/coupons`);
  return { status: "success", message: `Coupon "${code.toUpperCase()}" created successfully!` };
}

const toggleCouponSchema = z.object({
  couponId: z.string().min(1),
  isActive: z.boolean(),
  restaurantId: z.string().optional(),
});

export async function toggleCouponStatusAction(input: unknown): Promise<ActionResponse> {
  const session = await requireAdmin();
  const parsed = toggleCouponSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Invalid payload" };
  }

  const res = await toggleCouponStatus(
    parsed.data.couponId,
    parsed.data.isActive,
    session.user._id,
  );

  if (!res.ok) {
    return { status: "error", message: res.message };
  }

  if (parsed.data.restaurantId) {
    revalidatePath(`/admin/vendors/${parsed.data.restaurantId}/coupons`);
  }
  revalidatePath("/admin/vendors");

  return {
    status: "success",
    message: `Coupon is now ${parsed.data.isActive ? "active" : "inactive"}.`,
  };
}

const deleteCouponSchema = z.object({
  couponId: z.string().min(1),
  restaurantId: z.string().optional(),
});

export async function deleteCouponAction(input: unknown): Promise<ActionResponse> {
  const session = await requireAdmin();
  const parsed = deleteCouponSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Invalid payload" };
  }

  const res = await deleteCoupon(parsed.data.couponId, session.user._id);
  if (!res.ok) {
    return { status: "error", message: res.message };
  }

  if (parsed.data.restaurantId) {
    revalidatePath(`/admin/vendors/${parsed.data.restaurantId}/coupons`);
  }
  revalidatePath("/admin/vendors");

  return { status: "success", message: "Coupon deleted successfully." };
}
