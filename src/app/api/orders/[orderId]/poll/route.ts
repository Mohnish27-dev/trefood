import { NextResponse } from "next/server";

import { getSession } from "@/server/auth/session";
import { getCampusById } from "@/server/services/catalog";
import { ORDER_STATUS, TERMINAL_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/constants";
import { estimatedArrival, gateDeadline, getOrderForCustomer } from "@/server/services/orders";
import { revealGateCode } from "@/server/services/gate-code";
import { expireUnackedOrders } from "@/server/services/sweeps";

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
  serverTime: string;
  cancelUntil: string | null;
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

  /** What the student must hand over in cash at the gate. */
  cashDuePaise: number;
  /** DUE until the packet changes hands, then COLLECTED. */
  paymentStatus: PaymentStatus;
  cancellationReason: string | null;

  /**
   * F6 — an item ran out mid-cook and the student has five minutes to choose.
   * Non-null means the tracker must show a BLOCKING screen: this is the one
   * moment the app genuinely needs an answer before anything else can happen.
   */
  stockout: {
    itemName: string;
    expiresAt: string;
    choice: string | null;
    resolved: boolean;
  } | null;

  /** F11 — the gate changed while the order was in flight. */
  reroutedFrom: string | null;

  items: {
    name: string;
    isVeg: boolean;
    quantity: number;
    lineTotalPaise: number;
    /** Packing for the whole line (per-unit fee x quantity), as frozen at checkout. */
    linePackingFeePaise: number;
    addOns: string[];
  }[];

  /** The bill as frozen at checkout. `cashDuePaise` may sit below it after a stockout. */
  bill: {
    subtotalPaise: number;
    packagingFeePaise: number;
    discountPaise: number;
    grandTotalPaise: number;
  };

  feedback: {
    rating: number;
    comment: string | null;
    tags?: string[];
    createdAt: string;
  } | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { orderId } = await params;

  // Ownership, not just authentication.
  let order = await getOrderForCustomer(orderId, session.user._id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // F4 — the student staring at "Waiting for the restaurant to accept" is the
  // person this deadline exists for, so their own poll enforces it rather than
  // leaving them watching a dead screen until a scheduled job wakes up. Scoped
  // to this one order and skipped entirely unless it is still unacknowledged.
  if (order.status === ORDER_STATUS.PLACED) {
    const report = await expireUnackedOrders(new Date(), { orderId: order._id });
    if (report.acted > 0) {
      const refreshed = await getOrderForCustomer(orderId, session.user._id);
      if (refreshed) order = refreshed;
    }
  }

  const campus = await getCampusById(order.campusId);
  const transitMinutes = campus?.settings.transitMinutes ?? 8;

  const arrival = estimatedArrival(order, transitMinutes);
  const deadline = campus ? gateDeadline(order, campus) : null;

  const body: OrderPollResponse = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    serverTime: new Date().toISOString(),
    cancelUntil: order.cancelUntil?.toISOString() ?? null,
    isTerminal: TERMINAL_STATUSES.includes(order.status),

    restaurantName: order.restaurantSnapshot.name,
    restaurantPhone: order.restaurantSnapshot.phone,
    zoneName: order.deliveryZoneSnapshot.name,
    zoneInstructions: order.deliveryZoneSnapshot.instructions,

    gateCode: revealGateCode(order.gateCode, order.status, "STUDENT"),
    estimatedArrival: arrival?.toISOString() ?? null,
    gateDeadline: deadline?.toISOString() ?? null,

    cashDuePaise: order.payment.cashDuePaise,
    paymentStatus: order.payment.status,
    cancellationReason: order.cancellation?.reason ?? null,

    stockout: order.stockout
      ? {
          itemName: order.stockout.itemName,
          expiresAt: order.stockout.expiresAt.toISOString(),
          choice: order.stockout.choice,
          resolved: order.stockout.resolvedAt !== null,
        }
      : null,

    reroutedFrom: order.reroutedFromZoneId,

    items: order.items.map((i) => ({
      name: i.name,
      isVeg: i.isVeg,
      quantity: i.quantity,
      lineTotalPaise: i.lineTotalPaise,
      linePackingFeePaise: (i.packingFeePaise ?? 0) * i.quantity,
      addOns: i.addOns.map((a) => a.name),
    })),

    bill: {
      subtotalPaise: order.pricing.subtotalPaise,
      packagingFeePaise: order.pricing.packagingFeePaise,
      discountPaise: order.pricing.discountPaise,
      grandTotalPaise: order.pricing.grandTotalPaise,
    },

    feedback: order.feedback
      ? {
          rating: order.feedback.rating,
          comment: order.feedback.comment ?? null,
          tags: order.feedback.tags ?? [],
          createdAt:
            order.feedback.createdAt instanceof Date
              ? order.feedback.createdAt.toISOString()
              : new Date(order.feedback.createdAt).toISOString(),
        }
      : null,
  };

  return NextResponse.json(body, {
    headers: { "cache-control": "no-store, no-cache, must-revalidate" },
  });
}
