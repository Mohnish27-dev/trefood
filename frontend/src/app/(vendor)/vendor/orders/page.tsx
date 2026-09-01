"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Plus, VolumeX } from "lucide-react";
import {
  VENDOR_BOARD_COLUMNS,
  type IOrder,
  type IOrderItem,
  type OrderStatus,
} from "@trefood/shared";

import { EmptyState, Skeleton } from "@/components/shared";
import { ConnectionBanner } from "@/components/vendor/connection-banner";
import { EightySixDialog } from "@/components/vendor/eighty-six-dialog";
import { GateCodeReveal } from "@/components/vendor/gate-code-reveal";
import { OrderBoardCard, type BoardCardActions } from "@/components/vendor/order-board-card";
import { PrepTimePicker } from "@/components/vendor/prep-time-picker";
import { RejectDialog } from "@/components/vendor/reject-dialog";
import { Button } from "@/components/ui/button";
import { useBrowserNotification, useOrderAlarm } from "@/hooks/use-order-alarm";
import { useNow } from "@/hooks/use-now";
import { useVendorBoard } from "@/hooks/use-vendor-board";
import {
  applyTransition,
  eightySixItem,
  simulateIncomingOrder,
} from "@/lib/vendor-store";

/**
 * The live order board — the screen the business runs on.
 *
 * A missed order is lost revenue and a broken promise, so it is defended three ways
 * (docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §5):
 *
 *   1. a looping chime that stops only on interaction,
 *   2. a red flashing card with a depleting countdown ring,
 *   3. a browser notification that fires even when the tab is backgrounded.
 *
 * Any one of them can fail — sound is muted, the tab is hidden, notifications were
 * denied. All three failing at once is the case worth engineering against.
 */
