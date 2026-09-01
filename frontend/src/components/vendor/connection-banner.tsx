"use client";

import { WifiOff } from "lucide-react";

import { useNow } from "@/hooks/use-now";

/**
 * The connection-lost banner.
 *
 * Raised only after TWO consecutive failed polls: one failure is a blip, two in a row
 * means orders may be landing that nobody can see. That is a situation only the
 * vendor can fix, so it is stated plainly and given the whole width of the screen —
 * a quiet toast would be worse than nothing.
 */
export function ConnectionBanner({
  isDisconnected,
  lastSyncedAt,
}: {
  isDisconnected: boolean;
  lastSyncedAt: number | null;
}) {
  const now = useNow(5_000);
  if (!isDisconnected) return null;

  const secondsAgo =
    lastSyncedAt === null || now === 0 ? null : Math.floor((now - lastSyncedAt) / 1000);

  return (
    <div
      role="alert"
      className="bg-status-failed text-background flex items-center gap-3 px-4 py-3"
    >
      <WifiOff className="size-5 shrink-0" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">Connection lost — new orders are not arriving</p>
        <p className="opacity-90">
          Check the tablet&rsquo;s Wi-Fi.
          {secondsAgo === null ? "" : ` Last updated ${secondsAgo}s ago.`}
        </p>
      </div>
    </div>
  );
}
