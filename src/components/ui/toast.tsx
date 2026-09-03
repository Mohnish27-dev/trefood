"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/shared/theme-provider";

/**
 * Toasts, for confirmations that do not deserve a dialog.
 *
 * Never the only channel for anything that matters: a toast is missed by a
 * vendor looking at the fryer and by a student walking to a gate. Order state
 * always lands on the page itself; a toast only ever confirms an action the
 * person just took.
 */
export function Toaster() {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
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
