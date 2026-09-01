import { NextResponse } from "next/server";
import { z } from "zod";

import { previewCart } from "@/server/services/orders";
import { PAYMENT_METHOD, type PaymentMethod } from "@/lib/constants";

/**
 * Server-side cart pricing.
 *
 * The client posts item IDS AND QUANTITIES ONLY. Every rupee comes back from
 * `computePricing` — the same function order creation calls — so the number
 * shown here and the number charged at checkout cannot drift (PRD Part 4.3).
 *
 * Both payment methods are priced in one round trip, because the convenience
 * fee differs between them (it applies to the full total for prepaid, but only
 * to the 10% token for COD) and the checkout screen has to show the student
 * the real cost of each before they choose.
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

export interface CartPricingResponse {
  restaurantName: string;
  restaurantId: string;
  restaurantSlug: string;
  campusSlug: string;
  prepMinutes: number;
  transitMinutes: number;
  minOrderPaise: number;
  belowMinimum: boolean;
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
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart payload" }, { status: 400 });
  }

  const [prepaid, cod] = await Promise.all([
    previewCart({
      restaurantId: parsed.data.restaurantId,
      lines: parsed.data.lines,
      method: PAYMENT_METHOD.ONLINE_100,
    }),
    previewCart({
      restaurantId: parsed.data.restaurantId,
      lines: parsed.data.lines,
      method: PAYMENT_METHOD.HYBRID_COD,
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
