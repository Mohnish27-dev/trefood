"use client";

import { Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/shared/money";
import { ConnectionBanner, EmptyState, ErrorState } from "@/components/shared/states";
import { NewOrderAlarm } from "./new-order-alarm";
import { VendorOrderCard } from "./order-card";
import { ORDER_STAGES, type OrderStage } from "./order-stages";
import { useVendorAlarm } from "@/context/vendor-alarm-context";
import { useVendorLanguage } from "@/context/vendor-language-context";
import type { VendorBoard } from "@/server/services/vendor";

export function OrderBoard({ initial, stage }: { initial: VendorBoard; stage: OrderStage }) {
  const { t } = useVendorLanguage();

  // The poll lives in the layout alongside the alarm, so it keeps running while
  // the vendor is on any other tab. This page just renders what it finds there.
  const { board: data, connectionLost, lastSyncedAt, error, refresh } = useVendorAlarm();

  const config = ORDER_STAGES[stage];
  const board = data ?? initial;
  const orders = board.orders.filter((o) => config.statuses.includes(o.status));

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
        {/* Shown on every stage: a vendor on "Preparing" still needs to know an
            order is ringing, and the banner takes them straight to it. */}
        <NewOrderAlarm linkToNewOrders={stage !== "new"} />

        <div className="ml-auto flex items-center gap-5 text-sm">
          <span className="text-muted">
            {board.todayOrderCount} {board.todayOrderCount === 1 ? t("orderToday") : t("ordersToday")}
          </span>
          <span className="text-muted">
            {t("yourShare")} <Money paise={board.todayGrossPaise} className="font-semibold text-bone" />
          </span>
        </div>
      </div>

      <section className="min-w-0">
        <div className="mb-2.5 flex items-center gap-2">
          <h1 className="font-display text-base font-semibold text-bone">{t(config.label)}</h1>
          <Badge tone={stage === "new" && orders.length > 0 ? "danger" : "neutral"}>
            {orders.length}
          </Badge>
        </div>

        {orders.length === 0 ? (
          stage === "new" && board.orders.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t("nothingCookingTitle")}
              description={t("nothingCookingDesc")}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-xs leading-relaxed text-faint">
              {t(config.hint)}
            </p>
          )
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => (
              <VendorOrderCard key={order.orderId} order={order} onChanged={refresh} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
