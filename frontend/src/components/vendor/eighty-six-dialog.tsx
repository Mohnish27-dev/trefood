"use client";

import { AlertTriangle } from "lucide-react";
import type { IOrderItem } from "@trefood/shared";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The 86 confirmation.
 *
 * One tap, TWO consequences — and the dialog spells out both, because a vendor who
 * only expects the first will be surprised by the second in front of a customer:
 *
 *   (a) the item is hidden from every FUTURE order, instantly;
 *   (b) a resolution flow opens for every IN-FLIGHT order containing it, and those
 *       students get five minutes to choose a substitute, drop the line, or cancel.
 *
 * Availability is a BOOLEAN, never a count. True stock tracking would need
 * decrements, cart reservations and TTL release for a kitchen that cooks to order.
 */
export function EightySixDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: IOrderItem | null;
  onClose: () => void;
  onConfirm: (itemId: string) => void;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {item === null ? null : (
          <>
            <DialogHeader>
              <DialogTitle>Mark “{item.name}” out of stock?</DialogTitle>
              <DialogDescription>This takes effect immediately.</DialogDescription>
            </DialogHeader>

            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <AlertTriangle className="text-status-cooking mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  It disappears from the menu for <strong>all new orders</strong> until
                  you switch it back on.
                </span>
              </li>
              <li className="flex gap-2">
                <AlertTriangle className="text-status-cooking mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Every student with this item <strong>already cooking</strong> is asked
                  to swap it, drop it, or cancel. They have five minutes to choose.
                </span>
              </li>
            </ul>

            <DialogFooter>
              <Button variant="outline" className="touch-target" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="touch-target"
                onClick={() => onConfirm(item.itemId)}
              >
                Mark out of stock
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
