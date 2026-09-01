import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import {
  DemoPanel,
  type DemoOption,
  type DemoOrderRow,
} from "@/components/shared/demo-panel";
import { EmptyState } from "@/components/shared/states";
import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import { listAllCampuses } from "@/server/services/admin";
import { revealGateCode } from "@/server/services/gate-code";
import { ROLE, TERMINAL_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Simulation" };
export const dynamic = "force-dynamic";

/**
 * The simulation panel — PHASE_PLAN section 7.1.
 *
 * A vendor tap in one tab genuinely moves the student screen in another,
 * through the real state machine. That is what makes this a prototype rather
 * than a clickable mockup, and it is what a restaurant owner needs to see
 * before they will hand over their menu.
 *
 * Refused entirely outside a stub-auth development environment: the actions it
 * calls fire transitions without checking the caller holds the role, which is
 * fine in a demo and catastrophic anywhere else. `notFound()` rather than a
 * redirect, so the route does not even admit to existing in production.
 */
export default async function DemoPage() {
  const env = serverEnv();
  if (env.NODE_ENV === "production" || env.AUTH_PROVIDER !== "stub") notFound();

  const campuses = await listAllCampuses();
  const campus = campuses[0];

  if (!campus) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <Card>
          <EmptyState
            icon={Lock}
            title="Nothing seeded yet"
            description="Run `npm run seed` to create NIT Patna with its gates, restaurants and menus, then reload."
          />
        </Card>
      </main>
    );
  }

  const [restaurants, students, orders] = await Promise.all([
    (await db.restaurants()).find({ campusId: campus._id, isApproved: true }).toArray(),
    (await db.users()).find({ role: ROLE.STUDENT }).sort({ name: 1 }).toArray(),
    (await db.orders())
      .find({ idempotencyKey: { $regex: "^demo-" } })
      .sort({ "timestamps.createdAt": -1 })
      .limit(12)
      .toArray(),
  ]);

  const restaurantOptions: DemoOption[] = restaurants.map((restaurant) => ({
    id: restaurant._id,
    label: `${restaurant.name}${restaurant.isOpen ? "" : " (closed)"}`,
  }));

  const zoneOptions: DemoOption[] = campus.zones
    .filter((zone) => zone.isActive)
    .map((zone) => ({
      id: zone.id,
      label: `${zone.name}${zone.curfewMinutes === null ? " · 24×7" : ""}`,
    }));

  const studentOptions: DemoOption[] = students.map((student) => ({
    id: student._id,
    label: `${student.name}${student.codBlocked ? " · COD blocked" : ""}`,
  }));

  const orderRows: DemoOrderRow[] = orders
    .filter((order) => !TERMINAL_STATUSES.includes(order.status))
    .concat(orders.filter((order) => TERMINAL_STATUSES.includes(order.status)))
    .map((order) => ({
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      restaurantName: order.restaurantSnapshot.name,
      customerName: order.customerSnapshot.name,
      zoneName: order.deliveryZoneSnapshot.name,
      method: order.payment.method,
      grandTotalPaise: order.pricing.grandTotalPaise,
      cashDueOnDeliveryPaise: order.payment.cashDueOnDeliveryPaise,
      // The panel is an operator's view, so it sees what the vendor would see:
      // the code from READY onward, and never before there is a packet.
      gateCode: revealGateCode(order.gateCode, order.status, "VENDOR"),
      hasOpenStockout: order.stockout !== null && order.stockout.resolvedAt === null,
    }));

  return (
    <DemoPanel
      restaurants={restaurantOptions}
      zones={zoneOptions}
      students={studentOptions}
      orders={orderRows}
    />
  );
}
