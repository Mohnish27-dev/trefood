import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-surface border border-line rounded-2xl overflow-hidden",
        "transition-colors",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-4 pt-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3 className={cn("font-display text-base font-semibold text-bone", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("px-4 py-3 border-t border-line flex items-center gap-2", className)} {...props} />
  );
}
