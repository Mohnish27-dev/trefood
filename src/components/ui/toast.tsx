"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toasts, for confirmations that do not deserve a dialog.
 *
 * Never the only channel for anything that matters: a toast is missed by a
 * vendor looking at the fryer and by a student walking to a gate. Order state
 * always lands on the page itself; a toast only ever confirms an action the
 * person just took.
 */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!bg-surface-raised !border-line !text-bone !rounded-xl",
          description: "!text-muted",
          actionButton: "!bg-saffron !text-ink",
        },
      }}
    />
  );
}
