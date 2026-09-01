"use client";

import { TIMERS } from "@trefood/shared";

import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

/**
 * The acknowledgement countdown, drawn as a depleting ring.
 *
 * A ring rather than a number because a busy kitchen reads shape faster than digits.
 * The three thresholds match the F4 escalation exactly:
 *
 *   0:00–1:30  normal
 *   1:30–3:00  escalated (the chime gets louder too)
 *   3:00–4:00  amber, with "auto-cancel in 60s" spelled out
 *   4:00       EXPIRED_NO_ACK, full auto-refund, and a vendor-health strike
 */
export function CountdownRing({ placedAt }: { placedAt: string }) {
  const now = useNow(1000);
  if (now === 0) return <div className="size-12" aria-hidden />;

  const elapsedSeconds = Math.max(0, (now - new Date(placedAt).getTime()) / 1000);
  const total = TIMERS.vendorAckExpirySeconds;
  const remaining = Math.max(0, total - elapsedSeconds);

  const isWarning = elapsedSeconds >= TIMERS.vendorAckWarningSeconds;
  const isEscalated = elapsedSeconds >= TIMERS.vendorAckWarningSeconds / 2;

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, elapsedSeconds / total);

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative size-12">
        <svg viewBox="0 0 48 48" className="size-12 -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            strokeWidth="4"
            className="stroke-muted"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * progress}
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-linear",
              isWarning
                ? "stroke-status-cooking"
                : isEscalated
                  ? "stroke-status-gate"
                  : "stroke-brand",
            )}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums"
          aria-live="off"
        >
          {minutes}:{String(seconds).padStart(2, "0")}
        </span>
      </div>

      {isWarning ? (
        <span className="text-status-cooking text-[10px] font-semibold">
          auto-cancel in {Math.ceil(remaining)}s
        </span>
      ) : null}
    </div>
  );
}
