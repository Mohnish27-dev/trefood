"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { DISPUTE_REASONS, type DisputeReason, type IOrder } from "@trefood/shared";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const REASON_LABELS: Record<DisputeReason, string> = {
  WRONG_ITEM: "I got the wrong item",
  MISSING_ITEM: "Something was missing",
  SPILLED_OR_COLD: "Food was spilled or cold",
  NEVER_DELIVERED: "I never received this order",
  OTHER: "Something else",
};

/**
 * Raise a dispute, inside the 30-minute window after delivery.
 *
 * A PHOTO IS MANDATORY — no photo, no dispute. That is not bureaucracy: the window is
 * short precisely so the food is still evidence, and an admin ruling on a refund with
 * nothing to look at is guessing. The submit button stays disabled until at least one
 * photo is attached.
 *
 * These go to a human queue, not an algorithm. At campus volume a person is faster,
 * cheaper and fairer than the logic automating it would need to be.
 */
export function DisputeSheet({
  order,
  isOpen,
  onClose,
}: {
  order: IOrder;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const canSubmit = reason !== null && photos.length > 0;

  function addPhotos(files: FileList | null) {
    if (files === null) return;
    setPhotos((current) => [
      ...current,
      ...Array.from(files).map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    ]);
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Report an issue</SheetTitle>
          <SheetDescription>
            {order.orderNumber} · {order.restaurantSnapshot.name}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">What went wrong?</legend>
            <RadioGroup
              value={reason ?? ""}
              onValueChange={(value) => setReason(value as DisputeReason)}
              className="space-y-1"
            >
              {DISPUTE_REASONS.map((option) => (
                <div key={option} className="touch-target flex items-center gap-3">
                  <RadioGroupItem id={option} value={option} />
                  <Label htmlFor={option} className="flex-1 text-sm font-normal">
                    {REASON_LABELS[option]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="dispute-note" className="text-sm font-medium">
              Anything to add? <span className="text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="dispute-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Tell us what happened."
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Photo <span className="text-status-failed">required</span>
            </p>
            <p className="text-muted-foreground text-xs">
              A photo is what lets us rule on this quickly. Without one we cannot review
              the order.
            </p>

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              // Opens the camera directly on a phone, rather than the gallery — the
              // food is in front of them right now.
              capture="environment"
              multiple
              hidden
              onChange={(event) => addPhotos(event.target.files)}
            />

            <div className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={photo.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={`Evidence ${index + 1}`}
                    className="size-20 rounded-md border object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Remove photo ${index + 1}`}
                    onClick={() =>
                      setPhotos((current) => current.filter((p) => p.url !== photo.url))
                    }
                    className="bg-background absolute -end-2 -top-2 rounded-full border p-1"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="text-muted-foreground hover:border-brand hover:text-brand flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-[10px]"
              >
                <Camera className="size-5" aria-hidden />
                Add photo
              </button>
            </div>
          </div>
        </div>

        <div className="bg-background sticky bottom-0 border-t p-4">
          <Button className="touch-target w-full" disabled={!canSubmit}>
            {photos.length === 0 ? "Add a photo to continue" : "Submit for review"}
          </Button>
          <p className="text-muted-foreground mt-2 text-center text-[10px]">
            Disputes are reviewed by a person. Refunds arrive in Phase 5.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
