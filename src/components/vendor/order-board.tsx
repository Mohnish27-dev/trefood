"use client";

import { Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/shared/money";
import { ConnectionBanner, EmptyState, ErrorState } from "@/components/shared/states";
import { NewOrderAlarm } from "./new-order-alarm";
import { VendorOrderCard } from "./order-card";
import { usePoll } from "@/hooks/use-poll";
import { clientEnv } from "@/lib/env";
import { useVendorLanguage } from "@/context/vendor-language-context";
import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";
import type { VendorBoard } from "@/server/services/vendor";

export function OrderBoard({ initial }: { initial: VendorBoard }) {
  const { t } = useVendorLanguage();
  const { data, connectionLost, lastSyncedAt, error, refresh } = usePoll<VendorBoard>(
    async () => {
      const response = await fetch("/api/vendor/orders/poll", { cache: "no-store" });
      if (!response.ok) throw new Error(`Board poll failed: ${response.status}`);
      return (await response.json()) as VendorBoard;
    },
    { intervalMs: clientEnv.NEXT_PUBLIC_POLL_VENDOR_MS },
  );

  const columns: { key: string; label: string; statuses: readonly OrderStatus[]; hint: string }[] = [
    {
      key: "new",
      label: t("colNewOrders"),
      statuses: [ORDER_STATUS.PLACED],
      hint: t("hintNewOrders"),
    },
    {
      key: "preparing",
      label: t("colPreparing"),
      statuses: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY],
      hint: t("hintPreparing"),
    },
    {
      key: "on_the_way",
      label: t("colOnTheWay"),
      statuses: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.AT_GATE],
      hint: t("hintOnTheWay"),
    },
  ];

  const board = data ?? initial;
  const newOrders = board.orders.filter((o) => o.status === ORDER_STATUS.PLACED);

  // Only a total failure with nothing on screen is worth an error state. A
  // failed poll on top of a known-good board is the connection banner's job —
  // replacing a live board with an error page would be the actual outage.
  if (error && data === null && board.orders.length === 0) {
    return (
      <ErrorState
        title={t("boardNotUpdatingTitle")}
        description={t("boardNotUpdatingDesc")}
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
            {board.todayOrderCount} {board.todayOrderCount === 1 ? t("orderToday") : t("ordersToday")}
          </span>
          <span className="text-muted">
            {t("yourShare")} <Money paise={board.todayGrossPaise} className="font-semibold text-bone" />
          </span>
        </div>
      </div>

      {board.orders.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t("nothingCookingTitle")}
          description={t("nothingCookingDesc")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {columns.map((column) => {
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
