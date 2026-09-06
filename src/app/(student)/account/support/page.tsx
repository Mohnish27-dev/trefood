import { ClipboardList, LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { getSession } from "@/server/auth/session";
import { listOrdersForCustomer } from "@/server/services/orders";
import { clientEnv } from "@/lib/env";
import { TERMINAL_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Contact support" };
export const dynamic = "force-dynamic";

/**
 * Contact support.
 *
 * A channel that is not configured is not rendered. A support screen listing a
 * WhatsApp number nobody watches is worse than one listing only an email that
 * is actually read, because the student waits at the wrong door.
 *
 * The email link is pre-filled with the most recent order number. Almost every
 * support thread starts with "which order?", and a student who has already
 * closed the app cannot answer it.
 */
export default async function ContactSupportPage() {
  const session = await getSession();
  const orders = session ? await listOrdersForCustomer(session.user._id, 5) : [];
  const live = orders.find((order) => !TERMINAL_STATUSES.includes(order.status)) ?? null;
  const latest = live ?? orders[0] ?? null;

  const email = clientEnv.NEXT_PUBLIC_SUPPORT_EMAIL;
  const whatsapp = clientEnv.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const phone = clientEnv.NEXT_PUBLIC_SUPPORT_PHONE;

  const subject = latest
    ? `TREFOOD help with order ${latest.orderNumber}`
    : "TREFOOD support";
  const body = latest
    ? `Order: ${latest.orderNumber}\nRestaurant: ${latest.restaurantSnapshot.name}\n\nWhat happened:\n`
    : "What happened:\n";

  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(subject + " — ")}`
    : null;

  return (
    <>
      <SubPageHeader title="Contact support" />

      <div className="space-y-5 p-4">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-saffron/25 bg-saffron-wash">
              <LifeBuoy className="size-4 text-saffron" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-bone">
                A person, not a bot
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Tell us what happened and which order it was. Anything involving money —
                a refund, a wrong charge, a disagreement over cash — is checked against the order
                record before anyone replies, so give it a few hours rather than sending
                the same message twice.
              </p>
            </div>
          </div>
        </Card>

        {/* ── The fastest route for most problems ──────────────── */}
        {latest ? (
          <section className="space-y-2">
            <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
              Start here
            </h2>
            <Link
              href={`/orders/${latest._id}`}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:bg-surface-raised"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised">
                <ClipboardList className="size-4 text-muted" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-bone">
                  {live ? "Your order in progress" : "Your last order"}
                </span>
                <span className="block truncate text-xs text-muted">
                  {latest.orderNumber} · {latest.restaurantSnapshot.name}
                </span>
              </span>
            </Link>
            <p className="px-1 text-xs leading-relaxed text-faint">
              Open the order first and call the restaurant from it — wrong, missing or cold
              food is usually fastest to fix with the kitchen directly. Quote the order
              number below if you write to us instead.
            </p>
          </section>
        ) : null}

        {/* ── Channels ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Reach us
          </h2>

          <Card className="divide-y divide-line">
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-mint/25 bg-mint-wash">
                  <MessageCircle className="size-4 text-mint" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-bone">WhatsApp</span>
                  <span className="block text-xs text-muted">
                    Quickest for anything happening right now
                  </span>
                </span>
              </a>
            ) : null}

            <a
              href={mailto}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-sky/25 bg-sky-wash">
                <Mail className="size-4 text-sky" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-bone">Email</span>
                <span className="block truncate text-xs text-muted">{email}</span>
              </span>
            </a>

            {phone ? (
              <a
                href={`tel:${phone}`}
                className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised">
                  <Phone className="size-4 text-muted" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-bone">Call us</span>
                  <span className="block truncate text-xs text-muted">{phone}</span>
                </span>
              </a>
            ) : null}
          </Card>
        </section>

        <p className="px-1 pb-2 text-xs leading-relaxed text-faint">
          Support cannot change a restaurant&apos;s menu, prices or opening hours — those
          belong to the restaurant. What support can do is chase an order, look at a
          payment, look into a complaint and put cash-at-the-gate back on an account.
        </p>
      </div>
    </>
  );
}
