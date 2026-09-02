import { ArrowRight, Clock, LogIn, ShieldCheck, UtensilsCrossed, Wallet } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/shared/logo";
import { getSession } from "@/server/auth/session";
import { ROLE } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Standard landing page.
 *
 * Streamlined for the single active campus (NIT Patna).
 * Directs visitors to Sign in to access canteens and orders.
 */
export default async function LandingPage() {
  const session = await getSession();

  const appDestination =
    session?.role === ROLE.VENDOR_OWNER || session?.role === ROLE.VENDOR_STAFF
      ? "/vendor/orders"
      : session?.role === ROLE.ADMIN || session?.role === ROLE.SUPER_ADMIN
        ? "/admin/orders"
        : "/c/nit-patna";

  return (
    <main className="min-h-dvh">
      {/* ── Header / Navigation ─────────────────────────────────── */}
      <header className="px-5 pt-8 pb-4 max-w-2xl mx-auto flex items-center justify-between">
        <BrandLogo size="md" />
        {session ? (
          <Link
            href={appDestination}
            className="rounded-xl border border-saffron/30 bg-saffron-wash px-3.5 py-1.5 text-xs font-medium text-saffron hover:bg-saffron hover:text-ink transition-colors"
          >
            Go to App
          </Link>
        ) : (
          <Link
            href="/signin"
            className="rounded-xl border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-muted hover:border-saffron/40 hover:text-bone transition-colors"
          >
            Sign in
          </Link>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="px-5 pt-8 pb-12 max-w-2xl mx-auto sm:pt-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-saffron/30 bg-saffron-wash px-3 py-1 text-xs font-medium text-saffron">
          <span className="size-1.5 rounded-full bg-saffron animate-pulse-ring" />
          Live at NIT Patna
        </span>

        <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight text-bone sm:text-6xl">
          Campus food,
          <br />
          <span className="text-saffron">delivered to your gate.</span>
        </h1>

        <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
          Order from the canteens you already eat at. Collect at your hostel gate, match
          the code on the packet, done. No app for the rider, no map to stare at.
        </p>

        {/* ── Primary Action Button ────────────────────────────── */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {session ? (
            <Link
              href={appDestination}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-saffron px-6 py-3.5 text-sm font-semibold text-ink shadow-lg shadow-saffron/20 transition-all hover:bg-saffron/90 active:scale-[0.98]"
            >
              <UtensilsCrossed className="size-4" />
              <span>Go to Canteen</span>
              <ArrowRight className="size-4" />
            </Link>
          ) : (
            <Link
              href="/signin"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-saffron px-6 py-3.5 text-sm font-semibold text-ink shadow-lg shadow-saffron/20 transition-all hover:bg-saffron/90 active:scale-[0.98]"
            >
              <LogIn className="size-4" />
              <span>Sign in</span>
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </section>

      {/* ── Why this exists ──────────────────────────────────────── */}
      <section className="px-5 pb-16 max-w-2xl mx-auto">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          Built for a campus, not a city
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <Feature
            icon={Wallet}
            title="10% commission"
            body="Not the 25–30% an aggregator charges. That is what makes a ₹60 roll worth cooking."
          />
          <Feature
            icon={ShieldCheck}
            title="A code on the packet"
            body="Four digits written on your order. Match it at the gate and tap confirm. Nobody can close it but you."
          />
          <Feature
            icon={Clock}
            title="Curfew aware"
            body="We will not take an order that cannot reach your gate before it shuts. You get told why, not just refused."
          />
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="px-5 pb-16 max-w-2xl mx-auto border-t border-line/60 pt-6">
        <p className="text-xs leading-relaxed text-faint">
          TREFOOD · Hyperlocal campus delivery. Handover at the gate, always.
        </p>
      </footer>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Clock;
  title: string;
  body: string;
}) {
  return (
    <Card className="p-4">
      <Icon className="size-5 text-saffron" />
      <p className="mt-3 font-display text-sm font-semibold text-bone">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
    </Card>
  );
}
