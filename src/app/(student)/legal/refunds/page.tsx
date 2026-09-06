import type { Metadata } from "next";

import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { LastUpdated, Prose, ProseList, ProseSection } from "@/components/student/account/prose";
import { clientEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Refund & cancellation policy" };

/**
 * Refunds and cancellations.
 *
 * The dividing line in every clause here is whether food has been cooked. Before
 * that, a cancellation costs nobody anything and the money goes back. After it,
 * someone has spent stock and labour on an order, and a refund has to be earned
 * by something having actually gone wrong.
 */
export default function RefundPolicyPage() {
  return (
    <>
      <SubPageHeader title="Refund & cancellation policy" />

      <div className="space-y-5 p-4">
        <LastUpdated date="6 September 2026" />

        <Prose>
          <p>
            One rule runs through all of this: before food is cooked, cancelling costs
            nobody anything and your money comes back. Once it is cooked, someone has
            already paid for the ingredients and the time.
          </p>

          <ProseSection heading="Cancelling before the restaurant accepts">
            <p>
              Full refund of everything paid online. An order that a restaurant never
              accepts also expires by itself, with the same full refund — you do not have
              to chase it.
            </p>
          </ProseSection>

          <ProseSection heading="Cancelling after the restaurant accepts">
            <p>
              Once cooking has started an order cannot be cancelled from the app. If you
              have a genuine reason, contact support — it is decided case by case, and the
              honest answer is that food already made is rarely refundable.
            </p>
          </ProseSection>

          <ProseSection heading="When the restaurant cannot deliver">
            <p>
              If a restaurant rejects an accepted order, closes before dispatching it, or
              cannot deliver for any reason of its own, you get a full refund of everything
              paid online. You are never charged for food that was never made.
            </p>
          </ProseSection>

          <ProseSection heading="When an item runs out mid-cook">
            <ProseList
              items={[
                "Swap it — you pay the difference, or are refunded it, depending on the substitute.",
                "Drop it — that item is refunded and the rest of the order is delivered.",
                "Cancel — the whole order is refunded.",
                "No answer within a few minutes — the item is dropped and refunded, and the rest is delivered, so that you still eat.",
              ]}
            />
          </ProseSection>

          <ProseSection heading="When the food is wrong">
            <p>
              Contact support as soon as you can, with your order number and what went
              wrong. Where the complaint is upheld you are refunded for the affected
              items, or for the whole order where the whole order was unusable.
              Photographs help and are usually decisive.
            </p>
          </ProseSection>

          <ProseSection heading="When food is not collected">
            <p>
              Food that reaches the gate and is not collected within the window is not
              refunded. It was cooked, carried and waited for. If you paid online you have
              paid for it; if it was a cash order, the online share is kept and a strike is
              recorded against your account.
            </p>
          </ProseSection>

          <ProseSection heading="The convenience fee">
            <p>
              The gateway&apos;s convenience fee is charged by the payment provider for
              processing the transaction and is never refunded, including on a full refund
              of the food. It was never TREFOOD&apos;s money to return.
            </p>
          </ProseSection>

          <ProseSection heading="How long refunds take">
            <p>
              A refund is sent back to whatever you paid from as soon as it is approved.
              Banks and UPI providers then take 3–5 working days to show it, which is their
              clock rather than ours. If a refund fails at the gateway it is retried
              automatically, and support can see every attempt.
            </p>
          </ProseSection>

          <ProseSection heading="Contact">
            <p>
              Refund questions go to{" "}
              <a
                href={`mailto:${clientEnv.NEXT_PUBLIC_SUPPORT_EMAIL}`}
                className="font-medium text-saffron underline-offset-4 hover:underline"
              >
                {clientEnv.NEXT_PUBLIC_SUPPORT_EMAIL}
              </a>
              . Include the order number — every refund is tied to one.
            </p>
          </ProseSection>
        </Prose>
      </div>
    </>
  );
}
