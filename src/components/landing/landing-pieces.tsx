import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Landing page furniture.
 *
 * Every piece here is a Server Component on purpose: the marketing page is
 * the one route a stranger loads on hostel wifi with an empty cache, so it
 * ships no JavaScript beyond the theme toggle. Everything that moves is a
 * CSS animation declared in globals.css, and all of it stops under
 * `prefers-reduced-motion`.
 */

/* ── The looping dish ticker ─────────────────────────────────────────── */

const DISHES = [
  "Chicken Biryani",
  "Veg Momos",
  "Paneer Roll",
  "Masala Maggi",
  "Cold Coffee",
  "Chilli Potato",
  "Egg Chowmein",
  "Aloo Paratha",
  "Cutting Chai",
  "Chicken Roll",
  "Veg Thali",
  "Samosa",
];

export function DishMarquee() {
  return (
    <div className="marquee-mask relative overflow-hidden border-y border-line/70 bg-surface/40 py-3">
      {/* The track carries the list twice so the -50% loop is seamless. */}
      <div className="flex w-max animate-marquee items-center gap-8 pr-8">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            className="flex items-center gap-8"
            aria-hidden={copy === 1 ? true : undefined}
          >
            {DISHES.map((dish) => (
              <li
                key={dish}
                className="flex shrink-0 items-center gap-3 text-sm font-medium whitespace-nowrap text-muted"
              >
                <span className="size-1.5 rounded-full bg-saffron/70" />
                {dish}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/* ── "What are you craving?" rail ────────────────────────────────────── */

const CRAVINGS = [
  { emoji: "🍛", label: "Biryani", note: "Feast" },
  { emoji: "🌯", label: "Rolls", note: "Under ₹99" },
  { emoji: "🍜", label: "Maggi & Chai", note: "Classic" },
  { emoji: "🥟", label: "Momos", note: "Steamed" },
  { emoji: "🍗", label: "Chicken", note: "Hostel pick" },
  { emoji: "🌙", label: "Late night", note: "Curfew safe" },
];

export function CravingRail({ href }: { href: string }) {
  return (
    <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {CRAVINGS.map((craving, index) => (
        <Link
          key={craving.label}
          href={href}
          className={cn(
            "group relative flex w-[7.5rem] shrink-0 snap-start flex-col justify-between gap-3 overflow-hidden",
            "rounded-2xl border border-line bg-surface p-3.5 transition-all",
            "hover:-translate-y-1 hover:border-saffron/50 hover:bg-surface-raised active:scale-[0.98]",
            "reveal-on-scroll",
          )}
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <span
            className="text-3xl leading-none animate-float"
            style={{ animationDelay: `${index * 400}ms` }}
            aria-hidden
          >
            {craving.emoji}
          </span>
          <span>
            <span className="block font-display text-sm font-bold text-bone">
              {craving.label}
            </span>
            <span className="block text-[0.65rem] font-medium uppercase tracking-wider text-faint">
              {craving.note}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ── Numbered steps ──────────────────────────────────────────────────── */

export function Step({
  index,
  title,
  body,
  emoji,
}: {
  index: number;
  title: string;
  body: string;
  emoji: string;
}) {
  return (
    <li
      className="reveal-on-scroll relative flex gap-4 rounded-2xl border border-line bg-surface/80 p-4 backdrop-blur-sm sm:flex-col sm:gap-3 sm:p-5"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="flex shrink-0 items-center gap-3 sm:w-full sm:justify-between">
        <span className="text-flame font-display text-3xl font-black leading-none tabular sm:text-4xl">
          {String(index).padStart(2, "0")}
        </span>
        <span className="hidden text-2xl sm:block" aria-hidden>
          {emoji}
        </span>
      </div>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-bone sm:text-base">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{body}</p>
      </div>
    </li>
  );
}

/* ── Value cards ─────────────────────────────────────────────────────── */

export type FeatureTone = "saffron" | "mint" | "sky" | "amber";

const TONE: Record<FeatureTone, { icon: string; ring: string; glow: string }> = {
  saffron: {
    icon: "bg-saffron-wash text-saffron",
    ring: "hover:border-saffron/50",
    glow: "bg-saffron/20",
  },
  mint: { icon: "bg-mint-wash text-mint", ring: "hover:border-mint/50", glow: "bg-mint/20" },
  sky: { icon: "bg-sky-wash text-sky", ring: "hover:border-sky/50", glow: "bg-sky/20" },
  amber: { icon: "bg-amber-wash text-amber", ring: "hover:border-amber/50", glow: "bg-amber/20" },
};

export function FeatureCard({
  icon: Icon,
  eyebrow,
  title,
  body,
  tone,
  index,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  tone: FeatureTone;
  index: number;
}) {
  const styles = TONE[tone];

  return (
    <article
      className={cn(
        "reveal-on-scroll group relative overflow-hidden rounded-2xl border border-line bg-surface p-5",
        "transition-all duration-300 hover:-translate-y-1",
        styles.ring,
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Colour bleed that only shows on hover — keeps the resting card calm. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 size-28 rounded-full blur-2xl",
          "opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          styles.glow,
        )}
      />

      <span
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
          styles.icon,
        )}
      >
        <Icon className="size-5" />
      </span>

      <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-faint">
        {eyebrow}
      </p>
      <h3 className="mt-1 font-display text-base font-bold text-bone">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}

/* ── The mock order card in the hero ─────────────────────────────────── */

export function GateCodePreview() {
  return (
    <div className="relative mx-auto w-full max-w-xs">
      {/* Floating garnish. Purely decorative, hidden from assistive tech. */}
      <span
        aria-hidden
        className="absolute -left-6 -top-4 animate-float text-4xl drop-shadow-lg sm:-left-10 sm:text-5xl"
      >
        🍛
      </span>
      <span
        aria-hidden
        className="absolute -right-4 top-16 animate-float-slow text-3xl drop-shadow-lg sm:-right-8 sm:text-4xl"
        style={{ animationDelay: "1.2s" }}
      >
        🌯
      </span>
      <span
        aria-hidden
        className="absolute -bottom-5 left-4 animate-float text-3xl drop-shadow-lg sm:text-4xl"
        style={{ animationDelay: "2.4s" }}
      >
        ☕
      </span>

      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-md">
        {/* One slow pass of light across the card — the only thing on this
            page that could be mistaken for a loading state, so it is slow. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-sheen bg-gradient-to-r from-transparent via-white/8 to-transparent"
        />

        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-wash px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-mint">
            <span className="size-1.5 animate-pulse-ring rounded-full bg-mint" />
            At your gate
          </span>
          <span className="text-[0.65rem] font-medium text-faint">Hostel 5 · Main Gate</span>
        </div>

        <p className="mt-5 text-center text-[0.65rem] font-bold uppercase tracking-[0.18em] text-faint">
          Show this code
        </p>
        <p className="gate-code mt-1 text-center text-5xl">4821</p>

        <div className="mt-5 space-y-2 border-t border-line pt-4">
          {[
            { name: "Chicken Biryani", qty: "×1", price: "₹120" },
            { name: "Cutting Chai", qty: "×2", price: "₹30" },
          ].map((line) => (
            <div key={line.name} className="flex items-center justify-between text-xs">
              <span className="text-muted">
                {line.name} <span className="text-faint">{line.qty}</span>
              </span>
              <span className="tabular font-medium text-bone">{line.price}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-raised px-3.5 py-2.5">
          <span className="text-xs font-medium text-muted">Paid at gate</span>
          <span className="tabular font-display text-base font-bold text-saffron">₹150</span>
        </div>
      </div>
    </div>
  );
}

/* ── A link that looks like the app's search bar ─────────────────────── */

export function SearchTeaser({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4",
        "shadow-lg shadow-black/10 transition-all hover:border-saffron/50 hover:bg-surface-raised active:scale-[0.99]",
      )}
    >
      <span className="text-lg" aria-hidden>
        🔍
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-faint">
        Search biryani, momos, chai…
      </span>
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-saffron text-ink transition-transform group-hover:translate-x-0.5">
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
