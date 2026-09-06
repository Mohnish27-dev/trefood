"use client";

import { ArrowDown, ArrowUp, Loader2, RotateCcw, SlidersVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { compareRestaurantsForDisplay } from "@/lib/restaurant-order";
import { saveRestaurantDisplayOrder } from "@/server/actions/admin";

export interface ReorderRestaurantItem {
  id: string;
  name: string;
  campusName: string;
  slug: string;
  displayOrder?: number | null | undefined;
  isOpen: boolean;
}

interface ReorderRestaurantsDialogProps {
  restaurants: ReorderRestaurantItem[];
}

export function ReorderRestaurantsDialog({ restaurants }: ReorderRestaurantsDialogProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReorderRestaurantItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize and sort items when dialog opens
  useEffect(() => {
    if (open) {
      const sorted = [...restaurants].sort(compareRestaurantsForDisplay);
      setItems(sorted);
    }
  }, [open, restaurants]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1]!;
      next[index - 1] = temp!;
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1]!;
      next[index + 1] = temp!;
      return next;
    });
  };

  const handleResetToDefault = () => {
    // Stripping displayOrder allows the default priority logic to sort:
    // Vrindavan -> Kolkata Biryani -> CSB -> Royal Bihar -> Sone Zone -> Mokila -> Rest
    const defaultSorted = [...items]
      .map((item) => ({ ...item, displayOrder: null }))
      .sort(compareRestaurantsForDisplay);
    setItems(defaultSorted);
    toast.info("Reset to campus default order. Click 'Save Order' to persist.");
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const orderedRestaurantIds = items.map((r) => r.id);
      const res = await saveRestaurantDisplayOrder({ orderedRestaurantIds });
      if (res.status === "ok") {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to save restaurant display order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <SlidersVertical className="size-3.5 text-saffron" />
          <span>Reorder Canteens</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Restaurant Display Order</DialogTitle>
          <DialogDescription>
            Arrange the order in which restaurants appear to students on the campus dashboard.
            The restaurant at position #1 appears at the very top.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
          {items.length === 0 ? (
            <p className="text-center text-sm text-muted py-6">No approved restaurants to reorder.</p>
          ) : (
            items.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-line bg-surface hover:border-saffron/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-raised border border-line text-xs font-bold text-bone tabular-nums">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-bone truncate">{item.name}</p>
                    <p className="text-xs text-muted truncate">{item.campusName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.isOpen ? (
                    <Badge tone="success" className="text-[10px] hidden sm:inline-flex">
                      Open
                    </Badge>
                  ) : (
                    <Badge tone="neutral" className="text-[10px] hidden sm:inline-flex">
                      Closed
                    </Badge>
                  )}

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === 0}
                      onClick={() => moveUp(index)}
                      title="Move Up"
                      aria-label={`Move ${item.name} up`}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === items.length - 1}
                      onClick={() => moveDown(index)}
                      title="Move Down"
                      aria-label={`Move ${item.name} down`}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </DialogBody>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-line/60 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToDefault}
            className="gap-1.5 text-xs text-muted hover:text-bone"
            disabled={isSubmitting || items.length === 0}
          >
            <RotateCcw className="size-3.5" />
            <span>Reset to default order</span>
          </Button>

          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSubmitting || items.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Order</span>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
