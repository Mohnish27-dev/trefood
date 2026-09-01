"use client";

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
 * The gate code, revealed to the VENDOR at Mark Ready.
 *
 * This is the moment the whole handoff protocol turns on. Staff read these four
 * digits and write them on the packet in marker; the student compares them at the
 * gate and taps Confirm Received. No rider app, no rider phone, no rider account.
 *
 * The student CANNOT see this code yet — the API withholds it until AT_GATE. That
 * ordering is the anti-fraud property: a student with no code cannot confirm an order
 * that never arrived.
 *
 * Digits only, never letters, so there is no 0/O ambiguity in marker under a hostel
 * light (docs/FAILURES_AND_EDGE_CASES.md §5.2).
 */
export function GateCodeReveal({
  code,
  orderNumber,
  isOpen,
  onClose,
}: {
  code: string;
  orderNumber: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Write this on the packet</DialogTitle>
          <DialogDescription>
            {orderNumber} — the student checks these digits at the gate before taking
            the food.
          </DialogDescription>
        </DialogHeader>

        <p
          className="text-gate-code text-status-gate flex justify-center gap-4 py-4 tabular-nums"
          aria-label={code.split("").join(" ")}
        >
          {code.split("").map((digit, index) => (
            <span key={index}>{digit}</span>
          ))}
        </p>

        <p className="text-muted-foreground text-center text-xs">
          Write large and clearly. This is read outdoors, at night.
        </p>

        <DialogFooter>
          <Button className="touch-target w-full" onClick={onClose}>
            Written on the packet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
