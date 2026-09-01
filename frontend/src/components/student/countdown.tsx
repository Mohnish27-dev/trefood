"use client";

import { useNow } from "@/hooks/use-now";

/**
 * A live mm:ss countdown.
 *
 * Reads the shared clock store rather than holding its own interval, so several
 * countdowns on a screen tick together and none of them writes state from an effect.
 * Renders `--:--` until mounted, because a time computed during server rendering
 * would be stale the moment it was served.
 */
export function Countdown({
  deadline,
  className,
}: {
  deadline: Date;
  className?: string;
}) {
  const now = useNow(1000);
  if (now === 0) return <span className={className}>--:--</span>;

  const clamped = Math.max(0, deadline.getTime() - now);
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);

  return (
    <span className={className} aria-live="polite">
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
