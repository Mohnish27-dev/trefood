"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  isTrackingComplete,
  ordersByStatus,
  type IOrder,
} from "@trefood/shared";

import { MoneyDisplay } from "@/components/shared";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

/**
 * The live radar: every active order, across every campus.
 *
 * Its real job is not to list orders — it is to surface the ones that are STUCK, so a
 * human can intervene before a student notices. Two stall shapes matter:
 *
 *   F4  — PLACED with the ack window running out. The vendor is asleep or offline,
 *         and in seconds it auto-cancels and refunds.
 *   F18 — OUT_FOR_DELIVERY for more than twice the prep time with no "Rider at gate"
 *         tap. Nothing in the system can infer arrival, because there is no rider
 *         device, so a forgotten tap leaves the student waiting with no signal at all.
 *
 * Both are flagged loudly. An order that merely takes a while is not interesting.
 */
function stallReason(order: IOrder, now: number): string | null {
  if (now === 0) return null;

  if (order.status === "PLACED" && order.timestamps.placedAt !== undefined) {
    const seconds = (now - new Date(order.timestamps.placedAt).getTime()) / 1000;
    if (seconds > 180) return "No vendor response — auto-cancels within a minute";
  }

  if (order.status === "OUT_FOR_DELIVERY" && order.timestamps.dispatchedAt !== undefined) {
    const minutes = (now - new Date(order.timestamps.dispatchedAt).getTime()) / 60_000;
    const limit = (order.prepMinutes ?? 20) * 2;
    if (minutes > limit) return "Rider dispatched but never marked at gate";
  }

  return null;
}

export default function LiveRadarPage() {
  // 10s, matching the admin radar interval in the architecture doc.
  const now = useNow(10_000);

  const active = useMemo(
    () =>
      ORDER_STATUSES.map((status) => ordersByStatus[status]).filter(
        (order) => !isTrackingComplete(order.status) && order.status !== "PAYMENT_PENDING",
      ),
    [],
  );

  const stalled = active.filter((order) => stallReason(order, now) !== null);

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold">Live radar</h1>
          <p className="text-muted-foreground text-sm">
            {active.length} active · refreshes every 10 seconds
          </p>
        </div>
        {stalled.length > 0 ? (
          <p className="text-status-failed flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4" aria-hidden />
            {stalled.length} stuck
          </p>
        ) : null}
      </div>

      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-xs uppercase">
          <tr>
            <th className="py-2 text-start font-medium">Order</th>
            <th className="py-2 text-start font-medium">Restaurant</th>
            <th className="py-2 text-start font-medium">Gate</th>
            <th className="py-2 text-start font-medium">Status</th>
            <th className="py-2 text-start font-medium">Payment</th>
            <th className="py-2 text-end font-medium">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {active.map((order) => {
            const stall = stallReason(order, now);
            return (
              <tr key={order._id} className={cn(stall !== null && "bg-status-failed/5")}>
                <td className="py-2 font-mono text-xs">{order.orderNumber}</td>
                <td>{order.restaurantSnapshot.name}</td>
                <td className="text-muted-foreground">{order.deliveryZoneSnapshot.name}</td>
                <td>
                  <span className={cn(stall !== null && "text-status-failed font-medium")}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                  {stall !== null ? (
                    <span className="text-status-failed block text-xs">{stall}</span>
                  ) : null}
                </td>
                <td className="text-muted-foreground text-xs">
                  {order.payment.method === "HYBRID_COD" ? "COD" : "Prepaid"}
                </td>
                <td className="text-end">
                  <MoneyDisplay amountPaise={order.pricing.grandTotalPaise} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
