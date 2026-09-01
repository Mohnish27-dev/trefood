import { ArrowRight, Clock, MapPin, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { listCampuses } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

/**
 * The landing and campus picker.
 *
 * Browsing requires no login — auth is only needed at checkout (ARCH section 4,
 * step 1). So this page's only job is to establish what TREFOOD is in about
 * four seconds, and get the student into a campus.
 *
 * The three claims below are the three real differences from Swiggy, stated
 * as facts rather than marketing: 10% not 25-30%, gate handover with a code,
 * and curfew awareness. Every one of them is enforced in code elsewhere in
 * this repo, so none of them is a promise the product cannot keep.
 */
export default async function LandingPage() {
  const campuses = await listCampuses();

  return (
    <main className="min-h-dvh">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="px-5 pt-16 pb-10 max-w-2xl mx-auto sm:pt-24">
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
      </section>

      {/* ── Campus picker ────────────────────────────────────────── */}
      <section className="px-5 pb-12 max-w-2xl mx-auto">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          Choose your campus
        </h2>

        {campuses.length === 0 ? (
          <Card>
            <EmptyState
              icon={MapPin}
              title="No campuses yet"
              description="Run the seed to create NIT Patna with its five gates, then reload this page."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {campuses.map((campus) => {
              const gates = campus.zones.filter((z) => z.isActive).length;
              const alwaysOpen = campus.zones.filter(
                (z) => z.curfewMinutes === null && z.isActive,
              ).length;

              return (
                <Link key={campus._id} href={`/c/${campus.slug}`} className="block group">
                  <Card className="group-hover:border-saffron/50 group-active:scale-[0.99] transition-all">
                    <div className="flex items-center gap-4 p-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-saffron-wash border border-saffron/25">
                        <MapPin className="size-5 text-saffron" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-bone">{campus.name}</p>
                        <p className="text-sm text-muted">
                          {campus.city} · {gates} gate{gates === 1 ? "" : "s"}
                          {alwaysOpen > 0 ? ` · ${alwaysOpen} open 24×7` : ""}
                        </p>
                      </div>

                      <ArrowRight className="size-5 shrink-0 text-faint transition-colors group-hover:text-saffron" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
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

      {/* ── Console entry points ─────────────────────────────────── */}
      <section className="px-5 pb-20 max-w-2xl mx-auto">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/vendor/orders" className="text-muted hover:text-saffron transition-colors">
            Restaurant console →
          </Link>
          <Link href="/admin/orders" className="text-muted hover:text-saffron transition-colors">
            Admin console →
          </Link>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-faint">
          TREFOOD · Hyperlocal campus delivery. Handover at the gate, always.
        </p>
      </section>
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
