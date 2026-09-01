import {
  ZERO_PAISE,
  addPaise,
  ceilPercentToRupee,
  multiplyPaise,
  subtractPaise,
  type ICampus,
  type IMenuItem,
  type IRestaurant,
  type Paise,
  type PaymentMethod,
} from "@trefood/shared";

import type { CartLine } from "@/hooks/use-cart";

/**
 * ⚠️ A PREVIEW. NOT A PRICE.
 *
 * Phase 2 has no backend, so the cart and checkout screens need numbers to lay out
 * against. This module produces them from the fixtures.
 *
 * It is NOT the pricing engine, and it never will be. `backend/src/services/pricing.ts`
 * (Phase 8) is the only place a real price is computed, and the server recomputes
 * every rupee at checkout from item IDs and quantities — a client-supplied price is a
 * security bug (docs/MASTER_PROMPT_PRD.md Part 4 rules 2 and 3).
 *
 * DELETE THIS FILE IN PHASE 8, and have the cart screen render what
 * `POST /orders/preview` returns. It survives only until that route exists, and it
 * follows the §2 formula exactly so the layout it produces is the layout the real
 * numbers will fill.
 */
export interface CartPreviewLine {
  lineId: string;
  item: IMenuItem;
  quantity: number;
  addOnNames: string[];
  lineTotalPaise: Paise;
}

export interface CartPreview {
  lines: CartPreviewLine[];
  subtotalPaise: Paise;
  packagingFeePaise: Paise;
  deliveryFeePaise: Paise;
  commissionBasePaise: Paise;
  platformCommissionPaise: Paise;
  vendorReceivablePaise: Paise;
  convenienceFeePaise: Paise;
  grandTotalPaise: Paise;
  /** HYBRID_COD: the 10% token paid online now. ONLINE_100: the whole bill. */
  payNowPaise: Paise;
  /** HYBRID_COD: cash handed to the rider. Equals vendorReceivable, exactly. */
  cashAtGatePaise: Paise;
  meetsMinimum: boolean;
}

export function buildCartPreview(
  lines: CartLine[],
  items: IMenuItem[],
  restaurant: IRestaurant,
  campus: ICampus,
  method: PaymentMethod,
): CartPreview | null {
  const resolved: CartPreviewLine[] = [];

  for (const line of lines) {
    const item = items.find((candidate) => candidate._id === line.itemId);
    if (item === undefined) continue;

    const chosenAddOns = item.addOnGroups
      .flatMap((group) => group.options)
      .filter((option) => line.addOnIds.includes(option.addOnId));

    const unitPaise = addPaise(item.pricePaise, ...chosenAddOns.map((a) => a.pricePaise));

    resolved.push({
      lineId: line.lineId,
      item,
      quantity: line.quantity,
      addOnNames: chosenAddOns.map((addOn) => addOn.name),
      lineTotalPaise: multiplyPaise(unitPaise, line.quantity),
    });
  }

  if (resolved.length === 0) return null;

  const subtotal = addPaise(...resolved.map((line) => line.lineTotalPaise));
  const packaging = restaurant.packagingFeePaise;
  const delivery = campus.settings.deliveryFeePaise;

  // D6 — commission is charged on food + packaging + delivery.
  const commissionBase = addPaise(subtotal, packaging, delivery);
  const commission = ceilPercentToRupee(commissionBase, campus.settings.commissionPct);
  const vendorReceivable = subtractPaise(commissionBase, commission);

  // The fee applies only to what actually moves through the gateway.
  const onlineCharge = method === "ONLINE_100" ? commissionBase : commission;
  const convenienceFee = ceilPercentToRupee(onlineCharge, campus.settings.gatewayFeePct);

  return {
    lines: resolved,
    subtotalPaise: subtotal,
    packagingFeePaise: packaging,
    deliveryFeePaise: delivery,
    commissionBasePaise: commissionBase,
    platformCommissionPaise: commission,
    vendorReceivablePaise: vendorReceivable,
    convenienceFeePaise: convenienceFee,
    grandTotalPaise: addPaise(commissionBase, convenienceFee),
    payNowPaise: addPaise(onlineCharge, convenienceFee),
    cashAtGatePaise: method === "HYBRID_COD" ? vendorReceivable : ZERO_PAISE,
    meetsMinimum: subtotal >= restaurant.minOrderPaise,
  };
}
