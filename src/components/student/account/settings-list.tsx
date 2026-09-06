import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The grouped list that the account screen is made of.
 *
 * One shape, used five times, so a new row is a data change rather than a new
 * layout. Every row clears the 44px floor from PRD Part 2 (`min-h-14`), and
 * the chevron is decorative — the whole row is the target, because a 16px
 * arrow is not something you hit walking to a gate at 1 AM.
 */

export function SettingsGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title ? (
        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          {title}
        </h2>
      ) : null}
      <Card className="divide-y divide-line">{children}</Card>
    </section>
  );
}

export interface SettingsRowProps {
  href: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  /** Right-aligned status: a count, a state word, a <Badge>. */
  trailing?: ReactNode;
  /** Tints the icon tile. Saffron is action; keep it for one row per group at most. */
  tone?: "neutral" | "saffron" | "mint" | "chili" | "amber" | "sky";
}

const TONE_TILE: Record<NonNullable<SettingsRowProps["tone"]>, string> = {
  neutral: "bg-surface-raised border-line text-muted",
  saffron: "bg-saffron-wash border-saffron/25 text-saffron",
  mint: "bg-mint-wash border-mint/25 text-mint",
  chili: "bg-chili-wash border-chili/25 text-chili",
  amber: "bg-amber-wash border-amber/25 text-amber",
  sky: "bg-sky-wash border-sky/25 text-sky",
};

export function SettingsRow({
  href,
  icon: Icon,
  label,
  hint,
  trailing,
  tone = "neutral",
}: SettingsRowProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-raised active:bg-surface-hover"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl border",
          TONE_TILE[tone],
        )}
      >
        <Icon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-bone">{label}</span>
        {hint ? <span className="block truncate text-xs text-muted">{hint}</span> : null}
      </span>

      {trailing ? <span className="shrink-0 text-xs text-muted">{trailing}</span> : null}

      <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-muted" />
    </Link>
  );
}
