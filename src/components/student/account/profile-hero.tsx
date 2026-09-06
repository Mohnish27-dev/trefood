import { AtSign, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { EditProfileDialog } from "./edit-profile-dialog";

/**
 * The account screen's identity card.
 *
 * The one place in the student app where decoration is allowed: this is not on
 * the ordering path, nobody is reading it under time pressure, and it is the
 * screen a student shows a friend when they say "I use this". The saffron
 * wash and the glow are pure CSS — no image, no network byte, because campus
 * wifi is bad.
 *
 * Three numbers, chosen because each one answers a question a student actually
 * has: how much have I used this, have I let anyone down at the gate, and can
 * I still pay cash tonight. Spend is deliberately not among them.
 */
export function ProfileHero({
  name,
  email,
  phone,
  orderCount,
  noShowCount,
  codAvailable,
}: {
  name: string;
  email: string;
  phone: string | null;
  orderCount: number;
  noShowCount: number;
  codAvailable: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-saffron/20 bg-surface">
      {/* Decoration only. aria-hidden so a screen reader hears the name first. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,rgb(255_107_26/0.22),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-saffron/10 blur-2xl"
      />

      <div className="relative p-4">
        <div className="flex items-start gap-3.5">
          <span className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-saffron to-saffron-deep font-display text-2xl font-bold text-white shadow-[0_6px_20px_-6px] shadow-saffron/60 ring-1 ring-white/15">
            {initial}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 flex-1 truncate font-display text-xl font-bold tracking-tight text-bone">
                {name}
              </h2>
              <EditProfileDialog name={name} email={email} phone={phone} />
            </div>

            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <Phone className="size-3.5 shrink-0 text-saffron/70" />
              <span className="truncate">
                {phone ?? "Add your number so the gate can reach you"}
              </span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <AtSign className="size-3.5 shrink-0 text-saffron/70" />
              <span className="truncate">{email}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-ink/40">
          <HeroStat label="Orders" value={String(orderCount)} />
          <HeroStat
            label="Not collected"
            value={String(noShowCount)}
            tone={noShowCount > 0 ? "chili" : "bone"}
          />
          <HeroStat
            label="Pay at gate"
            value={codAvailable ? "On" : "Off"}
            tone={codAvailable ? "mint" : "chili"}
          />
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  tone = "bone",
}: {
  label: string;
  value: ReactNode;
  tone?: "bone" | "mint" | "chili";
}) {
  return (
    <div className="px-2 py-2.5 text-center">
      <p
        className={cn(
          "font-display text-lg font-bold leading-tight",
          tone === "mint" && "text-mint",
          tone === "chili" && "text-chili",
          tone === "bone" && "text-bone",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
        {label}
      </p>
    </div>
  );
}
