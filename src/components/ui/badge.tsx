import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-raised border-line text-muted",
        // Semantic colours are fixed across the whole product: mint is good,
        // chili is urgent, amber is closing, saffron is action.
        success: "bg-mint-wash border-mint/30 text-mint",
        danger: "bg-chili-wash border-chili/30 text-chili",
        warning: "bg-amber-wash border-amber/30 text-amber",
        accent: "bg-saffron-wash border-saffron/30 text-saffron",
        info: "bg-sky-wash border-sky/30 text-sky",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
