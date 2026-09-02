"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { pctToBps, rupeesToPaise } from "@/lib/money";
import { requireAdmin } from "@/server/auth/session";
import {
  createCouponDirectly,
  deleteCoupon,
  toggleCouponStatus,
  validateCouponForOrder,
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
  fundedBy: z.enum(["PLATFORM", "VENDOR"]).default("PLATFORM"),
  type: z.enum(["FLAT", "PERCENT"]),
  value: z.number().positive("Discount value must be greater than 0"),
  maxDiscountRupees: z.number().nonnegative().optional(),
  minOrderRupees: z.number().nonnegative().default(0),
  perStudentLimit: z.number().int().min(1).default(1),
  totalLimit: z.number().int().positive().nullable().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().min(1, "Expiration date is required"),
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
    fundedBy,
    type,
    value,
    maxDiscountRupees,
    minOrderRupees,
    perStudentLimit,
    totalLimit,
    validFrom,
    validUntil,
  } = parsed.data;

  const validUntilDate = new Date(validUntil);
  if (isNaN(validUntilDate.getTime())) {
    return { status: "error", message: "Invalid expiration date" };
  }

  const validFromDate = validFrom ? new Date(validFrom) : new Date();

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
    fundedBy,
    type,
    valuePaise,
    valueBps,
    maxDiscountPaise,
    minOrderPaise,
    perStudentLimit,
    totalLimit: totalLimit ?? null,
    validFrom: validFromDate,
    validUntil: validUntilDate,
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

const validateCouponSchema = z.object({
  code: z.string().min(1),
  restaurantId: z.string().min(1),
  campusId: z.string().min(1),
  subtotalPaise: z.number().int().nonnegative(),
  studentId: z.string().optional(),
});

export async function validateCouponCodeAction(input: unknown): Promise<
  | { status: "success"; couponCode: string; discountPaise: number; message: string }
  | { status: "error"; message: string }
> {
  const parsed = validateCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid coupon request." };
  }

  const res = await validateCouponForOrder({
    code: parsed.data.code,
    restaurantId: parsed.data.restaurantId,
    campusId: parsed.data.campusId,
    subtotalPaise: parsed.data.subtotalPaise,
    studentId: parsed.data.studentId ?? null,
  });

  if (!res.ok) {
    return { status: "error", message: res.message };
  }

  return {
    status: "success",
    couponCode: res.coupon.code,
    discountPaise: res.discountPaise,
    message: `Applied coupon ${res.coupon.code} (-₹${res.discountPaise / 100})`,
  };
}
