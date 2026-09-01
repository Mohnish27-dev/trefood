"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Plain language, no error codes. "We could not load the menu." */
  title?: string;
  description?: string;
  /** Wiring a retry is what separates this from a dead end. */
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

/**
 * An error state that offers a way out.
 *
 * docs/MASTER_PROMPT_PRD.md Part 6 is explicit: "Loading, empty, and error states
 * exist. A spinner alone is not an error state." A student on hostel Wi-Fi will hit
 * this screen regularly, and the only useful thing it can do is let them try again.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "Check your connection and try again. Any order you have already placed is safe.",
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground max-w-xs text-sm text-balance">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" className="touch-target" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
      {action}
    </div>
  );
}
