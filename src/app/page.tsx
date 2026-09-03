import { cache, Suspense } from "react";
import {
  ArrowRight,
  BellRing,
  Clock,
  LogIn,
  ShieldCheck,
  Sparkles,
  Store,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  CravingRail,
  DishMarquee,
  FeatureCard,
  GateCodePreview,
  SearchTeaser,
  Step,
} from "@/components/landing/landing-pieces";
import { landingForRole } from "@/lib/routes";
import { getSession } from "@/server/auth/session";

/**
 * The landing page.
 *
 * This is the only route a stranger loads cold, so the shell is static and
 * the two session-dependent buttons stream in behind `<Suspense>`. Without
 * that, a Mongo round-trip sat in front of the first byte of a page that is
 * otherwise pure markup.
 */

/**
 * Where the CTAs point for someone who is not signed in yet. Deliberately
 * bare: the sign-in flow resolves the destination from the account's role,
 * so pinning `next` here would strand a vendor or admin on the student feed.
 */
const SIGN_IN = "/signin";

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-line/60 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <BrandLogo size="md" />
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Suspense fallback={<HeaderCtaShell href={SIGN_IN}>Sign in</HeaderCtaShell>}>
              <HeaderCta />
            </Suspense>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="hero-glow pointer-events-none absolute inset-0 -z-10" aria-hidden />

        <div className="mx-auto grid max-w-5xl gap-12 px-5 pb-14 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pb-20">
          <div>
            <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-saffron/30 bg-saffron-wash px-3 py-1.5 text-xs font-semibold text-saffron">
              <span className="size-1.5 animate-pulse-ring rounded-full bg-saffron" />
              Live at NIT Patna · 7 canteens
            </span>

            <h1 className="animate-rise mt-5 font-display text-[2.75rem] font-bold leading-[1.02] tracking-tight text-bone sm:text-6xl lg:text-[4.25rem]">
              Hungry at 1 AM?
              <br />
              <span className="text-flame">Food at your gate.</span>
            </h1>

            <p className="animate-rise mt-5 max-w-md text-base leading-relaxed text-muted">
              Order from the canteens you already eat at. Collect at your hostel gate,
              match the four digits on the packet, done. No rider app, no map to stare
              at, no ₹90 delivery fee.
            </p>

            <div className="animate-rise mt-7 max-w-md">
              <SearchTeaser href={SIGN_IN} />
            </div>

            <div className="animate-rise mt-4 flex flex-wrap items-center gap-3">
              <Suspense
                fallback={
                  <HeroCtaShell href={SIGN_IN} icon="signin">
                    Sign in to order
                  </HeroCtaShell>
                }
              >
                <HeroCta />
              </Suspense>

              <Link
                href="#how-it-works"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-5 text-sm font-semibold text-bone transition-all hover:border-saffron/40 hover:bg-surface-raised active:scale-[0.98]"
              >
                How it works
              </Link>
            </div>

            <dl className="mt-9 grid max-w-md grid-cols-3 gap-3">
              <Stat value="7" label="canteens live" />
              <Stat value="~20" label="min to your gate" />
              <Stat value="10%" label="commission, not 30%" />
            </dl>
          </div>

          <div className="lg:pl-6">
            <GateCodePreview />
          </div>
        </div>
      </section>

      {/* ── Dish ticker ──────────────────────────────────────────────── */}
      <DishMarquee />

      {/* ── Cravings ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pt-12">
        <SectionHeading
          eyebrow="Pick a craving"
          title="What are you eating tonight?"
        />
        <div className="mt-5">
          <CravingRail href={SIGN_IN} />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative scroll-mt-20 py-14">
        <div className="grid-fade pointer-events-none absolute inset-0 -z-10" aria-hidden />

        <div className="mx-auto max-w-5xl px-5">
          <SectionHeading
            eyebrow="Four taps, one code"
            title="How an order actually goes"
          />

          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Step
              index={1}
              emoji="🏠"
              title="Pick your gate"
              body="Hostel 5, main gate, wherever you will be standing. Restaurants that cannot reach it are hidden, not greyed out."
            />
            <Step
              index={2}
              emoji="🧾"
              title="Order from a canteen"
              body="The same kitchens you already walk to. Real menus, real prices, and the prep time they actually keep."
            />
            <Step
              index={3}
              emoji="🛵"
              title="Watch it move"
              body="Accepted, cooking, out for delivery, at your gate. Live, without you refreshing anything."
            />
            <Step
              index={4}
              emoji="🔢"
              title="Match the code"
              body="Four digits written on the packet. They match your screen, you tap confirm. Nobody else can close it."
            />
          </ol>
        </div>
      </section>

      {/* ── Why this exists ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <SectionHeading
          eyebrow="Built for a campus, not a city"
          title="Why it is cheaper and calmer here"
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            index={0}
            tone="saffron"
            icon={Wallet}
            eyebrow="Student pricing"
            title="A ₹60 roll stays ₹60"
            body="We take 10%, not the 25–30% an aggregator charges. That is the difference between a canteen cooking for you and a canteen quietly raising its menu."
          />
          <FeatureCard
            index={1}
            tone="mint"
            icon={ShieldCheck}
            eyebrow="Handover"
            title="A code on every packet"
            body="Four digits, written on your order. Match them at the gate and tap confirm. No order can be closed without the person holding it."
          />
          <FeatureCard
            index={2}
            tone="amber"
            icon={Clock}
            eyebrow="Curfew aware"
            title="It knows when your gate shuts"
            body="An order that cannot reach you before curfew is never taken. You get told which gate still works and why, not a blank refusal."
          />
          <FeatureCard
            index={3}
            tone="sky"
            icon={BellRing}
            eyebrow="Hostel wifi"
            title="Survives two bars of signal"
            body="Live status without a heavy map, notifications when the packet is at your gate, and an offline screen that says something useful."
          />
        </div>
      </section>

      {/* ── Vendor band ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="reveal-on-scroll relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-56 animate-flame rounded-full bg-saffron/15 blur-3xl"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted">
                <Store className="size-3" />
                For canteen owners
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-bone">
                Run a canteen on campus?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                One tablet, one order board, daily settlement. Accept, cook, hand over —
                the same rhythm you already have, with the queue written down.
              </p>
            </div>
            <Link
              href="/signin?tab=vendor"
              className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl border border-saffron/40 bg-saffron-wash px-5 text-sm font-semibold text-saffron transition-all hover:bg-saffron hover:text-ink active:scale-[0.98]"
            >
              Vendor console
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="reveal-on-scroll relative overflow-hidden rounded-3xl border border-saffron/25 bg-saffron-wash p-8 text-center sm:p-12">
          <span aria-hidden className="text-4xl">
            🛵
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-bone sm:text-4xl">
            Your gate. Twenty minutes.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Sign in with your campus email and the canteens open right up. No
            onboarding, no promo codes to hunt for.
          </p>
          <div className="mt-7 flex justify-center">
            <Suspense
              fallback={
                <HeroCtaShell href={SIGN_IN} icon="signin">
                  Sign in to order
                </HeroCtaShell>
              }
            >
              <HeroCta />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size="sm" />
          <p className="text-xs leading-relaxed text-faint">
            TREFOOD · Hyperlocal campus delivery. Handover at the gate, always.
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Session-aware CTAs                                                  */
/* ------------------------------------------------------------------ */

/**
 * These read the session, which is what makes this route dynamic. They are
 * the only things behind a Suspense boundary, so the rest of the page
 * reaches the browser while Mongo is still answering.
 *
 * Three CTAs share one lookup via `cache`, and a failed lookup renders the
 * signed-out page rather than an error: this is the page a stranger loads,
 * and it has no business going down with the database.
 */
const landingSession = cache(async () => {
  try {
    return await getSession();
  } catch {
    return null;
  }
});

async function HeaderCta() {
  const session = await landingSession();
  if (!session) return <HeaderCtaShell href={SIGN_IN}>Sign in</HeaderCtaShell>;
  return <HeaderCtaShell href={landingForRole(session.role)}>Go to app</HeaderCtaShell>;
}

async function HeroCta() {
  const session = await landingSession();
  if (!session) {
    return (
      <HeroCtaShell href={SIGN_IN} icon="signin">
        Sign in to order
      </HeroCtaShell>
    );
  }
  return (
    <HeroCtaShell href={landingForRole(session.role)} icon="app">
      Start ordering
    </HeroCtaShell>
  );
}

/**
 * Both sign-in entry points share one shell so they can never drift apart
 * again — the header pill and the hero button are the same saffron, one
 * filled and one washed, which is the rule the design system already had.
 */
function HeaderCtaShell({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center rounded-xl border border-saffron/35 bg-saffron-wash px-4 text-xs font-semibold text-saffron transition-all hover:bg-saffron hover:text-ink active:scale-95"
    >
      {children}
    </Link>
  );
}

function HeroCtaShell({
  href,
  icon,
  children,
}: {
  href: string;
  icon: "signin" | "app";
  children: React.ReactNode;
}) {
  const Icon = icon === "signin" ? LogIn : UtensilsCrossed;
  return (
    <Link
      href={href}
      className="group inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-saffron px-6 text-sm font-semibold text-ink shadow-lg shadow-saffron/25 transition-all hover:bg-saffron-glow active:scale-[0.98]"
    >
      <Icon className="size-4" />
      <span>{children}</span>
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Small bits                                                          */
/* ------------------------------------------------------------------ */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 px-3 py-3 backdrop-blur-sm">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="tabular block font-display text-xl font-bold text-bone">{value}</span>
        <span className="mt-0.5 block text-[0.65rem] leading-tight text-faint">{label}</span>
      </dd>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="reveal-on-scroll">
      <p className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-saffron">
        <Sparkles className="size-3.5" />
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-bone sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}
