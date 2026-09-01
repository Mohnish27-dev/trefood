"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A countdown ring.
 *
 * Used in two places, both of which are about a deadline somebody will miss:
 *   · the vendor board's 3:00 acknowledgement window (F4)
 *   · the student's 15-minute gate grace timer (A6)
 *
 * Colour escalates rather than staying constant, because a ring that looks the
 * same at 3:00 and at 0:20 communicates nothing.
 *
 * `remaining` is DERIVED from a ticking clock rather than stored, so a changed
 * `deadline` prop is reflected on the next frame with no effect-driven state
 * sync and no cascading render.
 */

/** One shared clock state, ticking once a second. */
function useSecondsRemaining(deadline: Date): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  return Math.max(0, Math.trunc((deadline.getTime() - now) / 1_000));
}

export function CountdownRing({
  deadline,
  totalSeconds,
  size = 56,
  label,
  onExpire,
}: {
  deadline: Date;
  totalSeconds: number;
  size?: number;
  label?: string;
  onExpire?: () => void;
}) {
  const remaining = useSecondsRemaining(deadline);
  const expired = remaining <= 0;

  useEffect(() => {
    if (expired) onExpire?.();
  }, [expired, onExpire]);

  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remaining / totalSeconds)) : 0;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Three bands, not a gradient: a vendor glancing at a tablet from two metres
  // away reads colour, not arc length.
  const tone = fraction > 0.5 ? "text-mint" : fraction > 0.2 ? "text-amber" : "text-chili";

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${label ?? "Time remaining"}: ${formatClock(remaining)}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="stroke-line"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cn("fill-none stroke-current transition-all duration-1000 ease-linear", tone)}
        />
      </svg>
      <span className={cn("absolute tabular text-xs font-semibold", tone)}>
        {formatClock(remaining)}
      </span>
    </div>
  );
}

/** The same countdown as plain text, for places a ring would be noise. */
export function CountdownText({
  deadline,
  className,
  expiredLabel = "0:00",
}: {
  deadline: Date;
  className?: string;
  expiredLabel?: string;
}) {
  const remaining = useSecondsRemaining(deadline);

  return (
    <span className={cn("tabular", className)}>
      {remaining <= 0 ? expiredLabel : formatClock(remaining)}
    </span>
  );
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.trunc(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
