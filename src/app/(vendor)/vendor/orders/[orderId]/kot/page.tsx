import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KotTicket } from "@/components/vendor/kot-ticket";
import { requireVendor } from "@/server/auth/session";
import { getOrder } from "@/server/services/orders";
import { getCampusById } from "@/server/services/catalog";
import { revealGateCode } from "@/server/services/gate-code";
import { campusClock } from "@/lib/campus-time";

export const metadata: Metadata = { title: "Kitchen ticket" };
export const dynamic = "force-dynamic";

/**
 * The KOT — kitchen order ticket.
 *
 * Printed on a 58 mm or 80 mm thermal roll, which is why this page is black on
 * white with no colour, no background image and no logo: thermal printers have
 * one ink and a page of grey costs paper and time.
 *
 * It carries the delivery zone and its handover instructions, not just the
 * food, because the person who reads this ticket is often the same person who
 * carries the packet — and "Ganga Boys, gate 1, ask for the warden's desk" is
 * the difference between a delivery and a phone call.
 */
export default async function KotPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { restaurantId } = await requireVendor();

  const order = await getOrder(orderId);
  // Ownership, not just role: a vendor must not be able to print another
  // restaurant's ticket by guessing an id.
  if (!order || order.restaurantId !== restaurantId) notFound();

  const campus = await getCampusById(order.campusId);
  const timezone = campus?.timezone ?? "Asia/Kolkata";

  return (
    <KotTicket
      order={{
        orderNumber: order.orderNumber,
        placedAtLabel: campusClock(order.timestamps.placedAt ?? order.timestamps.createdAt, timezone),
        customerName: order.customerSnapshot.name,
        customerPhone: order.customerSnapshot.phone,
        restaurantName: order.restaurantSnapshot.name,
        zoneName: order.deliveryZoneSnapshot.name,
        zoneInstructions: order.deliveryZoneSnapshot.instructions,
        prepMinutes: order.prepMinutes,
        method: order.payment.method,
        cashDueOnDeliveryPaise: order.payment.cashDueOnDeliveryPaise,
        // Redacted until READY, exactly as on the board. A ticket printed
        // while the food is still on the stove must not carry the code.
        gateCode: revealGateCode(order.gateCode, order.status, "VENDOR"),
        items: order.items.map((item) => ({
          name: item.name,
          isVeg: item.isVeg,
          quantity: item.quantity,
          addOns: item.addOns.map((addOn) => addOn.name),
        })),
      }}
    />
  );
}
