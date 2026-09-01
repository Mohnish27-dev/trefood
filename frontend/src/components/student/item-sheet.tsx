"use client";

import { useMemo, useState } from "react";
import { addPaise, formatINR, multiplyPaise, type IMenuItem } from "@trefood/shared";

import { MoneyDisplay, VegMark } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface ItemSheetProps {
  item: IMenuItem | null;
  onClose: () => void;
  onAdd: (itemId: string, quantity: number, addOnIds: string[]) => void;
}

/**
 * Item detail: add-on selection and quantity.
 *
 * Add-on group rules (`minSelect` / `maxSelect`) are enforced here so the student
 * cannot construct an invalid order — a required "choose a spice level" blocks the
 * add button until answered. The server enforces the same rules again at checkout,
 * because a client-supplied selection is untrusted like every other input.
 *
 * The running total is arithmetic on menu prices for DISPLAY only. It is not what
 * gets charged: the cart stores item IDs and quantities, and the server recomputes
 * every rupee from the database.
 */
export function ItemSheet({ item, onClose, onAdd }: ItemSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  function reset() {
    setQuantity(1);
    setSelected({});
  }

  const chosenIds = useMemo(() => Object.values(selected).flat(), [selected]);

  const unitPaise = useMemo(() => {
    if (item === null) return null;
    const addOnPrices = item.addOnGroups
      .flatMap((group) => group.options)
      .filter((option) => chosenIds.includes(option.addOnId))
      .map((option) => option.pricePaise);
    return addPaise(item.pricePaise, ...addOnPrices);
  }, [item, chosenIds]);

  /** Every required group must be satisfied before the item can be added. */
  const unsatisfiedGroup = item?.addOnGroups.find(
    (group) => (selected[group.groupId]?.length ?? 0) < group.minSelect,
  );

  function toggleMulti(groupId: string, addOnId: string, maxSelect: number) {
    setSelected((current) => {
      const existing = current[groupId] ?? [];
      if (existing.includes(addOnId)) {
        return { ...current, [groupId]: existing.filter((id) => id !== addOnId) };
      }
      // Silently ignoring a tap past the cap is confusing; the checkbox is disabled
      // instead, so this is only a safety net.
      if (existing.length >= maxSelect) return current;
      return { ...current, [groupId]: [...existing, addOnId] };
    });
  }

  return (
    <Sheet
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        {item === null ? null : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <VegMark isVeg={item.isVeg} />
                {item.name}
              </SheetTitle>
              {item.description ? (
                <SheetDescription>{item.description}</SheetDescription>
              ) : null}
            </SheetHeader>

            <div className="space-y-6 px-4 pb-4">
              {item.addOnGroups.map((group) => {
                const groupSelection = selected[group.groupId] ?? [];
                const isSingle = group.maxSelect === 1;
                const isRequired = group.minSelect > 0;

                return (
                  <fieldset key={group.groupId} className="space-y-2">
                    <legend className="flex w-full items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{group.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {isRequired
                          ? "Required"
                          : `Optional · up to ${group.maxSelect}`}
                      </span>
                    </legend>

                    {isSingle ? (
                      <RadioGroup
                        value={groupSelection[0] ?? ""}
                        onValueChange={(value) =>
                          setSelected((current) => ({ ...current, [group.groupId]: [value] }))
                        }
                        className="space-y-1"
                      >
                        {group.options.map((option) => (
                          <div
                            key={option.addOnId}
                            className="touch-target flex items-center gap-3"
                          >
                            <RadioGroupItem
                              id={option.addOnId}
                              value={option.addOnId}
                              disabled={!option.isAvailable}
                            />
                            <Label
                              htmlFor={option.addOnId}
                              className={cn(
                                "flex flex-1 justify-between gap-2 text-sm font-normal",
                                !option.isAvailable && "text-muted-foreground line-through",
                              )}
                            >
                              <span>{option.name}</span>
                              {option.pricePaise > 0 ? (
                                <span>+{formatINR(option.pricePaise)}</span>
                              ) : null}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <div className="space-y-1">
                        {group.options.map((option) => {
                          const isChecked = groupSelection.includes(option.addOnId);
                          const isAtCap =
                            !isChecked && groupSelection.length >= group.maxSelect;

                          return (
                            <div
                              key={option.addOnId}
                              className="touch-target flex items-center gap-3"
                            >
                              <Checkbox
                                id={option.addOnId}
                                checked={isChecked}
                                disabled={!option.isAvailable || isAtCap}
                                onCheckedChange={() =>
                                  toggleMulti(group.groupId, option.addOnId, group.maxSelect)
                                }
                              />
                              <Label
                                htmlFor={option.addOnId}
                                className={cn(
                                  "flex flex-1 justify-between gap-2 text-sm font-normal",
                                  !option.isAvailable && "text-muted-foreground line-through",
                                )}
                              >
                                <span>
                                  {option.name}
                                  {!option.isAvailable ? " · unavailable" : ""}
                                </span>
                                {option.pricePaise > 0 ? (
                                  <span>+{formatINR(option.pricePaise)}</span>
                                ) : null}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                );
              })}

              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Quantity</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="touch-target"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  >
                    −
                  </Button>
                  <span className="w-8 text-center tabular-nums" aria-live="polite">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="touch-target"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((current) => current + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-background sticky bottom-0 border-t p-4">
              <Button
                className="touch-target w-full"
                disabled={unsatisfiedGroup !== undefined}
                onClick={() => {
                  onAdd(item._id, quantity, chosenIds);
                  reset();
                }}
              >
                {unsatisfiedGroup !== undefined ? (
                  `Choose ${unsatisfiedGroup.name.toLowerCase()}`
                ) : (
                  <>
                    Add to cart ·{" "}
                    {unitPaise === null ? null : (
                      <MoneyDisplay amountPaise={multiplyPaise(unitPaise, quantity)} />
                    )}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
