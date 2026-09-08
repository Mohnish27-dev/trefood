import {
  Banknote,
  ReceiptIndianRupee,
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
import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { getSession } from "@/server/auth/session";
import { listOrdersForCustomer } from "@/server/services/orders";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

/**
 * Payments.
 *
 * There are no saved cards here and there never will be — TREFOOD takes cash
 * on delivery and nothing else, so there is no card to save, no gateway to
 * store anything, and no refund queue to explain.
 *
 * What this screen is really for is the two things a student can still get
 * wrong: not being there when the food arrives, and not having the cash ready.
 * Both cost the restaurant real money, and both are recorded here.
 */
export default async function PaymentsPage() {
  const session = await getSession();

  if (!session) {
    return (
      <>
        <SubPageHeader title="Payments" />
        <EmptyState
          icon={UserRound}
          title="Sign in to see payments"
          description="Your payment history and your standing both live on your account."
          action={
            <Button asChild>
              <Link href="/signin?next=/account/payments">Sign in</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { user } = session;
  const orders = await listOrdersForCustomer(user._id, 100);

  // Only orders that actually reached a gate moved money. Everything else was
  // closed before anyone paid anything.
  const paid = orders.filter((order) => order.payment.status === PAYMENT_STATUS.COLLECTED);
  const recent = paid.slice(0, 12);

  return (
    <>
      <SubPageHeader title="Payments" />

      <div className="space-y-5 p-4">
        {/* ── How you pay ──────────────────────────────────────── */}
        <section>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            How you pay
          </h2>

          <Card className="divide-y divide-line">
            <div className="flex items-start gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-mint/25 bg-mint-wash">
                <Banknote className="size-5 text-mint" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-sm font-semibold text-bone">
                    Cash on delivery
                  </p>
                  <Badge tone="success">Every order</Badge>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  You pay nothing when you place an order. The whole bill is handed to the
                  delivery person in cash when your food reaches the gate — so keep the exact
                  amount ready, and check the four-digit code on the packet before you pay.
                </p>
              </div>
            </div>

            {user.ordersBlocked ? (
              <div className="flex items-start gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-chili/25 bg-chili-wash">
                  <ShieldAlert className="size-5 text-chili" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-semibold text-bone">
                      Ordering is paused
                    </p>
                    <Badge tone="danger">Paused</Badge>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {user.ordersBlockedReason ?? "Ordering is paused on your account."}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-bone">
                    This is not permanent. Talk to support and they can switch it back on.
                  </p>
                  <Link
                    href="/account/support"
                    className="mt-2 inline-block text-sm font-medium text-saffron underline-offset-4 hover:underline"
                  >
                    Contact support
                  </Link>
                </div>
              </div>
            ) : null}
          </Card>

          {user.strikes > 0 ? (
            <p className="mt-2 flex items-start gap-2 px-1 text-xs leading-relaxed text-amber">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {user.strikes} strike{user.strikes === 1 ? "" : "s"} on this account. They come
                from orders left uncollected at the gate — nothing else adds one. The restaurant
                cooked and carried that food for nothing, so please cancel early rather than not
                turning up.
              </span>
            </p>
          ) : null}
        </section>

        {/* ── History ──────────────────────────────────────────── */}
        <section>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Payment history
          </h2>

          {recent.length === 0 ? (
            <Card className="p-6 text-center">
              <ReceiptIndianRupee className="mx-auto size-6 text-faint" />
              <p className="mt-3 text-sm font-medium text-bone">No payments yet</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Once you collect an order and pay for it at the gate, it shows up here.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {recent.map((order) => (
                <Link
                  key={order._id}
                  href={`/orders/${order._id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-bone">
                      {order.restaurantSnapshot.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      <span className="font-mono tracking-wider text-faint">
                        {order.orderNumber}
                      </span>
                      <span className="text-line">•</span>
                      <span>Cash at gate</span>
                      {order.status === ORDER_STATUS.NO_SHOW ? (
                        <>
                          <span className="text-line">•</span>
                          <span className="text-chili">Not collected</span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <Money
                      paise={order.payment.cashCollectedPaise}
                      className="text-sm font-semibold text-bone"
                    />
                  </div>
                </Link>
              ))}
            </Card>
          )}

          {paid.length > recent.length ? (
            <Link
              href="/orders"
              className="mt-2 block px-1 text-xs font-medium text-saffron underline-offset-4 hover:underline"
            >
              See all {paid.length} orders
            </Link>
          ) : null}
        </section>

        <p className="px-1 pb-2 text-[11px] leading-relaxed text-faint">
          Nothing is ever charged before your food arrives, so there is nothing to refund if an
          order is rejected or cancelled. If an item runs out while your order is being cooked,
          the amount the delivery person collects drops to match.
        </p>
      </div>
    </>
  );
}
