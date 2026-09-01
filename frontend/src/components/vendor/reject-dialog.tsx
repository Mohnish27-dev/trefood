"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * A fixed list, not free text.
 *
 * Rejections are a vendor-health signal, and a signal you cannot count is not a
 * signal. Fixed reasons let admin see "out of stock" spiking at one canteen; a text
 * box would produce four hundred unique spellings of the same three problems.
 */
const REASONS = [
  { id: "OUT_OF_STOCK", label: "Out of stock", hint: "We cannot make this right now." },
  { id: "TOO_BUSY", label: "Kitchen is overloaded", hint: "Consider raising your prep time instead." },
  { id: "CLOSING", label: "Closing / closed", hint: "Consider switching yourself offline." },
  { id: "EQUIPMENT", label: "Equipment or power failure", hint: "" },
  { id: "OTHER", label: "Something else", hint: "" },
] as const;

export function RejectDialog({
  isOpen,
  onClose,
  onReject,
}: {
  isOpen: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const selected = REASONS.find((option) => option.id === reason);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this order?</DialogTitle>
          <DialogDescription>
            The student is refunded in full and told immediately. Repeated rejections
            are reviewed, and the gateway fee is charged back to you.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason ?? ""}
          onValueChange={setReason}
          className="space-y-1"
        >
          {REASONS.map((option) => (
            <div key={option.id} className="touch-target flex items-center gap-3">
              <RadioGroupItem id={option.id} value={option.id} />
              <Label htmlFor={option.id} className="flex-1 text-sm font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {/* Nudges toward the two release valves, which are almost always better than
            rejecting: a longer prep time, or going offline for twenty minutes. */}
        {selected !== undefined && selected.hint !== "" ? (
          <p className="text-muted-foreground text-xs">{selected.hint}</p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" className="touch-target" onClick={onClose}>
            Keep the order
          </Button>
          <Button
            variant="destructive"
            className="touch-target"
            disabled={reason === null}
            onClick={() => reason !== null && onReject(reason)}
          >
            Reject and refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
