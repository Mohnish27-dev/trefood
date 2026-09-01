import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status";
import { EmptyState } from "@/components/shared/states";
import { getSession } from "@/server/auth/session";
import { listOrdersForCustomer } from "@/server/services/orders";
import { TERMINAL_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Your orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();
  const orders = session ? await listOrdersForCustomer(session.user._id) : [];

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-14 items-center border-b border-line bg-ink/95 px-4 backdrop-blur-lg pt-safe">
        <h1 className="font-display text-base font-semibold text-bone">Your orders</h1>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No orders yet"
          description="Once you order, it shows up here — including anything still on its way to your gate."
          action={
            <Button asChild variant="secondary">
              <Link href="/">Browse restaurants</Link>
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
                      <span>{order.deliveryZoneSnapshot.name}</span>
                      <Money
                        paise={
                          order.payment.onlinePaidPaise + order.payment.cashDueOnDeliveryPaise
                        }
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
