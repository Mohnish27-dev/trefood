import {
  Banknote,
  ChevronRight,
  LogOut,
  Phone,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/states";
import { PushPermissionCard } from "@/components/student/push-permission-card";
import { getSession } from "@/server/auth/session";
import { signOut } from "@/server/actions/session";
import { listOrdersForCustomer } from "@/server/services/orders";
import { getCampusById } from "@/server/services/catalog";
import { DEFAULTS, ORDER_STATUS } from "@/lib/constants";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

/**
 * The account screen.
 *
 * Its real job is the cash-on-delivery section. F8 and F9 both end with COD
 * being switched off, and a student who discovers that at checkout — with a
 * cart full of food and no explanation — is a student who stops using the app.
 * So the block is explained here in plain language, with the count, the
 * reason, and what to do next: pay online, which still works perfectly.
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
  const orders = await listOrdersForCustomer(user._id, 100);
  const campus = user.campusId ? await getCampusById(user.campusId) : null;

  const delivered = orders.filter(
    (order) =>
      order.status === ORDER_STATUS.DELIVERED ||
      order.status === ORDER_STATUS.DELIVERED_TO_SECURITY ||
      order.status === ORDER_STATUS.SETTLED,
  );
  const noShows = orders.filter((order) => order.status === ORDER_STATUS.NO_SHOW);
  const spentPaise = delivered.reduce(
    (total, order) => total + order.payment.onlinePaidPaise + order.payment.cashDueOnDeliveryPaise,
    0,
  );

  const codAvailable = !user.codBlocked && (campus?.settings.codEnabled ?? true);
  const strikesLeft = Math.max(0, DEFAULTS.codStrikeThreshold - user.strikes);

  return (
    <>
      <Header />

      <div className="space-y-4 p-4">
        {/* ── Who ──────────────────────────────────────────────── */}
        <Card className="p-4">
          <div className="flex items-center gap-3.5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-saffron-wash border border-saffron/25 font-display text-xl font-semibold text-saffron">
              {user.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-bone">
                {user.name}
              </p>
              <p className="truncate text-sm text-muted">{user.email}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <Phone className="size-3 text-faint" />
                {user.phone ?? "No number yet — we ask at your first checkout"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3.5">
            <Stat label="Delivered" value={String(delivered.length)} />
            <Stat label="Spent" value={<Money paise={spentPaise} />} />
            <Stat
              label="Not collected"
              value={String(noShows.length)}
              tone={noShows.length > 0 ? "chili" : "bone"}
            />
          </div>
        </Card>

        {/* ── Cash on delivery — F8 / F9 ───────────────────────── */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span
              className={
                codAvailable
                  ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-wash border border-mint/25"
                  : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-chili-wash border border-chili/25"
              }
            >
              {codAvailable ? (
                <Banknote className="size-5 text-mint" />
              ) : (
                <ShieldAlert className="size-5 text-chili" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-semibold text-bone">
                  Cash at the gate
                </p>
                {codAvailable ? (
                  <Badge tone="success">Available</Badge>
                ) : (
                  <Badge tone="danger">Not available</Badge>
                )}
              </div>

              {user.codBlocked ? (
                <>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {user.codBlockedReason ??
                      "Cash on delivery is switched off on your account."}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-bone">
                    You can still order anything you like — just pay online at checkout.
                    Nothing else about your account has changed, and this is not permanent.
                  </p>
                </>
              ) : campus?.settings.codEnabled === false ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  Cash orders are paused across this campus at the moment. Paying online works
                  as usual.
                </p>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  Pay 10% online now and the rest in cash when you collect. If an order is not
                  collected {strikesLeft === 1 ? "once more" : `${strikesLeft} more times`},
                  cash is switched off and you would need to pay online.
                </p>
              )}
            </div>
          </div>

          {user.strikes > 0 ? (
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs text-amber">
              <ShieldCheck className="size-3.5 shrink-0" />
              {user.strikes} strike{user.strikes === 1 ? "" : "s"} on this account. They come
              from cash orders left uncollected at the gate.
            </div>
          ) : null}
        </Card>

        {/* ── F17 — push is never the only channel ─────────────── */}
        <PushPermissionCard />

        {/* ── Links ────────────────────────────────────────────── */}
        <Card className="divide-y divide-line">
          <Row href="/orders" label="Your orders" hint={`${orders.length} in total`} />
          <Row
            href={campus ? `/c/${campus.slug}` : "/c/nit-patna"}
            label="Browse restaurants"
            hint={campus?.name ?? "NIT Patna"}
          />
        </Card>

        <form action={signOut}>
          <Button type="submit" variant="secondary" block size="lg">
            <LogOut />
            Sign out
          </Button>
        </form>

        <p className="px-1 pb-2 text-center text-[11px] leading-relaxed text-faint">
          Your food is delivered by the restaurant&apos;s own staff, so there is no live map.
          You are told the moment it reaches your gate.
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Header() {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center border-b border-line bg-ink/95 px-4 backdrop-blur-lg pt-safe">
      <h1 className="font-display text-base font-semibold text-bone">Account</h1>
    </header>
  );
}

function Stat({
  label,
  value,
  tone = "bone",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "bone" | "chili";
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-faint">{label}</p>
      <p
        className={
          tone === "chili"
            ? "mt-0.5 font-display text-lg font-semibold text-chili"
            : "mt-0.5 font-display text-lg font-semibold text-bone"
        }
      >
        {value}
      </p>
    </div>
  );
}

function Row({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-surface-raised">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-bone">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </Link>
  );
}
