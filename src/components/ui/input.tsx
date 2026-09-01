import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        // h-12 keeps every field above the 44px floor, the same as Button.
        "flex h-12 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-bone",
        "placeholder:text-faint",
        "focus-visible:border-saffron focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-chili",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-bone",
        "placeholder:text-faint focus-visible:border-saffron focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("block text-xs font-medium uppercase tracking-wider text-muted mb-1.5", className)}
      {...props}
    />
  );
}
