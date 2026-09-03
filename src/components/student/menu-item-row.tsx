"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { VegMark } from "@/components/shared/veg-mark";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/restaurant";

/**
 * One menu item.
 *
 * Unavailable items are STRUCK THROUGH, not hidden (ARCH section 4, step 3).
 * A student should see that the item exists and is out today — hiding it makes
 * them think the restaurant stopped selling it, and they stop looking.
 */
export function MenuItemRow({
  item,
  restaurantId,
  restaurantSlug,
  campusSlug,
  restaurantIsOpen,
}: {
  item: MenuItem;
  restaurantId: string;
  restaurantSlug: string;
  campusSlug: string;
  restaurantIsOpen: boolean;
}) {
  const { add, replaceWith } = useCart();
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string[] | null>(null);

  const hasChoices = item.addOnGroups.length > 0;
  const canOrder = item.isAvailable && restaurantIsOpen;

  const commit = (addOnOptionIds: string[]): void => {
    const result = add({
      restaurantId,
      restaurantSlug,
      campusSlug,
      itemId: item._id,
      addOnOptionIds,
    });

    if (!result.ok) {
      // One restaurant per cart, enforced hard. Never silently wipe the cart —
      // ask first (ARCH section 4, step 4).
      setPendingSelection(addOnOptionIds);
      setConflictOpen(true);
      return;
    }

    setSheetOpen(false);
    router.refresh();
  };

  const startOver = (): void => {
    replaceWith({
      restaurantId,
      restaurantSlug,
      campusSlug,
      lines: [
        {
          lineId: [item._id, ...(pendingSelection ?? []).slice().sort()].join("|"),
          itemId: item._id,
          quantity: 1,
          addOnOptionIds: pendingSelection ?? [],
        },
      ],
    });
    setConflictOpen(false);
    setSheetOpen(false);
    router.refresh();
  };

  return (
    <>
      <div
        className={cn(
          "flex items-start gap-3 py-4",
          !item.isAvailable && "opacity-50",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <VegMark isVeg={item.isVeg} />
            <h3
              className={cn(
                "text-sm font-medium text-bone",
                // The 86 state, made unmistakable.
                !item.isAvailable && "line-through decoration-chili/70 decoration-2",
              )}
            >
              {item.name}
            </h3>
            {item.isPopular && item.isAvailable ? (
              <span className="rounded bg-amber-wash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber">
                Popular
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm font-semibold text-bone">
            <Money paise={item.pricePaise} strike={!item.isAvailable} />
          </p>

          <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>

          {!item.isAvailable ? (
            <p className="mt-2 text-xs font-medium text-chili">Out of stock today</p>
          ) : hasChoices ? (
            <p className="mt-1.5 text-[11px] text-faint">Customisable</p>
          ) : null}
        </div>

        <div className="shrink-0 pt-1">
          {canOrder ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => (hasChoices ? setSheetOpen(true) : commit([]))}
              aria-label={`Add ${item.name}`}
            >
              <Plus />
              Add
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled>
              {item.isAvailable ? "Closed" : "Out"}
            </Button>
          )}
        </div>
      </div>

      {hasChoices ? (
        <AddOnSheet
          item={item}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onConfirm={commit}
        />
      ) : null}

      {/* One restaurant per cart. */}
      <Dialog.Root open={conflictOpen} onOpenChange={setConflictOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-deep/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-5">
            <Dialog.Title className="font-display text-base font-semibold text-bone">
              Start a new cart?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted">
              Your cart has items from another restaurant. An order can only come from one
              kitchen, so adding this will clear what is in there now.
            </Dialog.Description>
            <div className="mt-5 flex gap-2">
              <Dialog.Close asChild>
                <Button variant="secondary" block>
                  Keep my cart
                </Button>
              </Dialog.Close>
              <Button variant="danger" block onClick={startOver}>
                Clear and add
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Add-on sheet                                                        */
/* ------------------------------------------------------------------ */

function AddOnSheet({
  item,
  open,
  onOpenChange,
  onConfirm,
}: {
  item: MenuItem;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onConfirm: (optionIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (groupId: string, optionId: string, maxSelect: number): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      const group = item.addOnGroups.find((g) => g.id === groupId);
      if (!group) return next;

      if (next.has(optionId)) {
        next.delete(optionId);
        return next;
      }

      const chosenInGroup = group.options.filter((o) => next.has(o.id));
      // A single-select group behaves like a radio: picking a second option
      // replaces the first rather than silently refusing the tap.
      if (maxSelect === 1) for (const o of chosenInGroup) next.delete(o.id);
      else if (chosenInGroup.length >= maxSelect) return next;

      next.add(optionId);
      return next;
    });
  };

  // Required groups gate the confirm button, so an order can never reach the
  // kitchen missing a spice level or a portion size.
  const unmet = item.addOnGroups.filter(
    (g) => g.minSelect > 0 && g.options.filter((o) => selected.has(o.id)).length < g.minSelect,
  );

  const extrasPaise = item.addOnGroups
    .flatMap((g) => g.options)
    .filter((o) => selected.has(o.id))
    .reduce((sum, o) => sum + o.pricePaise, 0);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-deep/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] max-w-lg flex-col rounded-t-3xl border-t border-line bg-surface pb-safe">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-5">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-2 font-display text-lg font-semibold text-bone">
                <VegMark isVeg={item.isVeg} />
                {item.name}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                {item.description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-raised hover:text-bone"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {item.addOnGroups.map((group) => {
              const chosen = group.options.filter((o) => selected.has(o.id)).length;
              const required = group.minSelect > 0;

              return (
                <fieldset key={group.id} className="mb-6 last:mb-0">
                  <legend className="mb-2 flex w-full items-baseline justify-between">
                    <span className="text-sm font-semibold text-bone">{group.name}</span>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        required && chosen < group.minSelect ? "text-amber" : "text-faint",
                      )}
                    >
                      {required ? "Required" : `Optional · up to ${group.maxSelect}`}
                    </span>
                  </legend>

                  <div className="space-y-1">
                    {group.options.map((option) => {
                      const isSelected = selected.has(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={!option.isAvailable}
                          onClick={() => toggle(group.id, option.id, group.maxSelect)}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors",
                            isSelected ? "bg-saffron-wash" : "hover:bg-surface-raised",
                            !option.isAvailable && "opacity-40",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center border-2 transition-colors",
                              group.maxSelect === 1 ? "rounded-full" : "rounded-md",
                              isSelected ? "border-saffron bg-saffron" : "border-line",
                            )}
                          >
                            {isSelected ? <span className="size-2 rounded-full bg-ink" /> : null}
                          </span>

                          <span className="flex-1 text-sm text-bone">{option.name}</span>

                          {option.pricePaise > 0 ? (
                            <span className="text-sm text-muted">
                              + <Money paise={option.pricePaise} />
                            </span>
                          ) : (
                            <span className="text-xs text-faint">Free</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>

          <div className="border-t border-line px-5 py-4">
            <Button
              block
              size="lg"
              disabled={unmet.length > 0}
              onClick={() => onConfirm([...selected])}
            >
              {unmet.length > 0 ? (
                `Choose ${unmet[0]?.name.toLowerCase() ?? "an option"}`
              ) : (
                <>
                  Add to cart · <Money paise={item.pricePaise + extrasPaise} />
                </>
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
