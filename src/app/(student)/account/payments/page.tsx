import {
  Banknote,
  CreditCard,
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
import { getCampusById } from "@/server/services/catalog";
import { DEFAULTS, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/constants";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

/**
 * Payments.
 *
 * There are no saved cards here and there never will be — TREFOOD does not
 * hold card data, the gateway does, and a screen that pretends otherwise is a
 * screen that has to be honest about a breach one day.
 *
 * What this screen is really for is the cash-at-the-gate rules. F8 and F9 both
 * end with cash switched off, and the account hub only has room for the
 * headline. The full explanation lives here: how it works, what took it away,
 * and what brings it back.
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
          description="Your payment history and your cash-at-the-gate standing both live on your account."
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
  const [orders, campus] = await Promise.all([
    listOrdersForCustomer(user._id, 100),
    user.campusId ? getCampusById(user.campusId) : Promise.resolve(null),
  ]);

  const campusCodOff = campus?.settings.codEnabled === false;
  const codAvailable = !user.codBlocked && !campusCodOff;
  const strikesLeft = Math.max(0, DEFAULTS.codStrikeThreshold - user.strikes);

  // Only orders that actually moved money. A payment-pending order that was
  // abandoned never charged anyone and does not belong in a history.
  const paid = orders.filter(
    (order) =>
      order.payment.onlinePaidPaise > 0 || order.payment.cashDueOnDeliveryPaise > 0,
  );

  const recent = paid.slice(0, 12);

  return (
    <>
      <SubPageHeader title="Payments" />

      <div className="space-y-5 p-4">
        {/* ── How you can pay ──────────────────────────────────── */}
        <section>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            How you can pay
          </h2>

          <Card className="divide-y divide-line">
            <div className="flex items-start gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky/25 bg-sky-wash">
                <CreditCard className="size-5 text-sky" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-sm font-semibold text-bone">Pay online</p>
                  <Badge tone="success">Always available</Badge>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  UPI, cards and net banking, handled by the payment gateway at checkout.
                  Nothing about your card is stored by TREFOOD, which is why there is no
                  saved-cards list on this screen.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4">
              <span
                className={
                  codAvailable
                    ? "flex size-10 shrink-0 items-center justify-center rounded-xl border border-mint/25 bg-mint-wash"
                    : "flex size-10 shrink-0 items-center justify-center rounded-xl border border-chili/25 bg-chili-wash"
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
                      Nothing else about your account has changed, and this is not
                      permanent. Support can switch it back on once the record is clean.
                    </p>
                  </>
                ) : campusCodOff ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    Cash orders are paused across this campus at the moment. Paying online
                    works as usual.
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    Pay a small share online now and the rest in cash when you collect. If
                    an order is not collected{" "}
                    {strikesLeft === 1 ? "once more" : `${strikesLeft} more times`}, cash is
                    switched off and you would need to pay online.
                  </p>
                )}
              </div>
            </div>
          </Card>

          {user.strikes > 0 ? (
            <p className="mt-2 flex items-start gap-2 px-1 text-xs leading-relaxed text-amber">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {user.strikes} strike{user.strikes === 1 ? "" : "s"} on this account. They
                come from cash orders left uncollected at the gate — nothing else adds one.
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
                Once you place an order, what you paid online and what you paid in cash
                both show up here.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {recent.map((order) => {
                const cash = order.payment.cashDueOnDeliveryPaise;
                const online = order.payment.onlinePaidPaise;
                const refunded = order.refund?.status === "PROCESSED";

                return (
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
                        <span>
                          {order.payment.method === PAYMENT_METHOD.HYBRID_COD
                            ? "Cash at gate"
                            : "Paid online"}
                        </span>
                        {refunded ? (
                          <>
                            <span className="text-line">•</span>
                            <span className="text-mint">Refunded</span>
                          </>
                        ) : order.status === ORDER_STATUS.NO_SHOW ? (
                          <>
                            <span className="text-line">•</span>
                            <span className="text-chili">Not collected</span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <Money
                        paise={online + cash}
                        className="text-sm font-semibold text-bone"
                      />
                      {cash > 0 && online > 0 ? (
                        <p className="mt-0.5 text-[10px] text-faint">
                          <Money paise={online} /> online
                        </p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
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
          Refunds go back to the account you paid from and can take 3–5 working days to
          appear, which is the bank&apos;s clock, not ours. The convenience fee is charged
          by the gateway and is not refundable.
        </p>
      </div>
    </>
  );
}
