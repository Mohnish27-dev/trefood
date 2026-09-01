"use client";

import { Camera, Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { reportProblem } from "@/server/actions/student-extra";
import { cn } from "@/lib/utils";

export interface DisputeReasonOption {
  value: string;
  label: string;
}

/**
 * Reporting a problem.
 *
 * Photo evidence is mandatory — no photo, no dispute. That is not bureaucracy:
 * thirty minutes after delivery the food is the only evidence anyone has, and
 * an admin ruling between a student and a canteen on two conflicting sentences
 * is a coin flip that eventually costs the platform both of them.
 *
 * The photo is downscaled in the browser before it is uploaded. A modern phone
 * camera produces four megabytes; a 1024px JPEG is under two hundred kilobytes
 * and shows a cold curry just as clearly. On hostel wifi at 1 AM that is the
 * difference between a report that sends and one that times out.
 */
export function DisputeForm({
  orderId,
  orderNumber,
  reasons,
}: {
  orderId: string;
  orderNumber: string;
  reasons: DisputeReasonOption[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [reason, setReason] = useState<string>(reasons[0]?.value ?? "OTHER");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<{ url: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhoto = async (file: File): Promise<void> => {
    setUploading(true);
    setError(null);

    try {
      const shrunk = await downscale(file);
      const body = new FormData();
      body.append("file", shrunk, "evidence.jpg");

      const response = await fetch("/api/uploads", { method: "POST", body });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        setError(payload.error ?? "That photo could not be attached.");
        return;
      }

      setPhotos((prev) => [...prev, { url: payload.url ?? "", preview: payload.url ?? "" }]);
    } catch {
      setError("That photo could not be read. Try taking it again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);

    const result = await reportProblem({
      orderId,
      reason,
      note,
      photoUrls: photos.map((photo) => photo.url),
    });

    if (result.status === "error") {
      setError(result.message);
      setSubmitting(false);
      return;
    }

    router.push(`/orders/${orderId}`);
    router.refresh();
  };

  const canSubmit = photos.length > 0 && !submitting && !uploading;

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <p className="font-mono text-[11px] tracking-wider text-faint">{orderNumber}</p>
        <h2 className="mt-1 font-display text-base font-semibold text-bone">
          What went wrong?
        </h2>

        <div className="mt-3 grid gap-2">
          {reasons.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setReason(option.value)}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl border px-3.5 text-left text-sm transition-colors",
                reason === option.value
                  ? "border-saffron bg-saffron-wash text-saffron"
                  : "border-line text-muted hover:text-bone",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  reason === option.value ? "border-saffron bg-saffron" : "border-line",
                )}
              >
                {reason === option.value ? <Check className="size-3 text-ink" /> : null}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      {/* ── Evidence ─────────────────────────────────────────────── */}
      <Card className="p-4">
        <Label>Photo — required</Label>
        <p className="-mt-0.5 mb-3 text-xs leading-relaxed text-muted">
          One clear picture of what arrived. Without it there is nothing for anyone to rule on,
          so we cannot take the report.
        </p>

        <div className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="relative size-24 overflow-hidden rounded-xl border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the stub
                  storage provider returns a data URL, which next/image rejects. */}
              <img src={photo.preview} alt={`Evidence ${index + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink/80 text-bone"
                aria-label={`Remove photo ${index + 1}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {photos.length < 3 ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className="flex size-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-faint hover:border-saffron/50 hover:text-saffron disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <Camera className="size-5" />
                  <span className="text-[10px]">Add photo</span>
                </>
              )}
            </button>
          ) : null}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void addPhoto(file);
          }}
        />
      </Card>

      <Card className="p-4">
        <Label htmlFor="dispute-note">Anything else? (optional)</Label>
        <Textarea
          id="dispute-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="The paneer roll had chicken in it."
          maxLength={500}
        />
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl border border-chili/30 bg-chili-wash px-3.5 py-3 text-sm text-chili">
          {error}
        </p>
      ) : null}

      <Button block size="lg" disabled={!canSubmit} onClick={() => void submit()}>
        {submitting ? <Loader2 className="animate-spin" /> : null}
        Send this report
      </Button>

      <p className="text-center text-xs leading-relaxed text-faint">
        A person reads every one of these. You will hear back on this order screen.
      </p>
    </div>
  );
}

/**
 * Shrink a camera photo to something a bad connection can actually send.
 *
 * 1024px on the long edge at 75% JPEG quality. Everything happens on a canvas
 * in the browser, so the original never leaves the phone and the upload is
 * predictable rather than whatever the camera happened to produce.
 */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1_024;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.trunc(bitmap.width * scale);
  const height = Math.trunc(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.75),
  );
  return blob ?? file;
}
