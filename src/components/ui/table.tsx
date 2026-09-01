import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Admin tables.
 *
 * Wrapped in an overflow container by `Table` itself rather than by every call
 * site, because the settlement and audit tables are wider than a laptop and a
 * page that scrolls sideways is a page nobody can read.
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn("border-b border-line bg-surface-raised/60 text-left", className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-line", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-surface-raised/40", className)} {...props} />;
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-3 align-middle text-bone", className)} {...props} />;
}
