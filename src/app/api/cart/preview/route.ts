import { NextResponse } from "next/server";
import { z } from "zod";

import { previewCart } from "@/server/services/orders";
import { getSession } from "@/server/auth/session";
import {
  listEligibleCouponsForCart,
  validateCouponForOrder,
} from "@/server/services/coupons";

/**
 * Server-side cart pricing.
 *
 * The client posts item IDS AND QUANTITIES ONLY. Every rupee comes back from
 * `computePricing` — the same function order creation calls — so the number
 * shown here and the number collected at the gate cannot drift (PRD Part 4.3).
 *
 * There is one quote, not one per payment method: every order is cash on
 * delivery, and `cashDuePaise` is the single number the student needs.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  restaurantId: z.string().min(1),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        addOnOptionIds: z.array(z.string()).max(20),
      }),
    )
    .min(1)
    .max(50),
  couponCode: z.string().optional(),
});

export interface CartQuote {
  subtotalPaise: number;
  packagingFeePaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  commissionBasePaise: number;
  /** What the student hands the delivery partner, in cash, on handover. */
  grandTotalPaise: number;
}

export interface AvailableCouponDto {
  code: string;
  description?: string | null | undefined;
  type: "FLAT" | "PERCENT";
  valuePaise: number;
  valueBps: number;
  maxDiscountPaise: number;
  minOrderPaise: number;
  isEligible: boolean;
  reason?: string | undefined;
  calculatedDiscountPaise: number;
}

export interface CartPricingResponse {
  restaurantName: string;
  restaurantId: string;
  restaurantSlug: string;
  campusSlug: string;
  prepMinutes: number;
  transitMinutes: number;
  minOrderPaise: number;
  belowMinimum: boolean;
  isLateNightMinOrder?: boolean;
  items: {
    itemId: string;
    name: string;
    isVeg: boolean;
    quantity: number;
    lineTotalPaise: number;
    /** Packing for the whole line (per-unit fee x quantity). 0 when the vendor charges none. */
    linePackingFeePaise: number;
    addOns: { name: string; pricePaise: number }[];
  }[];
  quote: CartQuote;
  issues: { itemId: string; itemName: string; code: string; message: string }[];
  appliedCoupon?: {
    code: string;
    discountPaise: number;
    description?: string | null | undefined;
  } | null | undefined;
  availableCoupons: AvailableCouponDto[];
  couponError?: string | null | undefined;
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart payload" }, { status: 400 });
  }

  const session = await getSession();
  const studentId = session?.user?._id;

  // First check raw pre-discount preview
  const rawPreview = await previewCart({
    restaurantId: parsed.data.restaurantId,
    lines: parsed.data.lines,
  });

  if (!rawPreview) {
    return NextResponse.json({ error: "This cart can no longer be priced" }, { status: 404 });
  }

  let discountPaise = 0;
  let appliedCoupon: CartPricingResponse["appliedCoupon"] = null;
  let couponError: string | null = null;

  if (parsed.data.couponCode) {
    const couponValidation = await validateCouponForOrder({
      code: parsed.data.couponCode,
      restaurantId: parsed.data.restaurantId,
      campusId: rawPreview.campus._id,
      subtotalPaise: rawPreview.pricing.subtotalPaise,
      studentId: studentId ?? null,
    });

    if (couponValidation.ok) {
      discountPaise = couponValidation.discountPaise;
      appliedCoupon = {
        code: couponValidation.coupon.code,
        discountPaise: couponValidation.discountPaise,
        description: couponValidation.coupon.description ?? null,
      };
    } else {
      couponError = couponValidation.message;
    }
  }

  const [preview, availableCoupons] = await Promise.all([
    previewCart({
      restaurantId: parsed.data.restaurantId,
      lines: parsed.data.lines,
      discountPaise,
    }),
    listEligibleCouponsForCart({
      restaurantId: parsed.data.restaurantId,
      campusId: rawPreview.campus._id,
      subtotalPaise: rawPreview.pricing.subtotalPaise,
      studentId: studentId ?? null,
    }),
  ]);

  if (!preview) {
    return NextResponse.json({ error: "This cart can no longer be priced" }, { status: 404 });
  }

  const body: CartPricingResponse = {
    restaurantName: preview.restaurant.name,
    restaurantId: preview.restaurant._id,
    restaurantSlug: preview.restaurant.slug,
    campusSlug: preview.campus.slug,
    prepMinutes: preview.restaurant.prepMinutes,
    transitMinutes: preview.campus.settings.transitMinutes,
    minOrderPaise: preview.minOrderPaise,
    belowMinimum: preview.belowMinimum,
    isLateNightMinOrder: preview.isLateNightMinOrder ?? false,
    items: preview.items.map((i) => ({
      itemId: i.itemId,
      name: i.name,
      isVeg: i.isVeg,
      quantity: i.quantity,
      lineTotalPaise: i.lineTotalPaise,
      linePackingFeePaise: (i.packingFeePaise ?? 0) * i.quantity,
      addOns: i.addOns,
    })),
    quote: toQuote(preview),
    issues: preview.issues,
    appliedCoupon,
    availableCoupons: availableCoupons.map((c) => ({
      code: c.coupon.code,
      description: c.coupon.description,
      type: c.coupon.type,
      valuePaise: c.coupon.valuePaise,
      valueBps: c.coupon.valueBps,
      maxDiscountPaise: c.coupon.maxDiscountPaise,
      minOrderPaise: c.coupon.minOrderPaise,
      isEligible: c.isEligible,
      reason: c.reason,
      calculatedDiscountPaise: c.calculatedDiscountPaise,
    })),
    couponError,
  };

  return NextResponse.json(body);
}

function toQuote(preview: NonNullable<Awaited<ReturnType<typeof previewCart>>>): CartQuote {
  return {
    subtotalPaise: preview.pricing.subtotalPaise,
    packagingFeePaise: preview.pricing.packagingFeePaise,
    deliveryFeePaise: preview.pricing.deliveryFeePaise,
    discountPaise: preview.pricing.discountPaise,
    commissionBasePaise: preview.pricing.commissionBasePaise,
    grandTotalPaise: preview.pricing.grandTotalPaise,
  };
}
