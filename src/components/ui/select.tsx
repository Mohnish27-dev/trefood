import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * A styled native `<select>`, deliberately.
 *
 * The alternative is a portalled listbox, which on Android renders a
 * scroll-trapping popover that a vendor with wet hands fights with. The native
 * control gets the OS picker — bigger targets, familiar gestures, works when
 * JavaScript is still hydrating. The chevron is ours; everything else is the
 * platform's.
 */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-12 w-full appearance-none rounded-xl border border-line bg-surface px-3.5 pr-10 text-sm text-bone",
          "focus-visible:border-saffron focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
    </div>
  );
}
