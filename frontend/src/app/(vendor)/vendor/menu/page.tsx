"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { menuCategories, menuItems, type IMenuItem } from "@trefood/shared";

import { MoneyDisplay, VegMark } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Menu management.
 *
 * The availability toggle is the control that matters most day to day — it is the
 * same 86 action as on the order board, reached from the other direction. Everything
 * else (prices, add-ons, photos) is edited occasionally; availability changes hourly.
 */
export default function VendorMenuPage() {
  // Fixtures are static, so a lazy initialiser is both correct and cheaper than
  // loading into state from an effect.
  const [items, setItems] = useState<IMenuItem[]>(() =>
    menuItems.filter((item) => item.restaurantId === "rest-nit-canteen"),
  );

  const categories = menuCategories.filter(
    (category) => category.restaurantId === "rest-nit-canteen",
  );

  function toggleAvailability(itemId: string) {
    setItems((current) =>
      current.map((item) =>
        item._id === itemId ? { ...item, isAvailable: !item.isAvailable } : item,
      ),
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <div>
        <h1 className="text-lg font-semibold">Menu</h1>
        <p className="text-muted-foreground text-sm">
          Switching an item off hides it from all new orders immediately, and asks
          anyone already waiting on it to choose a substitute.
        </p>
      </div>

      {categories.map((category) => (
        <section key={category._id} className="space-y-2">
          <h2 className="text-sm font-semibold">{category.name}</h2>

          <ul className="divide-y rounded-lg border">
            {items
              .filter((item) => item.categoryId === category._id)
              .map((item) => (
                <li key={item._id} className="flex items-center gap-3 p-3">
                  <VegMark isVeg={item.isVeg} />

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "font-medium",
                        !item.isAvailable && "text-muted-foreground line-through",
                      )}
                    >
                      {item.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      <MoneyDisplay amountPaise={item.pricePaise} />
                      {item.addOnGroups.length > 0
                        ? ` · ${item.addOnGroups.length} add-on group${item.addOnGroups.length === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="touch-target"
                    aria-label={`Change photo for ${item.name}`}
                  >
                    <ImagePlus className="size-4" aria-hidden />
                  </Button>

                  <Button
                    variant={item.isAvailable ? "outline" : "destructive"}
                    size="sm"
                    className="touch-target w-28"
                    onClick={() => toggleAvailability(item._id)}
                  >
                    {item.isAvailable ? "Available" : "Out of stock"}
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="space-y-2 rounded-lg border border-dashed p-4">
        <h2 className="text-sm font-medium">Add an item</h2>
        <div className="flex gap-2">
          <Input placeholder="Item name" className="touch-target" />
          <Input
            placeholder="Price ₹"
            type="number"
            inputMode="numeric"
            className="touch-target w-28"
          />
          <Button className="touch-target">Add</Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Photos upload to storage and the menu stores the link. Wired in Phase 7.
        </p>
      </section>
    </main>
  );
}
