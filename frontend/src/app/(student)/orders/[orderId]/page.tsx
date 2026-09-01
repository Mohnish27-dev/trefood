"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Phone } from "lucide-react";
import {
  ORDER_STATUS_LABELS,
  POLL_INTERVALS_MS,
  TIMERS,
  isTrackingComplete,
  type IOrder,
} from "@trefood/shared";

import { ErrorState, MoneyDisplay, OrderTrackerSkeleton, StatusStepper } from "@/components/shared";
import { Countdown } from "@/components/student/countdown";
import { DisputeSheet } from "@/components/student/dispute-sheet";
import { GateScreen } from "@/components/student/gate-screen";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNow } from "@/hooks/use-now";
import { getOrder } from "@/lib/fixture-data";

/**
 * The order tracker.
 *
 * There is NO MAP and NO MOVING DOT, and there never will be. Riders are the
 * restaurant's own staff and many carry no smartphone, so nothing in the system can
 * emit a position (D4). What replaces it: a status stepper, an ETA computed from
 * `acceptedAt + prepMinutes + transitMinutes`, and the restaurant's phone number.
 *
 * Polling, not websockets — sockets die at a serverless timeout, and polling survives
 * a sleeping phone and hostel Wi-Fi. It stops at a tracking-complete status rather
 * than hammering a finished order for hours.
 */
export default function OrderTrackerPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<IOrder | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const now = useNow(1000);

  // The state update lives in the `.then` callback rather than after an `await`, so
  // it is unambiguously asynchronous — no state is written while the effect runs.
  const load = useCallback(() => {
    getOrder(orderId)
      .then(setOrder)
      .catch(() => setHasFailed(true));
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (order === null || isTrackingComplete(order.status)) return;
    const timer = setInterval(load, POLL_INTERVALS_MS.studentTracker);
    // Polling a hidden tab burns a student's mobile data for a screen nobody is
    // looking at. It resumes on the next visibility change.
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [order, load]);

  if (hasFailed) {
    return (
      <main className="px-4 py-8">
        <ErrorState title="We could not load this order" onRetry={load} />
      </main>
    );
  }

  if (order === null) {
    return (
      <main className="px-4 py-4">
        <OrderTrackerSkeleton />
      </main>
    );
  }

  const acceptedAt = order.timestamps.acceptedAt;
  const etaDeadline =
    acceptedAt === undefined || order.prepMinutes === undefined
      ? null
      : // ETA = acceptedAt + prepMinutes + campus transit. The only honest estimate
        // available without a rider device.
        new Date(new Date(acceptedAt).getTime() + (order.prepMinutes + 8) * 60_000);

  const deliveredAt = order.timestamps.deliveredAt;
  const disputeDeadline =
    deliveredAt === undefined
      ? null
      : new Date(new Date(deliveredAt).getTime() + TIMERS.disputeWindowSeconds * 1000);
  // `now` is 0 until mounted, so the window is treated as closed during SSR rather
  // than flashing a "report an issue" prompt that may already have expired.
  const isDisputeOpenWindow =
    disputeDeadline !== null && now > 0 && disputeDeadline.getTime() > now;

  return (
    <main className="space-y-5 px-4 py-4 pb-8">
      <div>
        <p className="text-muted-foreground text-xs">{order.orderNumber}</p>
        <h1 className="text-lg font-bold">{order.restaurantSnapshot.name}</h1>
        <p className="text-muted-foreground text-sm">{ORDER_STATUS_LABELS[order.status]}</p>
      </div>

      {order.status === "AT_GATE" ? (
        <GateScreen
          order={order}
          graceSeconds={TIMERS.gateGraceSeconds}
          onConfirm={() => {
            // Phase 10 fires the real AT_GATE -> DELIVERED transition through the FSM.
            setOrder({ ...order, status: "DELIVERED" });
          }}
        />
      ) : (
        <>
          <StatusStepper status={order.status} />

          {etaDeadline !== null && !isTrackingComplete(order.status) ? (
            <div className="rounded-lg border p-3 text-center">
              <p className="text-muted-foreground text-xs">Estimated arrival in</p>
              <p className="text-2xl font-bold">
                <Countdown deadline={etaDeadline} />
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                You will get a notification the moment it reaches the gate.
              </p>
            </div>
          ) : null}

          <Button
            variant="outline"
            className="touch-target w-full"
            render={<a href={`tel:${order.restaurantSnapshot.phone}`} />}
          >
            <Phone className="size-4" aria-hidden />
            Call {order.restaurantSnapshot.name}
          </Button>
        </>
      )}

      <section className="space-y-2 rounded-lg border p-3 text-sm">
        <h2 className="text-muted-foreground text-xs tracking-wide uppercase">
          Delivering to
        </h2>
        <p className="font-medium">{order.deliveryZoneSnapshot.name}</p>
        {order.deliveryZoneSnapshot.instructions ? (
          <p className="text-muted-foreground text-xs">
            {order.deliveryZoneSnapshot.instructions}
          </p>
        ) : null}
      </section>

      <section className="space-y-2 rounded-lg border p-3 text-sm">
        <h2 className="text-muted-foreground text-xs tracking-wide uppercase">Your order</h2>
        <ul className="space-y-1">
          {order.items.map((item) => (
            <li key={item.itemId} className="flex justify-between gap-2">
              <span>
                {item.quantity} × {item.name}
              </span>
              <MoneyDisplay amountPaise={item.lineTotalPaise} />
            </li>
          ))}
        </ul>
        <Separator />
        <div className="flex justify-between gap-2 font-semibold">
          <span>Total</span>
          <MoneyDisplay amountPaise={order.pricing.grandTotalPaise} />
        </div>
        {order.payment.method === "HYBRID_COD" ? (
          <div className="text-muted-foreground flex justify-between gap-2 text-xs">
            <span>Cash at the gate</span>
            <MoneyDisplay amountPaise={order.payment.cashDueOnDeliveryPaise} />
          </div>
        ) : null}
      </section>

      {isDisputeOpenWindow && disputeDeadline !== null ? (
        <section className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium">Something wrong with this order?</p>
          <p className="text-muted-foreground text-xs">
            You can report an issue for another{" "}
            <Countdown deadline={disputeDeadline} className="tabular-nums" />. A photo is
            required.
          </p>
          <Button
            variant="outline"
            className="touch-target w-full"
            onClick={() => setIsDisputeOpen(true)}
          >
            Report an issue
          </Button>
        </section>
      ) : null}

      <DisputeSheet
        order={order}
        isOpen={isDisputeOpen}
        onClose={() => setIsDisputeOpen(false)}
      />
    </main>
  );
}
