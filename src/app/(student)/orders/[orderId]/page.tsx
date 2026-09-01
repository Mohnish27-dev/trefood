import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderTracker } from "@/components/student/order-tracker";
import { getSession } from "@/server/auth/session";
import { getCampusById } from "@/server/services/catalog";
import { estimatedArrival, gateDeadline, getOrderForCustomer } from "@/server/services/orders";
import { revealGateCode } from "@/server/services/gate-code";
import { TERMINAL_STATUSES } from "@/lib/constants";
import type { OrderPollResponse } from "@/app/api/orders/[orderId]/poll/route";

export const metadata: Metadata = { title: "Order status" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: PageProps<"/orders/[orderId]">) {
  const { orderId } = await params;

  const session = await getSession();
  if (!session) redirect("/");

  const order = await getOrderForCustomer(orderId, session.user._id);
  if (!order) notFound();

  const campus = await getCampusById(order.campusId);
  const transitMinutes = campus?.settings.transitMinutes ?? 8;
  const arrival = estimatedArrival(order, transitMinutes);
  const deadline = campus ? gateDeadline(order, campus) : null;

  // Server-rendered first paint, so the gate code is on screen before any
  // JavaScript runs. A student standing at a gate on hostel wifi should not
  // wait for a hydration round trip to see four digits.
  const initial: OrderPollResponse = {
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

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-line bg-ink/95 px-2 backdrop-blur-lg pt-safe">
        <Link
          href="/orders"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-raised hover:text-bone"
          aria-label="Back to orders"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-base font-semibold text-bone">Order status</h1>
      </header>

      <OrderTracker initial={initial} />
    </>
  );
}
