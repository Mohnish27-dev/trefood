"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Clamped 5–60. Below 5 is not a kitchen; above 60 the student should not be waiting. */
const MIN_PREP = 5;
const MAX_PREP = 60;
const PRESETS = [15, 20, 30];

/**
 * Accept an order, with a prep time.
 *
 * The prep time is not a formality — it drives the student's ETA countdown AND the
 * curfew guard for every subsequent order. A vendor who says 15 and takes 40 causes a
 * gate to close on a rider. The three presets cover almost every real case; custom
 * exists for the exceptions.
 */
export function PrepTimePicker({
  isOpen,
  onClose,
  onAccept,
  defaultMinutes,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (minutes: number) => void;
  defaultMinutes: number;
}) {
  const [custom, setCustom] = useState("");
  const parsed = Number.parseInt(custom, 10);
  const isCustomValid =
    Number.isInteger(parsed) && parsed >= MIN_PREP && parsed <= MAX_PREP;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How long will this take?</DialogTitle>
          <DialogDescription>
            The student sees this as a countdown, and it decides whether their gate is
            still open on arrival. Be realistic.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((minutes) => (
            <Button
              key={minutes}
              variant={minutes === defaultMinutes ? "default" : "outline"}
              className={cn("touch-target h-16 flex-col gap-0 text-lg font-bold")}
              onClick={() => onAccept(minutes)}
            >
              {minutes}
              <span className="text-xs font-normal opacity-80">min</span>
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_PREP}
            max={MAX_PREP}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder={`Custom (${MIN_PREP}–${MAX_PREP} min)`}
            aria-label="Custom prep time in minutes"
            className="touch-target"
          />
          <Button
            className="touch-target"
            disabled={!isCustomValid}
            onClick={() => onAccept(parsed)}
          >
            Accept
          </Button>
        </div>

        {custom !== "" && !isCustomValid ? (
          <p className="text-status-failed text-xs">
            Enter a whole number between {MIN_PREP} and {MAX_PREP} minutes.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
