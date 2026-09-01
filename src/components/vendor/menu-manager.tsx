"use client";

import { AlertTriangle, Loader2, Search, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { VegMark } from "@/components/shared/veg-mark";
import { setItemAvailability, type AffectedOrder } from "@/server/actions/vendor";
import { cn } from "@/lib/utils";

export interface MenuManagerItem {
  itemId: string;
  name: string;
  description: string;
  isVeg: boolean;
  pricePaise: number;
  isAvailable: boolean;
  addOnGroupCount: number;
}

export interface MenuManagerSection {
  categoryId: string;
  categoryName: string;
  items: MenuManagerItem[];
}

/**
 * Menu management, built around one control.
 *
 * The 86 toggle is the only thing on this screen a vendor touches during
 * service, so it is a switch rather than a menu buried behind an edit form.
 * Flipping it does two separate things, and the UI has to make both visible:
 *
 *   (a) the item disappears from every future order, instantly
 *   (b) any order already in the kitchen containing it needs a decision from
 *       its student — which is F6, and is surfaced here as a list of the
 *       affected orders rather than a silent side effect
 *
 * Availability is a boolean, never a count. There is no "3 left" field to
 * type, because true stock counting means decrements, reservations and TTL
 * release on abandoned carts — machinery a canteen that cooks to order will
 * never keep accurate.
 */
export function MenuManager({ sections }: { sections: MenuManagerSection[] }) {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [available, setAvailable] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.flatMap((section) => section.items.map((item) => [item.itemId, item.isAvailable])),
    ),
  );
  const [affected, setAffected] = useState<{ itemName: string; orders: AffectedOrder[] } | null>(
    null,
  );

  const toggle = async (item: MenuManagerItem, next: boolean): Promise<void> => {
    setPending(item.itemId);
    setAvailable((prev) => ({ ...prev, [item.itemId]: next }));

    const result = await setItemAvailability({ itemId: item.itemId, isAvailable: next });
    setPending(null);

    if (result.status === "error") {
      setAvailable((prev) => ({ ...prev, [item.itemId]: !next }));
      toast.error(result.message);
      return;
    }

    toast.success(result.message ?? "Saved");

    if (result.affectedOrders && result.affectedOrders.length > 0) {
      setAffected({ itemName: item.name, orders: result.affectedOrders });
    }
  };

  const needle = query.trim().toLowerCase();
  const filtered = sections
    .map((section) => ({
      ...section,
      items:
        needle.length === 0
          ? section.items
          : section.items.filter((item) => item.name.toLowerCase().includes(needle)),
    }))
    .filter((section) => section.items.length > 0);

  const offCount = Object.values(available).filter((value) => !value).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an item"
            className="pl-9"
            aria-label="Find an item"
          />
        </div>
        {offCount > 0 ? (
          <Badge tone="warning">
            {offCount} item{offCount === 1 ? "" : "s"} off the menu
          </Badge>
        ) : (
          <Badge tone="success">Everything is on</Badge>
        )}
      </div>

      {/* F6 — the orders already cooking that contain what just ran out. */}
      {affected ? (
        <Card className="border-amber/40">
          <div className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-bone">
                {affected.orders.length} order{affected.orders.length === 1 ? "" : "s"} already
                contain {affected.itemName}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Open each one on the board and tap 86 on that line. The student then gets five
                minutes to swap it, drop it, or cancel — after which we drop it for them and
                refund that line.
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {affected.orders.map((order) => (
                  <li
                    key={order.orderId}
                    className="rounded-lg border border-line bg-surface-raised px-2.5 py-1 font-mono text-[11px] text-bone"
                  >
                    {order.orderNumber} · {order.customerName}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setAffected(null)}
                className="mt-3 min-h-11 text-xs text-muted hover:text-bone"
              >
                Dismiss
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={UtensilsCrossed}
            title={needle.length > 0 ? "Nothing matches that" : "No menu yet"}
            description={
              needle.length > 0
                ? "Try a shorter search, or clear it to see the whole menu."
                : "Your menu has not been published. Ask TREFOOD ops to load it and it will appear here."
            }
          />
        </Card>
      ) : (
        filtered.map((section) => (
          <section key={section.categoryId}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
              {section.categoryName}
            </h2>

            <Card className="divide-y divide-line">
              {section.items.map((item) => {
                const isOn = available[item.itemId] ?? item.isAvailable;
                return (
                  <div key={item.itemId} className="flex items-start gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "flex items-center gap-2 text-sm font-medium",
                          isOn ? "text-bone" : "text-faint line-through",
                        )}
                      >
                        <VegMark isVeg={item.isVeg} />
                        <span className="truncate">{item.name}</span>
                      </p>
                      {item.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <Money paise={item.pricePaise} className="font-semibold text-bone" />
                        {item.addOnGroupCount > 0 ? (
                          <span className="text-faint">
                            · {item.addOnGroupCount} add-on group
                            {item.addOnGroupCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          isOn ? "text-mint" : "text-chili",
                        )}
                      >
                        {pending === item.itemId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : isOn ? (
                          "On"
                        ) : (
                          "86"
                        )}
                      </span>
                      <Switch
                        checked={isOn}
                        disabled={pending === item.itemId}
                        onCheckedChange={(next) => void toggle(item, next)}
                        aria-label={`${item.name} ${isOn ? "is available" : "is out of stock"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
