"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR, type IMenuCategory, type IMenuItem, type IRestaurant } from "@trefood/shared";

import { EmptyState, ErrorState, MoneyDisplay, Skeleton, VegMark } from "@/components/shared";
import { ItemSheet } from "@/components/student/item-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/hooks/use-cart";
import { getMenu, getRestaurant } from "@/lib/fixture-data";
import { cn } from "@/lib/utils";

interface PendingAdd {
  itemId: string;
  quantity: number;
  addOnIds: string[];
}

export default function MenuPage({
  params,
}: {
  params: Promise<{ campusSlug: string; restaurantSlug: string }>;
}) {
  const { restaurantSlug } = use(params);
  const router = useRouter();
  const { cart, itemCount, addItem, replaceCartWith } = useCart();

  const [restaurant, setRestaurant] = useState<IRestaurant | null>(null);
  const [menu, setMenu] = useState<{ categories: IMenuCategory[]; items: IMenuItem[] } | null>(
    null,
  );
  const [hasFailed, setHasFailed] = useState(false);
  const [openItem, setOpenItem] = useState<IMenuItem | null>(null);
  const [conflict, setConflict] = useState<PendingAdd | null>(null);

  useEffect(() => {
    let active = true;
    getRestaurant(restaurantSlug)
      .then(async (found) => {
        if (!active) return;
        setRestaurant(found);
        if (found !== null) setMenu(await getMenu(found._id));
      })
      .catch(() => active && setHasFailed(true));
    return () => {
      active = false;
    };
  }, [restaurantSlug]);

  function handleAdd(itemId: string, quantity: number, addOnIds: string[]) {
    if (restaurant === null) return;
    const input = {
      restaurantId: restaurant._id,
      restaurantSlug: restaurant.slug,
      restaurantName: restaurant.name,
      itemId,
      quantity,
      addOnIds,
    };
    // One restaurant per cart. A conflict is never resolved silently — discarding a
    // cart the student built is not a decision the app gets to make.
    if (addItem(input) === "conflict") setConflict({ itemId, quantity, addOnIds });
    setOpenItem(null);
  }

  if (hasFailed) {
    return (
      <main className="px-4 py-8">
        <ErrorState title="We could not load this menu" onRetry={() => window.location.reload()} />
      </main>
    );
  }

  if (restaurant === null || menu === null) {
    return (
      <main className="space-y-4 px-4 py-4" aria-busy="true" aria-label="Loading menu">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-16 w-full" />
        ))}
      </main>
    );
  }

  return (
    <main className="pb-24">
      <div className="space-y-1 border-b px-4 py-4">
        <h1 className="text-xl font-bold">{restaurant.name}</h1>
        <p className="text-muted-foreground text-sm">{restaurant.cuisine.join(", ")}</p>
        <p className="text-muted-foreground text-xs">
          {restaurant.defaultPrepMinutes} min · Min {formatINR(restaurant.minOrderPaise)} ·
          Packaging {formatINR(restaurant.packagingFeePaise)}
        </p>
        {!restaurant.isOpen ? (
          <p className="text-status-failed pt-1 text-sm font-medium">
            Closed right now — you can look, but not order.
          </p>
        ) : null}
      </div>

      {menu.items.length === 0 ? (
        <EmptyState title="No menu yet" description="This restaurant has not published a menu." />
      ) : (
        menu.categories.map((category) => {
          const items = menu.items.filter((item) => item.categoryId === category._id);
          if (items.length === 0) return null;

          return (
            <section key={category._id}>
              <h2 className="bg-muted/50 px-4 py-2 text-sm font-semibold">{category.name}</h2>
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item._id}>
                    <button
                      type="button"
                      disabled={!item.isAvailable || !restaurant.isOpen}
                      onClick={() => setOpenItem(item)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                        item.isAvailable && restaurant.isOpen
                          ? "hover:bg-accent"
                          : "cursor-default",
                      )}
                    >
                      <VegMark isVeg={item.isVeg} className="mt-1" />
                      <span className="min-w-0 flex-1">
                        {/**
                         * An unavailable item is STRUCK THROUGH and still listed.
                         * Hiding it would make a student wonder whether the dish
                         * exists at all; struck through says "it exists, and it is
                         * out today" — which is the true and more useful statement.
                         */}
                        <span
                          className={cn(
                            "block font-medium",
                            !item.isAvailable && "text-muted-foreground line-through",
                          )}
                        >
                          {item.name}
                        </span>
                        {item.description ? (
                          <span className="text-muted-foreground line-clamp-2 block text-xs">
                            {item.description}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-sm">
                          <MoneyDisplay amountPaise={item.pricePaise} />
                          {item.addOnGroups.length > 0 ? (
                            <span className="text-muted-foreground text-xs"> · customisable</span>
                          ) : null}
                        </span>
                      </span>
                      {!item.isAvailable ? (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          Out today
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {itemCount > 0 ? (
        <div className="bg-background fixed inset-x-0 bottom-14 z-30 mx-auto max-w-md border-t p-3">
          <Button className="touch-target w-full" onClick={() => router.push("/cart")}>
            View cart · {itemCount} {itemCount === 1 ? "item" : "items"}
          </Button>
        </div>
      ) : null}

      <ItemSheet item={openItem} onClose={() => setOpenItem(null)} onAdd={handleAdd} />

      <Dialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear cart and start over?</DialogTitle>
            <DialogDescription>
              Your cart has items from {cart.restaurantName}. One order goes to one
              restaurant, so adding this will empty your cart first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="touch-target" onClick={() => setConflict(null)}>
              Keep my cart
            </Button>
            <Button
              className="touch-target"
              onClick={() => {
                if (conflict !== null && restaurant !== null) {
                  replaceCartWith({
                    restaurantId: restaurant._id,
                    restaurantSlug: restaurant.slug,
                    restaurantName: restaurant.name,
                    ...conflict,
                  });
                }
                setConflict(null);
              }}
            >
              Clear and add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
