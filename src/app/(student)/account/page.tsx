import {
  BadgeIndianRupee,
  BellRing,
  ClipboardList,
  FileText,
  Heart,
  Info,
  LifeBuoy,
  LogOut,
  MapPin,
  MessageSquareMore,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ProfileHero } from "@/components/student/account/profile-hero";
import { SettingsGroup, SettingsRow } from "@/components/student/account/settings-list";
import { getSession } from "@/server/auth/session";
import { signOut } from "@/server/actions/session";
import { listOrdersForCustomer } from "@/server/services/orders";
import { getCampusById } from "@/server/services/catalog";
import { zoneCookieName } from "@/lib/cookies";
import { DEFAULT_CAMPUS_SLUG } from "@/lib/routes";
import { ORDER_STATUS } from "@/lib/constants";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

/**
 * The account hub.
 *
 * A directory, not a settings dump. Everything that needs explaining — the
 * cash-at-the-gate rules, the PIN, the notification permission — lives on its
 * own screen behind a row here, so this page stays scannable at a glance and
 * each of those screens has room to say the whole truth instead of a sentence
 * squeezed into a card.
 *
 * The one thing that does NOT wait behind a row is a COD block. F8 and F9 both
 * end with cash switched off, and a student who discovers that at checkout —
 * cart full, no explanation — is a student who stops using the app. So the
 * block is surfaced here, in plain language, the moment it exists.
 *
 * There is no delete-account button and no ban. A blocked-COD student who must
 * prepay is a better customer than a lost one.
 */
export default async function AccountPage() {
  const session = await getSession();

  if (!session) {
    return (
      <>
        <Header />
        <EmptyState
          icon={UserRound}
          title="You are not signed in"
          description="Browsing needs no account. Sign in when you want to place an order and follow it to the gate."
          action={
            <Button asChild>
              <Link href="/signin?next=/account">Sign in</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { user } = session;
  const [orders, campus] = await Promise.all([
    listOrdersForCustomer(user._id, 100),
    user.campusId ? getCampusById(user.campusId) : Promise.resolve(null),
  ]);

  const noShows = orders.filter((order) => order.status === ORDER_STATUS.NO_SHOW);

  const favouriteCount = user.favouriteRestaurantIds?.length ?? 0;
  const campusSlug = campus?.slug ?? DEFAULT_CAMPUS_SLUG;

  // The gate lives in a cookie because the restaurant list is filtered on the
  // server; reading it here is the same read the list does.
  const cookieStore = await cookies();
  const zoneId = cookieStore.get(zoneCookieName(campusSlug))?.value ?? null;
  const zone = campus?.zones.find((z) => z.id === zoneId) ?? null;

  const pinSet = Boolean(user.quickUnlock?.pinHash);

  return (
    <>
      <Header />

      <div className="space-y-5 p-4">
        {/* ── 1. Who ───────────────────────────────────────────── */}
        <ProfileHero
          name={user.name}
          email={user.email}
          phone={user.phone}
          orderCount={orders.length}
          noShowCount={noShows.length}
          orderingBlocked={user.ordersBlocked}
        />

        {/* ── The one thing that cannot wait behind a row ───────── */}
        {user.ordersBlocked ? (
          <Card className="border-chili/30 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-chili/25 bg-chili-wash">
                <ShieldAlert className="size-4 text-chili" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-bone">
                  Ordering is paused on this account
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {user.ordersBlockedReason ?? "Ordering is paused on your account."} This is
                  not permanent.
                </p>
                <Link
                  href="/account/support"
                  className="mt-2 inline-block text-sm font-medium text-saffron underline-offset-4 hover:underline"
                >
                  How to get it back
                </Link>
              </div>
            </div>
          </Card>
        ) : user.strikes > 0 ? (
          <Card className="border-amber/30 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber/25 bg-amber-wash">
                <ShieldCheck className="size-4 text-amber" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-bone">
                  {user.strikes} strike{user.strikes === 1 ? "" : "s"} on this account
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  They come from orders left uncollected at the gate. The restaurant cooked and
                  carried that food for nothing, so please cancel early rather than not turning
                  up.
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* ── 2. Your Account ──────────────────────────────────── */}
        <SettingsGroup title="Your account">
          <SettingsRow
            href="/account/favourites"
            icon={Heart}
            label="Favourites"
            hint={
              favouriteCount === 0
                ? "Nothing starred yet"
                : `${favouriteCount} restaurant${favouriteCount === 1 ? "" : "s"}`
            }
            tone="chili"
          />
          <SettingsRow
            href="/orders"
            icon={ClipboardList}
            label="My orders"
            hint={orders.length === 0 ? "No orders yet" : `${orders.length} in total`}
            tone="saffron"
          />
          <SettingsRow
            href="/account/pickup"
            icon={MapPin}
            label="Pickup location"
            hint={zone?.name ?? "No gate picked yet"}
            tone="sky"
          />
          <SettingsRow
            href="/account/payments"
            icon={BadgeIndianRupee}
            label="Payments"
            hint={"Cash at the gate, every order"}
            tone="mint"
          />
        </SettingsGroup>

        {/* ── 3. Preferences & Security ────────────────────────── */}
        <SettingsGroup title="Preferences & security">
          <SettingsRow
            href="/account/app-lock"
            icon={ShieldCheck}
            label="App lock"
            hint={pinSet ? "4-digit PIN active" : "Not set up"}
            tone={pinSet ? "mint" : "neutral"}
          />
          <SettingsRow
            href="/account/notifications"
            icon={BellRing}
            label="Notifications"
            hint="Get buzzed the moment food reaches your gate"
            tone="amber"
          />
          <ThemeToggle variant="row" />
        </SettingsGroup>

        {/* ── 4. Help & Support ────────────────────────────────── */}
        <SettingsGroup title="Help & support">
          <SettingsRow
            href="/account/help"
            icon={LifeBuoy}
            label="Help centre"
            hint="Gate codes, refunds, stockouts, curfew"
          />
          <SettingsRow
            href="/account/support"
            icon={MessageSquareMore}
            label="Contact support"
            hint="A human, on WhatsApp or email"
          />
        </SettingsGroup>

        {/* ── 5. Legal & About ─────────────────────────────────── */}
        <SettingsGroup title="Legal & about">
          <SettingsRow href="/legal/terms" icon={FileText} label="Terms & conditions" />
          <SettingsRow href="/legal/privacy" icon={ShieldCheck} label="Privacy policy" />
          <SettingsRow
            href="/legal/refunds"
            icon={RotateCcw}
            label="Refund & cancellation policy"
          />
          <SettingsRow href="/legal/about" icon={Info} label="About TREFOOD" />
        </SettingsGroup>

        {/* ── 6. Out ───────────────────────────────────────────── */}
        <form action={signOut}>
          <Button type="submit" variant="secondary" block size="lg">
            <LogOut />
            Log out
          </Button>
        </form>

        <div className="pb-2 text-center">
          <Link
            href={`/c/${campusSlug}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-bone"
          >
            <Store className="size-3.5" />
            Browse restaurants at {campus?.name ?? "NIT Patna"}
          </Link>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-faint">
            Your food is delivered by the restaurant&apos;s own staff, so there is no live
            map. You are told the moment it reaches your gate.
          </p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Header() {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-line bg-ink/95 px-4 backdrop-blur-lg pt-safe">
      <h1 className="font-display text-base font-semibold text-bone">Account</h1>
      <ThemeToggle />
    </header>
  );
}
