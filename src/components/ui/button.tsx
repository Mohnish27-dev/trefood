import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * The 44x44px minimum touch target from PRD Part 2 is enforced HERE, by the
 * `size` variant, rather than left to whoever writes the next screen. Every
 * size below clears it. There is deliberately no "xs".
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl",
    "font-medium transition-all outline-none",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "active:scale-[0.98]",
  ],
  {
    variants: {
      variant: {
        // Saffron is action, and only action. If two saffron buttons appear on
        // one screen, one of them is wrong.
        primary:
          "bg-saffron text-ink font-semibold hover:bg-saffron-glow shadow-[0_2px_16px_-4px] shadow-saffron/50",
        secondary: "bg-surface-raised text-bone border border-line hover:bg-surface-hover",
        outline: "border border-line text-bone hover:bg-surface-raised",
        ghost: "text-muted hover:text-bone hover:bg-surface-raised",
        danger: "bg-chili text-white font-semibold hover:bg-chili/90",
        success: "bg-mint text-ink font-semibold hover:bg-mint/90",
        link: "text-saffron underline-offset-4 hover:underline",
      },
      size: {
        // 44px — the floor, never below.
        sm: "h-11 px-3 text-sm [&_svg]:size-4",
        md: "h-12 px-4 text-sm [&_svg]:size-4",
        lg: "h-14 px-6 text-base [&_svg]:size-5",
        // The gate confirm and the vendor accept. Read and tapped under stress.
        hero: "h-16 px-8 text-lg [&_svg]:size-6",
        icon: "size-11 [&_svg]:size-5",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
  );
}

export { buttonVariants };
