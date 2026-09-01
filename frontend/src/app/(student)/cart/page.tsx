"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR, type ICampus, type IMenuItem, type IRestaurant } from "@trefood/shared";

import { EmptyState, MoneyDisplay, Skeleton, VegMark } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/use-cart";
import { useDelivery } from "@/hooks/use-delivery-context";
import { buildCartPreview } from "@/lib/cart-preview";
import { getCampus, getMenu, getRestaurant } from "@/lib/fixture-data";

export default function CartPage() {
  const router = useRouter();
  const { cart, setQuantity, clear, isHydrated } = useCart();
  const { campusSlug } = useDelivery();

  const [restaurant, setRestaurant] = useState<IRestaurant | null>(null);
  const [items, setItems] = useState<IMenuItem[] | null>(null);
  const [campus, setCampus] = useState<ICampus | null>(null);

  useEffect(() => {
    if (cart.restaurantSlug === null || campusSlug === null) return;
    let active = true;
    void (async () => {
      const [found, loadedCampus] = await Promise.all([
        getRestaurant(cart.restaurantSlug ?? ""),
        getCampus(campusSlug),
      ]);
      if (!active) return;
      setRestaurant(found);
      setCampus(loadedCampus);
      if (found !== null) setItems((await getMenu(found._id)).items);
    })();
    return () => {
      active = false;
    };
  }, [cart.restaurantSlug, campusSlug]);

  if (!isHydrated) {
    return (
      <main className="space-y-3 px-4 py-4" aria-busy="true" aria-label="Loading cart">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-20 w-full" />
      </main>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <main className="px-4 py-8">
        <EmptyState
          title="Your cart is empty"
          description="Add something from a campus canteen and it will show up here."
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

  if (restaurant === null || items === null || campus === null) {
    return (
      <main className="space-y-3 px-4 py-4" aria-busy="true" aria-label="Loading cart">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  const preview = buildCartPreview(cart.lines, items, restaurant, campus, "ONLINE_100");
  if (preview === null) {
    return (
      <main className="px-4 py-8">
        <EmptyState title="Your cart is empty" />
      </main>
    );
  }

  return (
    <main className="space-y-4 px-4 py-4 pb-28">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-bold">{restaurant.name}</h1>
        <button
          type="button"
          onClick={clear}
          className="text-muted-foreground hover:text-destructive text-xs underline"
        >
          Clear cart
        </button>
      </div>

      <ul className="divide-y rounded-lg border">
        {preview.lines.map((line) => (
          <li key={line.lineId} className="flex items-start gap-3 p-3">
            <VegMark isVeg={line.item.isVeg} className="mt-1" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{line.item.name}</p>
              {line.addOnNames.length > 0 ? (
                <p className="text-muted-foreground text-xs">{line.addOnNames.join(", ")}</p>
              ) : null}
              <div className="mt-2 flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="touch-target size-8"
                  aria-label={`Decrease ${line.item.name}`}
                  onClick={() => setQuantity(line.lineId, line.quantity - 1)}
                >
                  −
                </Button>
                <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="touch-target size-8"
                  aria-label={`Increase ${line.item.name}`}
                  onClick={() => setQuantity(line.lineId, line.quantity + 1)}
                >
                  +
                </Button>
              </div>
            </div>
            <MoneyDisplay amountPaise={line.lineTotalPaise} className="shrink-0 font-medium" />
          </li>
        ))}
      </ul>

      <div className="space-y-2 rounded-lg border p-3 text-sm">
        <Row label="Item total" amount={preview.subtotalPaise} />
        <Row label="Packaging" amount={preview.packagingFeePaise} />
        <Row label="Delivery" amount={preview.deliveryFeePaise} />
        <Separator />
        <Row label="Subtotal" amount={preview.commissionBasePaise} bold />
        <p className="text-muted-foreground pt-1 text-xs">
          Payment charges are added at checkout, once you choose how to pay.
        </p>
      </div>

      {!preview.meetsMinimum ? (
        <p className="text-status-failed text-sm">
          Minimum order for {restaurant.name} is {formatINR(restaurant.minOrderPaise)}. Add{" "}
          {formatINR(
            (restaurant.minOrderPaise - preview.subtotalPaise) as typeof preview.subtotalPaise,
          )}{" "}
          more.
        </p>
      ) : null}

      <div className="bg-background fixed inset-x-0 bottom-14 z-30 mx-auto max-w-md border-t p-3">
        {preview.meetsMinimum && restaurant.isOpen ? (
          <Button className="touch-target w-full" render={<Link href="/checkout" />}>
            Go to checkout · <MoneyDisplay amountPaise={preview.commissionBasePaise} />
          </Button>
        ) : (
          <Button className="touch-target w-full" disabled>
            {restaurant.isOpen ? "Minimum order not met" : "Restaurant is closed"}
          </Button>
        )}
      </div>
    </main>
  );
}

function Row({
  label,
  amount,
  bold,
}: {
  label: string;
  amount: Parameters<typeof MoneyDisplay>[0]["amountPaise"];
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-2 ${bold === true ? "font-semibold" : ""}`}>
      <span className={bold === true ? "" : "text-muted-foreground"}>{label}</span>
      <MoneyDisplay amountPaise={amount} />
    </div>
  );
}
