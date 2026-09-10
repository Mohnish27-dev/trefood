"use client";

import { History, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status";
import { EmptyState } from "@/components/shared/states";
import { VegMark } from "@/components/shared/veg-mark";
import { useVendorLanguage } from "@/context/vendor-language-context";
import { cn } from "@/lib/utils";
import type { VendorOrderHistory } from "@/server/services/vendor-history";

export function VendorHistoryView({ history, timezone }: { history: VendorOrderHistory; timezone: string }) {
  const { t, language } = useVendorLanguage();
  const router = useRouter();
  const filters = [
    { value: "all", label: t("historyAll") },
    { value: "accepted", label: t("historyAccepted") },
    { value: "rejected", label: t("historyRejected") },
    { value: "completed", label: t("historyCompleted") },
  ];
  const pageUrl = (page: number) => `/vendor/past-orders?filter=${history.filter}&page=${page}`;
  const dateLabel = (date: string) => new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    timeZone: timezone, dateStyle: "medium", timeStyle: "short",
  }).format(new Date(date));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-bone">{t("navPastOrders")}</h1>
          <p className="mt-1 text-sm text-muted">{t("historyDescription")}</p>
        </div>
        <Button variant="outline" onClick={() => router.refresh()}>{language === "hi" ? "रिफ्रेश करें" : "Refresh"}</Button>
      </div>
      <nav aria-label={t("navPastOrders")} className="flex flex-wrap gap-2">
        {filters.map(filter => (
          <Link key={filter.value} href={`/vendor/past-orders?filter=${filter.value}`}
            aria-current={history.filter === filter.value ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium", history.filter === filter.value ? "border-saffron/40 bg-saffron-wash text-saffron" : "border-line text-muted hover:bg-surface-raised")}>
            {filter.label}
          </Link>
        ))}
      </nav>
      <p className="text-xs text-faint">{history.total} {t(history.total === 1 ? "historyReceivedOne" : "historyReceived")}</p>
      {history.orders.length === 0 ? (
        <Card><EmptyState icon={History} title={t("historyEmpty")} description={t("historyEmptyDescription")} /></Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {history.orders.map(order => (
            <Card key={order.id} className="overflow-hidden">
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-bone">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-faint">{dateLabel(order.createdAt)}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" />{order.customerName}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{order.zoneName}</span>
                </div>
                <p className="text-sm text-bone">{order.items.map(item => `${item.quantity}× ${item.name}`).join(", ")}</p>
                <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
                  <span className="text-muted">{t("historyTotal")}</span><Money paise={order.totalPaise} className="font-semibold text-bone" />
                </div>
                <details className="border-t border-line pt-2">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-saffron">{t("historyDetails")} <span className="ml-auto">+</span></summary>
                  <div className="space-y-3 pb-2">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <VegMark isVeg={item.isVeg} className="mt-1" />
                        <div className="flex-1 text-bone">{item.quantity}× {item.name}
                          {item.addOns.length > 0 ? <p className="text-xs text-muted">{item.addOns.join(", ")}</p> : null}
                        </div>
                        <Money paise={item.lineTotalPaise} className="text-muted" />
                      </div>
                    ))}
                    <div className="flex justify-between text-sm text-muted"><span>{t("historyCollected")}</span><Money paise={order.cashCollectedPaise} /></div>
                    {order.acceptedAt ? <p className="text-xs text-muted">{t("historyAccepted")}: {dateLabel(order.acceptedAt)}</p> : null}
                    {order.cancellationReason ? <p className="text-sm text-muted">{t("historyReason")}: {order.cancellationReason}</p> : null}
                    {order.isActive ? <Button asChild variant="outline" size="sm"><Link href="/vendor/orders">{t("historyLive")}</Link></Button> : null}
                  </div>
                </details>
              </div>
            </Card>
          ))}
        </div>
      )}
      {history.pageCount > 1 ? (
        <nav aria-label={t("historyPage")} className="flex flex-wrap items-center justify-between gap-3">
          {history.page > 1 ? <Button asChild variant="outline"><Link href={pageUrl(history.page - 1)}>{t("historyPrevious")}</Link></Button> : <span />}
          <span className="text-sm text-muted">{t("historyPage")} {history.page} {t("historyOf")} {history.pageCount}</span>
          {history.page < history.pageCount ? <Button asChild variant="outline"><Link href={pageUrl(history.page + 1)}>{t("historyNext")}</Link></Button> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
