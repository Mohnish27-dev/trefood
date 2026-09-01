import { NextResponse } from "next/server";

import { getSession } from "@/server/auth/session";
import { getCampusById } from "@/server/services/catalog";
import { estimatedArrival, gateDeadline, getOrderForCustomer } from "@/server/services/orders";
import { revealGateCode } from "@/server/services/gate-code";
import { TERMINAL_STATUSES, type OrderStatus, type PaymentMethod } from "@/lib/constants";

/**
 * The student tracker poll. Every 8 seconds.
 *
 * Never cached, at any layer, including the service worker: a stale "Cooking"
 * screen while the rider is standing at the gate is worse than a spinner
 * (ARCH section 9).
 *
 * The gate code is redacted here, not in the UI. `revealGateCode` returns null
 * unless the order is AT_GATE, so the code is not merely hidden from the
 * screen — it never leaves the server until the vendor has tapped
 * "Rider at gate". A student cannot pre-confirm from their room by reading
 * the network tab.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface OrderPollResponse {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  isTerminal: boolean;

  restaurantName: string;
  restaurantPhone: string;
  zoneName: string;
  zoneInstructions: string;

  /** Null until AT_GATE. Enforced server-side. */
  gateCode: string | null;
  /** ISO string, or null before acceptance. */
  estimatedArrival: string | null;
  /** ISO string of the 15-minute grace deadline, or null. */
  gateDeadline: string | null;

  method: PaymentMethod;
  onlinePaidPaise: number;
  cashDueOnDeliveryPaise: number;
  refundablePaise: number;
  cancellationReason: string | null;

  items: { name: string; isVeg: boolean; quantity: number; lineTotalPaise: number; addOns: string[] }[];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { orderId } = await params;

  // Ownership, not just authentication.
  const order = await getOrderForCustomer(orderId, session.user._id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campus = await getCampusById(order.campusId);
  const transitMinutes = campus?.settings.transitMinutes ?? 8;

  const arrival = estimatedArrival(order, transitMinutes);
  const deadline = campus ? gateDeadline(order, campus) : null;

  const body: OrderPollResponse = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    isTerminal: TERMINAL_STATUSES.includes(order.status),

    restaurantName: order.restaurantSnapshot.name,
    restaurantPhone: order.restaurantSnapshot.phone,
    zoneName: order.deliveryZoneSnapshot.name,
    zoneInstructions: order.deliveryZoneSnapshot.instructions,

    gateCode: revealGateCode(order.gateCode, order.status, "STUDENT"),
    estimatedArrival: arrival?.toISOString() ?? null,
    gateDeadline: deadline?.toISOString() ?? null,

    method: order.payment.method,
    onlinePaidPaise: order.payment.onlinePaidPaise,
    cashDueOnDeliveryPaise: order.payment.cashDueOnDeliveryPaise,
    refundablePaise: order.pricing.refundableAmountPaise,
    cancellationReason: order.cancellation?.reason ?? null,

    items: order.items.map((i) => ({
      name: i.name,
      isVeg: i.isVeg,
      quantity: i.quantity,
      lineTotalPaise: i.lineTotalPaise,
      addOns: i.addOns.map((a) => a.name),
    })),
  };

  return NextResponse.json(body, {
    headers: { "cache-control": "no-store, no-cache, must-revalidate" },
  });
}
