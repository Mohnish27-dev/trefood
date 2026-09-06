import { MessageSquareMore } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { FaqGroup, FaqItem } from "@/components/student/account/prose";

export const metadata: Metadata = { title: "Help centre" };

/**
 * Help centre.
 *
 * Written against the failure list, not against a marketing FAQ. Every
 * question here is one a student has actually had at a gate at midnight: the
 * code, the countdown, the item that ran out, the food that never came. Each
 * answer says what the system does, not what we wish it did.
 */
export default function HelpCentrePage() {
  return (
    <>
      <SubPageHeader title="Help centre" />

      <div className="space-y-5 p-4">
        <p className="px-1 text-sm leading-relaxed text-muted">
          The short answers to what usually goes wrong. If yours is not here, support is a
          tap away and answers in plain language.
        </p>

        <section className="space-y-2">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Getting your food
          </h2>
          <FaqGroup>
            <FaqItem question="What is the gate code?">
              <p>
                A short code shown on your order screen. Read it out to the person
                delivering — it is how they know the food is going to the right student,
                and it is the loudest thing on that screen for exactly that reason.
              </p>
              <p>
                Never share it before your food is in your hands. Once it is given, the
                order counts as delivered.
              </p>
            </FaqItem>

            <FaqItem question="Where exactly do I collect from?">
              <p>
                Your gate — the one under &ldquo;Deliver to&rdquo;. Delivery is by the
                restaurant&apos;s own staff, so there is no rider tracking and no live map.
                What you get instead is a notification the moment the food reaches the
                gate, and the order screen keeps updating even if that notification never
                arrives.
              </p>
            </FaqItem>

            <FaqItem question="Why is there a countdown once my food arrives?">
              <p>
                Fifteen minutes. Whoever brought your food is standing outside with other
                orders in a bag, so the window is short on purpose. If it runs out, the
                order is closed as not collected.
              </p>
            </FaqItem>

            <FaqItem question="Why can I not order to my hostel right now?">
              <p>
                Hostel gates close at a curfew time. If the food could not realistically
                reach your gate before it shuts, that gate is blocked rather than letting
                you pay for something that would arrive at a locked door. The main campus
                gate usually stays open.
              </p>
            </FaqItem>
          </FaqGroup>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            When something goes wrong
          </h2>
          <FaqGroup>
            <FaqItem question="An item ran out while my food was being cooked">
              <p>
                You get five minutes and three choices: swap it for something else, drop
                that item and take the rest, or cancel the whole order. Money for anything
                that did not arrive comes back either way.
              </p>
              <p>
                If nobody answers in time, the item is dropped and the rest is delivered —
                the least-bad outcome, because you still eat.
              </p>
            </FaqItem>

            <FaqItem question="The restaurant did not accept my order">
              <p>
                A restaurant has a few minutes to accept. If it does not, the order expires
                on its own and everything you paid online is refunded in full. Nothing is
                left hanging.
              </p>
            </FaqItem>

            <FaqItem question="My food was wrong, missing or cold">
              <p>
                Open the order and raise a dispute within 30 minutes of delivery — long
                enough to open the bag, short enough that the food is still evidence.
                Describe what happened and add a photo if you can.
              </p>
            </FaqItem>

            <FaqItem question="I paid but the order does not show up">
              <p>
                Give it a couple of minutes: payment confirmations sometimes arrive after
                the screen does, and the system reconciles them on its own. If money left
                your account and no order exists after that, contact support with the time
                and amount — every payment is matched against an order, so it can be found.
              </p>
            </FaqItem>
          </FaqGroup>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Paying
          </h2>
          <FaqGroup>
            <FaqItem question="How does cash at the gate work?">
              <p>
                You pay a small share online when you order, and the rest in cash when you
                collect. The online part is what stops an order being placed and abandoned,
                which is the whole reason the option can exist at all.
              </p>
            </FaqItem>

            <FaqItem question="Why can I no longer pay cash?">
              <p>
                Cash is switched off after orders are left uncollected at the gate, or
                immediately if someone refuses to pay on collection. It is never a ban —
                you can order exactly the same food, paid online. Your Payments screen says
                which of those happened.
              </p>
            </FaqItem>

            <FaqItem question="When does a refund reach me?">
              <p>
                It is sent back to whatever you paid from as soon as the order is cancelled
                or a dispute goes your way. Banks take 3–5 working days to show it, which
                is their clock rather than ours. The gateway&apos;s convenience fee is not
                refundable — it was never TREFOOD&apos;s money.
              </p>
            </FaqItem>
          </FaqGroup>
        </section>

        <Link
          href="/account/support"
          className="flex min-h-14 items-center gap-3 rounded-2xl border border-saffron/25 bg-saffron-wash px-4 py-3 transition-colors hover:bg-saffron/15"
        >
          <MessageSquareMore className="size-5 shrink-0 text-saffron" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-bone">Still stuck?</span>
            <span className="block text-xs text-muted">
              Talk to a person on the support screen.
            </span>
          </span>
        </Link>
      </div>
    </>
  );
}
