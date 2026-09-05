import { NextResponse } from "next/server";
import { z } from "zod";

import { previewCart } from "@/server/services/orders";
import { PAYMENT_METHOD, type PaymentMethod } from "@/lib/constants";
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
 * shown here and the number charged at checkout cannot drift (PRD Part 4.3).
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
  method: PaymentMethod;
  subtotalPaise: number;
  packagingFeePaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  commissionBasePaise: number;
  convenienceFeePaise: number;
  grandTotalPaise: number;
  onlinePaidPaise: number;
  cashDueOnDeliveryPaise: number;
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
  codEnabled: boolean;
  items: {
    itemId: string;
    name: string;
    isVeg: boolean;
    quantity: number;
    lineTotalPaise: number;
    addOns: { name: string; pricePaise: number }[];
  }[];
  quotes: Record<PaymentMethod, CartQuote>;
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
    method: PAYMENT_METHOD.ONLINE_100,
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

  const [prepaid, cod, availableCoupons] = await Promise.all([
    previewCart({
      restaurantId: parsed.data.restaurantId,
      lines: parsed.data.lines,
      method: PAYMENT_METHOD.ONLINE_100,
      discountPaise,
    }),
    previewCart({
      restaurantId: parsed.data.restaurantId,
      lines: parsed.data.lines,
      method: PAYMENT_METHOD.HYBRID_COD,
      discountPaise,
    }),
    listEligibleCouponsForCart({
      restaurantId: parsed.data.restaurantId,
      campusId: rawPreview.campus._id,
      subtotalPaise: rawPreview.pricing.subtotalPaise,
      studentId: studentId ?? null,
    }),
  ]);

  if (!prepaid || !cod) {
    return NextResponse.json({ error: "This cart can no longer be priced" }, { status: 404 });
  }

  const body: CartPricingResponse = {
    restaurantName: prepaid.restaurant.name,
    restaurantId: prepaid.restaurant._id,
    restaurantSlug: prepaid.restaurant.slug,
    campusSlug: prepaid.campus.slug,
    prepMinutes: prepaid.restaurant.prepMinutes,
    transitMinutes: prepaid.campus.settings.transitMinutes,
    minOrderPaise: prepaid.minOrderPaise,
    belowMinimum: prepaid.belowMinimum,
    isLateNightMinOrder: prepaid.isLateNightMinOrder ?? false,
    codEnabled: prepaid.campus.settings.codEnabled,
    items: prepaid.items.map((i) => ({
      itemId: i.itemId,
      name: i.name,
      isVeg: i.isVeg,
      quantity: i.quantity,
      lineTotalPaise: i.lineTotalPaise,
      addOns: i.addOns,
    })),
    quotes: {
      [PAYMENT_METHOD.ONLINE_100]: toQuote(PAYMENT_METHOD.ONLINE_100, prepaid),
      [PAYMENT_METHOD.HYBRID_COD]: toQuote(PAYMENT_METHOD.HYBRID_COD, cod),
    },
    issues: prepaid.issues,
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

function toQuote(
  method: PaymentMethod,
  preview: NonNullable<Awaited<ReturnType<typeof previewCart>>>,
): CartQuote {
  return {
    method,
    subtotalPaise: preview.pricing.subtotalPaise,
    packagingFeePaise: preview.pricing.packagingFeePaise,
    deliveryFeePaise: preview.pricing.deliveryFeePaise,
    discountPaise: preview.pricing.discountPaise,
    commissionBasePaise: preview.pricing.commissionBasePaise,
    convenienceFeePaise: preview.pricing.convenienceFeePaise,
    grandTotalPaise: preview.pricing.grandTotalPaise,
    onlinePaidPaise: preview.onlinePaidPaise,
    cashDueOnDeliveryPaise: preview.cashDueOnDeliveryPaise,
  };
}