export default function VendorBoardPage() {
  const { orders, refresh, isDisconnected, lastSyncedAt } = useVendorBoard();
  const now = useNow(1000);
  const notify = useBrowserNotification();

  const [acceptTarget, setAcceptTarget] = useState<IOrder | null>(null);
  const [rejectTarget, setRejectTarget] = useState<IOrder | null>(null);
  const [eightySixTarget, setEightySixTarget] = useState<
    { order: IOrder; item: IOrderItem } | null
  >(null);
  const [revealed, setRevealed] = useState<IOrder | null>(null);

  const newOrders = useMemo(
    () => (orders ?? []).filter((order) => order.status === "PLACED"),
    [orders],
  );

  /** Seconds since the OLDEST unacknowledged order — that is the one about to expire. */
  const oldestElapsedSeconds = useMemo(() => {
    if (newOrders.length === 0 || now === 0) return 0;
    const timestamps = newOrders
      .map((order) => order.timestamps.placedAt)
      .filter((value): value is string => value !== undefined)
      .map((value) => new Date(value).getTime());
    if (timestamps.length === 0) return 0;
    return (now - Math.min(...timestamps)) / 1000;
  }, [newOrders, now]);

  const alarm = useOrderAlarm({
    isActive: newOrders.length > 0,
    elapsedSeconds: oldestElapsedSeconds,
  });

  useEffect(() => {
    for (const order of newOrders) {
      notify(
        order._id,
        `New order · ${order.orderNumber}`,
        `${order.items.length} items for ${order.deliveryZoneSnapshot.name}`,
      );
    }
  }, [newOrders, notify]);

  const move = useCallback(
    async (orderId: string, to: OrderStatus, patch: Partial<IOrder> = {}) => {
      await applyTransition(orderId, to, patch);
      refresh();
    },
    [refresh],
  );

  const actions: BoardCardActions = {
    onAccept: setAcceptTarget,
    onReject: setRejectTarget,
    onMarkReady: (order) => {
      // Mark Ready generates and reveals the code. Phase 11 moves generation to the
      // server, where it is unrelated to the order number and never predictable.
      const gateCode = String(Math.floor(1000 + Math.random() * 9000));
      void move(order._id, "READY", { gateCode }).then(() =>
        setRevealed({ ...order, gateCode, status: "READY" }),
      );
    },
    onDispatch: (order) => void move(order._id, "OUT_FOR_DELIVERY"),
    onAtGate: (order) => void move(order._id, "AT_GATE"),
    onEightySix: (order, item) => setEightySixTarget({ order, item }),
    onCashCollected: (order) =>
      void move(order._id, "DELIVERED", {
        payment: { ...order.payment, cashCollected: true },
      }),
    onPaymentRefused: (order) => void move(order._id, "NO_SHOW"),
  };

  return (
    <main className="flex h-full flex-col">
      <ConnectionBanner isDisconnected={isDisconnected} lastSyncedAt={lastSyncedAt} />

      {/**
       * The autoplay wall, made visible.
       *
       * Browsers refuse to play sound until the page has been interacted with — so a
       * tablet left on the counter after a reload has a silently disarmed alarm. This
       * is the worst possible failure: everyone believes it is armed. One tap fixes
       * it, and the banner does not go away until it has been tapped.
       */}
      {alarm.isBlocked ? (
        <button
          type="button"
          onClick={alarm.enableSound}
          className="bg-status-cooking text-background flex w-full items-center gap-3 px-4 py-3 text-start"
        >
          <BellRing className="size-5 shrink-0" aria-hidden />
          <span className="text-sm">
            <span className="block font-semibold">Sound is off — tap to enable</span>
            <span className="opacity-90">
              Your browser blocks audio until you interact with the page. Until you tap,
              new orders will not make a sound.
            </span>
          </span>
        </button>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold">Orders</h1>
          {newOrders.length > 0 ? (
            <span className="bg-status-gate text-background rounded-full px-2 py-0.5 text-xs font-bold">
              {newOrders.length} new
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* Dev-only: the exit gate requires watching an order land and the alarm
              start. Without a trigger, none of that is demonstrable. */}
          <Button
            variant="outline"
            size="sm"
            className="touch-target"
            onClick={() => void simulateIncomingOrder().then(refresh)}
          >
            <Plus className="size-4" aria-hidden />
            Simulate order
          </Button>

          <Button
            variant={alarm.isMuted ? "destructive" : "ghost"}
            size="sm"
            className="touch-target"
            onClick={() => alarm.setIsMuted(!alarm.isMuted)}
          >
            <VolumeX className="size-4" aria-hidden />
            {alarm.isMuted ? "Muted" : "Mute"}
          </Button>
        </div>
      </div>

      {orders === null ? (
        <div className="grid flex-1 grid-cols-2 gap-3 p-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((column) => (
            <Skeleton key={column} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 items-start gap-3 overflow-x-auto p-3 lg:grid-cols-4">
          {VENDOR_BOARD_COLUMNS.map((column) => {
            const columnOrders = orders.filter((order) =>
              (column.statuses as readonly OrderStatus[]).includes(order.status),
            );

            return (
              <section key={column.key} className="min-w-56 space-y-2">
                <h2 className="text-muted-foreground sticky top-0 flex items-baseline justify-between text-xs font-semibold tracking-wide uppercase">
                  {column.label}
                  <span className="tabular-nums">{columnOrders.length}</span>
                </h2>

                {columnOrders.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
                    Nothing here
                  </p>
                ) : (
                  columnOrders.map((order) => (
                    <OrderBoardCard key={order._id} order={order} actions={actions} />
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}

      {orders !== null && orders.length === 0 ? (
        <EmptyState
          title="No live orders"
          description="New orders appear here the moment a student pays."
        />
      ) : null}

      <PrepTimePicker
        isOpen={acceptTarget !== null}
        defaultMinutes={20}
        onClose={() => setAcceptTarget(null)}
        onAccept={(minutes) => {
          if (acceptTarget !== null) {
            void move(acceptTarget._id, "PREPARING", { prepMinutes: minutes });
          }
          setAcceptTarget(null);
        }}
      />

      <RejectDialog
        isOpen={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onReject={(reason) => {
          if (rejectTarget !== null) {
            void move(rejectTarget._id, "REJECTED_BY_VENDOR", {
              cancellation: { reason, by: "VENDOR", at: new Date().toISOString() },
            });
          }
          setRejectTarget(null);
        }}
      />

      <EightySixDialog
        item={eightySixTarget?.item ?? null}
        onClose={() => setEightySixTarget(null)}
        onConfirm={(itemId) => {
          void eightySixItem(itemId).then(refresh);
          setEightySixTarget(null);
        }}
      />

      <GateCodeReveal
        isOpen={revealed !== null}
        code={revealed?.gateCode ?? ""}
        orderNumber={revealed?.orderNumber ?? ""}
        onClose={() => setRevealed(null)}
      />
    </main>
  );
}
