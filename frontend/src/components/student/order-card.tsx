import Link from "next/link";
import { ORDER_STATUS_LABELS, isTrackingComplete, type IOrder } from "@trefood/shared";

import { MoneyDisplay } from "@/components/shared";
import { cn } from "@/lib/utils";

const STATUS_TONE: Partial<Record<IOrder["status"], string>> = {
  AT_GATE: "text-status-gate",
  PREPARING: "text-status-cooking",
  READY: "text-status-ready",
  OUT_FOR_DELIVERY: "text-status-transit",
  DELIVERED: "text-status-done",
  SETTLED: "text-status-done",
  REJECTED_BY_VENDOR: "text-status-failed",
  EXPIRED_NO_ACK: "text-status-failed",
  CANCELLED_BY_ADMIN: "text-status-failed",
  NO_SHOW: "text-status-failed",
  PAYMENT_FAILED: "text-status-failed",
};

export function OrderCard({ order }: { order: IOrder }) {
  const isLive = !isTrackingComplete(order.status);

  return (
    <Link
      href={`/orders/${order._id}`}
      className={cn(
        "hover:bg-accent block rounded-lg border p-3 transition-colors",
        // A live order is the one thing the student came here for. Give it the border.
        isLive && "border-brand/50 bg-brand/5",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium">{order.restaurantSnapshot.name}</span>
        <MoneyDisplay amountPaise={order.pricing.grandTotalPaise} className="shrink-0 text-sm" />
      </div>

      <p className={cn("text-sm", STATUS_TONE[order.status] ?? "text-muted-foreground")}>
        {ORDER_STATUS_LABELS[order.status]}
        {order.status === "AT_GATE" ? " — collect now" : ""}
      </p>

      <p className="text-muted-foreground truncate text-xs">
        {order.orderNumber} · {order.items.length}{" "}
        {order.items.length === 1 ? "item" : "items"} · {order.deliveryZoneSnapshot.name}
      </p>
    </Link>
  );
}
