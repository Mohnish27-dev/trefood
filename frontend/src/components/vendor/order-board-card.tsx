"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Coins, Printer } from "lucide-react";
import { formatINR, type IOrder, type IOrderItem } from "@trefood/shared";

import { MoneyDisplay, VegMark } from "@/components/shared";
import { CountdownRing } from "@/components/vendor/countdown-ring";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BoardCardActions {
  onAccept: (order: IOrder) => void;
  onReject: (order: IOrder) => void;
  onMarkReady: (order: IOrder) => void;
  onDispatch: (order: IOrder) => void;
  onAtGate: (order: IOrder) => void;
  onEightySix: (order: IOrder, item: IOrderItem) => void;
  onCashCollected: (order: IOrder) => void;
  onPaymentRefused: (order: IOrder) => void;
}

/**
 * One order on the board.
 *
 * The card's job is to make the next action obvious at a glance, from two metres
 * away, to someone holding a hot pan. There is exactly one primary button per state.
 */
export function OrderBoardCard({
  order,
  actions,
}: {
  order: IOrder;
  actions: BoardCardActions;
}) {
  const [isFlashing] = useState(order.status === "PLACED");
  const isCod = order.payment.method === "HYBRID_COD";

  return (
    <article
      className={cn(
        "space-y-3 rounded-lg border bg-card p-3",
        // A new order flashes red until it is acknowledged — the second of the three
        // defences. Audio can be muted; a full-card flash cannot be missed.
        order.status === "PLACED" && isFlashing && "border-status-gate animate-pulse border-2",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">{order.orderNumber}</p>
          <p className="text-muted-foreground truncate text-xs">
            {order.deliveryZoneSnapshot.name}
          </p>
        </div>
        {order.status === "PLACED" && order.timestamps.placedAt !== undefined ? (
          <CountdownRing placedAt={order.timestamps.placedAt} />
        ) : null}
      </header>

      <ul className="space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.itemId} className="flex items-start gap-2">
            <VegMark isVeg={item.isVeg} className="mt-0.5" />
            <span className="flex-1">
              <span className="font-medium">{item.quantity}×</span> {item.name}
              {item.addOns.length > 0 ? (
                <span className="text-muted-foreground block text-xs">
                  {item.addOns.map((addOn) => addOn.name).join(", ")}
                </span>
              ) : null}
            </span>
            {/* One tap to 86 — reachable from the card, because that is where the
                cook discovers the paneer is finished. */}
            <button
              type="button"
              onClick={() => actions.onEightySix(order, item)}
              aria-label={`Mark ${item.name} out of stock`}
              className="text-muted-foreground hover:text-destructive shrink-0 p-1"
            >
              <Ban className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs">
        <span className="text-muted-foreground">
          {isCod ? "Cash on delivery" : "Prepaid"}
        </span>
        {isCod ? (
          <span className="font-semibold">
            Collect <MoneyDisplay amountPaise={order.payment.cashDueOnDeliveryPaise} />
          </span>
        ) : (
          <span className="text-muted-foreground">
            {formatINR(order.pricing.grandTotalPaise)} paid
          </span>
        )}
      </div>

      {order.status === "PLACED" ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="touch-target flex-1"
            onClick={() => actions.onReject(order)}
          >
            Reject
          </Button>
          <Button className="touch-target flex-[2]" onClick={() => actions.onAccept(order)}>
            Accept
          </Button>
        </div>
      ) : null}

      {order.status === "ACCEPTED" || order.status === "PREPARING" ? (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="touch-target w-full"
            render={<Link href={`/vendor/orders/${order._id}/kot`} target="_blank" />}
          >
            <Printer className="size-4" aria-hidden />
            Print KOT
          </Button>
          <Button className="touch-target w-full" onClick={() => actions.onMarkReady(order)}>
            Mark Ready
          </Button>
        </div>
      ) : null}

      {order.status === "READY" ? (
        <div className="space-y-2">
          {order.gateCode !== undefined ? (
            <p className="bg-muted rounded-md py-1 text-center text-lg font-bold tracking-widest tabular-nums">
              {order.gateCode}
            </p>
          ) : null}
          <Button className="touch-target w-full" onClick={() => actions.onDispatch(order)}>
            Rider dispatched
          </Button>
        </div>
      ) : null}

      {order.status === "OUT_FOR_DELIVERY" ? (
        /**
         * The most operationally critical button in the product.
         *
         * This single tap pings the student, reveals their copy of the gate code, and
         * starts the 15-minute grace timer. Nothing else in the system knows the rider
         * has arrived — there is no GPS to infer it from. Sized accordingly.
         */
        <Button
          className="touch-target h-14 w-full text-base font-bold"
          onClick={() => actions.onAtGate(order)}
        >
          Rider at gate
        </Button>
      ) : null}

      {order.status === "AT_GATE" ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-center text-xs">
            Waiting for the student to confirm. It closes itself after 15 minutes.
          </p>
          {isCod ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="touch-target flex-1"
                onClick={() => actions.onPaymentRefused(order)}
              >
                Refused payment
              </Button>
              <Button
                className="touch-target flex-1"
                onClick={() => actions.onCashCollected(order)}
              >
                <Coins className="size-4" aria-hidden />
                Cash collected
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
