"use client";

import { Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/shared/money";
import { ConnectionBanner, EmptyState, ErrorState } from "@/components/shared/states";
import { NewOrderAlarm } from "./new-order-alarm";
import { VendorOrderCard } from "./order-card";
import { usePoll } from "@/hooks/use-poll";
import { clientEnv } from "@/lib/env";
import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";
import type { VendorBoard } from "@/server/services/vendor";

/**
 * The live board.
 *
 * Four columns that mirror the physical kitchen: waiting on a decision, on the
 * stove, packed, and out the door. An order only ever moves rightward, and
 * every column has exactly one obvious next tap.
 *
 * Polling every five seconds, visibility-aware so a backgrounded tablet stops
 * burning query budget, and a connection banner after TWO consecutive failures
 * — never one, because a single dropped request on canteen wifi is normal and
 * a banner that cries wolf gets ignored.
 */

const COLUMNS: { key: string; label: string; statuses: readonly OrderStatus[]; hint: string }[] = [
  {
    key: "new",
    label: "New Orders",
    statuses: [ORDER_STATUS.PLACED],
    hint: "Accept or reject within 4 minutes",
  },
  {
    key: "active",
    label: "Active & In Progress",
    statuses: [
      ORDER_STATUS.ACCEPTED,
      ORDER_STATUS.PREPARING,
      ORDER_STATUS.READY,
      ORDER_STATUS.OUT_FOR_DELIVERY,
      ORDER_STATUS.AT_GATE,
    ],
    hint: "Write OTP on packet. Rider calls student upon arrival at gate.",
  },
];

export function OrderBoard({ initial }: { initial: VendorBoard }) {
  const { data, connectionLost, lastSyncedAt, error, refresh } = usePoll<VendorBoard>(
    async () => {
      const response = await fetch("/api/vendor/orders/poll", { cache: "no-store" });
      if (!response.ok) throw new Error(`Board poll failed: ${response.status}`);
      return (await response.json()) as VendorBoard;
    },
    { intervalMs: clientEnv.NEXT_PUBLIC_POLL_VENDOR_MS },
  );

  const board = data ?? initial;
  const newOrders = board.orders.filter((o) => o.status === ORDER_STATUS.PLACED);

  // Only a total failure with nothing on screen is worth an error state. A
  // failed poll on top of a known-good board is the connection banner's job —
  // replacing a live board with an error page would be the actual outage.
  if (error && data === null && board.orders.length === 0) {
    return (
      <ErrorState
        title="The board is not updating"
        description="We cannot reach TREFOOD right now. Orders already placed are safe; this screen just cannot see them."
        onRetry={refresh}
      />
    );
  }

  return (
    <>
      <ConnectionBanner visible={connectionLost} lastSyncedAt={lastSyncedAt} />

      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <NewOrderAlarm
          newOrderCount={newOrders.length}
          restaurantName={board.restaurant.name}
        />

        <div className="ml-auto flex items-center gap-5 text-sm">
          <span className="text-muted">
            {board.todayOrderCount} order{board.todayOrderCount === 1 ? "" : "s"} today
          </span>
          <span className="text-muted">
            Your share <Money paise={board.todayGrossPaise} className="font-semibold text-bone" />
          </span>
        </div>
      </div>

      {board.orders.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing cooking"
          description="New orders land here with a chime and a 4-minute countdown. Leave this screen open and the tablet awake."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {COLUMNS.map((column) => {
            const orders = board.orders.filter((o) => column.statuses.includes(o.status));

            return (
              <section key={column.key} className="min-w-0">
                <div className="mb-2.5 flex items-center gap-2">
                  <h2 className="font-display text-base font-semibold text-bone">{column.label}</h2>
                  <Badge tone={column.key === "new" && orders.length > 0 ? "danger" : "neutral"}>
                    {orders.length}
                  </Badge>
                </div>

                {orders.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-xs leading-relaxed text-faint">
                    {column.hint}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <VendorOrderCard key={order.orderId} order={order} onChanged={refresh} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
