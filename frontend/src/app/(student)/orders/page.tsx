"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isTrackingComplete, type IOrder } from "@trefood/shared";

import { EmptyState, ErrorState, Skeleton } from "@/components/shared";
import { OrderCard } from "@/components/student/order-card";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useDelivery } from "@/hooks/use-delivery-context";
import { getMenu, getRestaurant, listOrders } from "@/lib/fixture-data";

export default function OrderHistoryPage() {
  const router = useRouter();
  const { campusSlug } = useDelivery();
  const { replaceCartWith, addItem } = useCart();

  const [orders, setOrders] = useState<IOrder[] | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listOrders()
      .then((result) => active && setOrders(result))
      .catch(() => active && setHasFailed(true));
    return () => {
      active = false;
    };
  }, []);

  /**
   * One-tap reorder.
   *
   * Rebuilds the cart from the order's item IDs — never from its stored prices. A
   * six-month-old order holds a price snapshot that is deliberately frozen for
   * history; charging it again would bill last winter's rates. The current menu is
   * the source of truth, and anything since removed simply does not come back.
   */
  async function reorder(order: IOrder) {
    setReorderingId(order._id);
    try {
      const restaurant = await getRestaurant(
        order.restaurantSnapshot.name.toLowerCase().replace(/\s+/g, "-"),
      );
      if (restaurant === null) return;

      const { items } = await getMenu(restaurant._id);
      const available = order.items.filter((line) =>
        items.some((item) => item._id === line.itemId && item.isAvailable),
      );
      if (available.length === 0) return;

      const [first, ...rest] = available;
      if (first === undefined) return;

      const base = {
        restaurantId: restaurant._id,
        restaurantSlug: restaurant.slug,
        restaurantName: restaurant.name,
      };
      // Replace rather than merge: a reorder is a fresh intent, and silently mixing it
      // into an existing cart from another restaurant would trip the one-restaurant rule.
      replaceCartWith({ ...base, itemId: first.itemId, quantity: first.quantity, addOnIds: [] });
      for (const line of rest) {
        addItem({ ...base, itemId: line.itemId, quantity: line.quantity, addOnIds: [] });
      }
      router.push("/cart");
    } finally {
      setReorderingId(null);
    }
  }

  if (hasFailed) {
    return (
      <main className="px-4 py-8">
        <ErrorState title="We could not load your orders" onRetry={() => window.location.reload()} />
      </main>
    );
  }

  if (orders === null) {
    return (
      <main className="space-y-2 px-4 py-4" aria-busy="true" aria-label="Loading orders">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-20 w-full" />
        ))}
      </main>
    );
  }

  if (orders.length === 0) {
    return (
      <main className="px-4 py-8">
        <EmptyState
          title="No orders yet"
          description="Your orders will appear here once you place your first one."
          action={
            <Button
              className="touch-target"
              onClick={() => router.push(campusSlug === null ? "/" : `/c/${campusSlug}`)}
            >
              Browse restaurants
            </Button>
          }
        />
      </main>
    );
  }

  const live = orders.filter((order) => !isTrackingComplete(order.status));
  const past = orders.filter((order) => isTrackingComplete(order.status));

  return (
    <main className="space-y-6 px-4 py-4">
      {live.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Active</h2>
          <ul className="space-y-2">
            {live.map((order) => (
              <li key={order._id}>
                <OrderCard order={order} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Past orders</h2>
          <ul className="space-y-2">
            {past.map((order) => (
              <li key={order._id} className="space-y-1">
                <OrderCard order={order} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="touch-target w-full"
                  disabled={reorderingId === order._id}
                  onClick={() => void reorder(order)}
                >
                  {reorderingId === order._id ? "Adding…" : "Reorder"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
