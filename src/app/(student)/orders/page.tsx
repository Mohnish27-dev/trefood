import { ClipboardList, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status";
import { EmptyState } from "@/components/shared/states";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getSession } from "@/server/auth/session";
import { listOrdersForCustomer } from "@/server/services/orders";
import { ORDER_STATUS, TERMINAL_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Your orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();
  const orders = session ? await listOrdersForCustomer(session.user._id) : [];

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-line bg-ink/95 px-4 backdrop-blur-lg pt-safe">
        <h1 className="font-display text-base font-semibold text-bone">Your orders</h1>
        <ThemeToggle />
      </header>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No orders yet"
          description="Once you order, it shows up here — including anything still on its way to your gate."
          action={
            <Button asChild variant="secondary">
              <Link href="/c/nit-patna">Browse restaurants</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3 p-4">
          {orders.map((order) => {
            const live = !TERMINAL_STATUSES.includes(order.status);
            return (
              <Link key={order._id} href={`/orders/${order._id}`} className="block group">
                <Card
                  className={
                    live
                      ? "border-saffron/30 group-hover:border-saffron/60"
                      : "group-hover:border-line-strong"
                  }
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] tracking-wider text-faint">
                          {order.orderNumber}
                        </p>
                        <p className="mt-0.5 truncate font-display text-sm font-semibold text-bone">
                          {order.restaurantSnapshot.name}
                        </p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    <p className="mt-2 truncate text-xs text-muted">
                      {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-xs text-muted">
                      <div className="flex items-center gap-2">
                        <span>{order.deliveryZoneSnapshot.name}</span>
                        {(order.status === ORDER_STATUS.DELIVERED ||
                          order.status === ORDER_STATUS.SETTLED) && (
                          order.feedback ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-saffron">
                              <Star className="size-3 fill-saffron" />
                              {order.feedback.rating}.0
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-saffron/30 bg-saffron-wash/20 px-2 py-0.5 text-[10px] font-medium text-saffron">
                              <Star className="size-2.5 text-saffron" />
                              Rate order
                            </span>
                          )
                        )}
                      </div>
                      <Money
                        paise={order.payment.cashDuePaise}
                        className="font-semibold text-bone"
                      />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
