import { NextResponse } from "next/server";

import * as db from "@/server/db/collections";
import { getSession } from "@/server/auth/session";
import { getCampusById } from "@/server/services/catalog";
import {
  disputeWindowOpen,
  estimatedArrival,
  gateDeadline,
  getOrderForCustomer,
  transitionOrder,
} from "@/server/services/orders";
import { revealGateCode } from "@/server/services/gate-code";
import { paymentProvider } from "@/server/services/payments";
import { ACTOR, ORDER_STATUS, PAYMENT_STATUS, TERMINAL_STATUSES, type OrderStatus, type PaymentMethod } from "@/lib/constants";

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

  /** Non-null once a refund has been raised, so the student can see where it is. */
  refund: { amountPaise: number; status: string } | null;

  /** F11 — the gate changed while the order was in flight. */
  reroutedFrom: string | null;

  /** Section 3 — the 30-minute reporting window is still open. */
  canDispute: boolean;

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

  // If still payment-pending, actively verify with gateway in case webhook was delayed
  const provider = paymentProvider();
  if (order.status === ORDER_STATUS.PAYMENT_PENDING && provider.checkStatus) {
    try {
      const check = await provider.checkStatus({ orderNumber: order.orderNumber });
      if (check.status === "SUCCESS") {
        await (await db.orders()).updateOne(
          { _id: order._id },
          {
            $set: {
              "payment.status": PAYMENT_STATUS.CAPTURED,
              "payment.providerPaymentId": check.paymentId ?? null,
              "payment.onlinePaidPaise": check.amountPaise ?? order.pricing.grandTotalPaise,
            },
          },
        );
        const promoted = await transitionOrder({
          orderId: order._id,
          to: ORDER_STATUS.PLACED,
          actor: ACTOR.WEBHOOK,
          actorId: null,
          reason: "Payment verified on status check during poll",
        });
        if (promoted.ok) {
          order.status = ORDER_STATUS.PLACED;
        }
      }
    } catch {
      // Non-blocking background check
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

    stockout: order.stockout
      ? {
          itemName: order.stockout.itemName,
          expiresAt: order.stockout.expiresAt.toISOString(),
          choice: order.stockout.choice,
          resolved: order.stockout.resolvedAt !== null,
        }
      : null,

    refund: order.refund
      ? { amountPaise: order.refund.amountPaise, status: order.refund.status }
      : null,

    reroutedFrom: order.reroutedFromZoneId,
    canDispute: disputeWindowOpen(order),

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
