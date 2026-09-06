import type { Metadata } from "next";

import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { LastUpdated, Prose, ProseList, ProseSection } from "@/components/student/account/prose";
import { clientEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Terms & conditions" };

/**
 * Terms.
 *
 * Written to be read, not to be survived. Every clause here describes
 * something the software actually does — the gate handover, the acceptance
 * window, the strike rules — so a student who reads it understands the product
 * rather than agreeing to boilerplate.
 */
export default function TermsPage() {
  return (
    <>
      <SubPageHeader title="Terms & conditions" />

      <div className="space-y-5 p-4">
        <LastUpdated date="6 September 2026" />

        <Prose>
          <p>
            These terms cover your use of TREFOOD, a campus food ordering service. By
            placing an order you accept them. They are written in plain language on
            purpose; where a clause matters, it says what actually happens rather than
            reserving a right in the abstract.
          </p>

          <ProseSection heading="1. Who this is for">
            <p>
              TREFOOD serves students, staff and residents of the campuses it operates on.
              You need an account to order, you must be able to receive food at one of the
              listed gates, and the account is yours alone — do not order on behalf of
              someone whose gate code you cannot hand over in person.
            </p>
          </ProseSection>

          <ProseSection heading="2. What TREFOOD is">
            <p>
              TREFOOD is a marketplace. Restaurants list their own menus, set their own
              prices, cook the food and deliver it with their own staff. TREFOOD runs the
              ordering, the payments and the dispute process between you and them.
            </p>
            <p>
              This matters in one practical way: food quality, portion size and cooking
              time are the restaurant&apos;s responsibility. TREFOOD&apos;s responsibility
              is that your order reaches them correctly, that your money is handled
              correctly, and that a complaint is actually looked at.
            </p>
          </ProseSection>

          <ProseSection heading="3. Placing an order">
            <ProseList
              items={[
                "Prices are re-checked on our servers when you place an order. What you are charged is what the restaurant currently lists, never a figure sent by your phone.",
                "A restaurant has a short window to accept. If it does not, the order expires automatically and anything paid online is refunded in full.",
                "An accepted order cannot be cancelled by you once cooking has begun. Before that, a cancellation is a refund; after it, food has been made and paid for.",
                "If an item runs out mid-cook you are asked what to do and given a few minutes to answer. If you do not, that item is dropped and refunded and the rest is delivered.",
              ]}
            />
          </ProseSection>

          <ProseSection heading="4. Delivery and the gate">
            <p>
              Food is handed over at a campus gate, not at your room. When it arrives you
              have a short window — currently fifteen minutes — to collect it. Read your
              gate code to the person delivering; that code is what marks the order
              delivered, so do not share it before the food is in your hands.
            </p>
            <p>
              If the collection window runs out, the order is closed as not collected. For
              a cash order that also records a strike against your account, because someone
              cooked and carried food that nobody came for.
            </p>
            <p>
              Hostel gates have curfews. If your food could not realistically reach a gate
              before it closes, that gate is blocked at checkout rather than taking your
              money for a delivery that cannot happen.
            </p>
          </ProseSection>

          <ProseSection heading="5. Paying">
            <ProseList
              items={[
                "You can pay the whole amount online, or — when it is available on your account — pay a small share online and the rest in cash at the gate.",
                "The gateway's convenience fee is charged by the payment provider, not by TREFOOD, and is not refundable.",
                "Refusing to pay the cash portion at the gate, or leaving cash orders uncollected, switches cash payment off on your account. Online ordering is unaffected. This is never an account ban and it can be reversed by support.",
              ]}
            />
          </ProseSection>

          <ProseSection heading="6. Disputes">
            <p>
              If your food is wrong, missing or unfit to eat, raise a dispute from the order
              within 30 minutes of delivery. Describe what happened and add a photo where
              you can. Disputes are read by a person, decided against the order record, and
              a refund follows a decision in your favour.
            </p>
          </ProseSection>

          <ProseSection heading="7. Using the service fairly">
            <p>
              Do not place orders you do not intend to collect, do not use someone
              else&apos;s account or payment method, and do not attempt to interfere with
              the ordering, payment or gate-code systems. Accounts doing any of these can
              have cash payment removed or, in serious cases, be suspended.
            </p>
          </ProseSection>

          <ProseSection heading="8. Changes">
            <p>
              Restaurants, menus, gates, curfews, fees and these terms can change. Material
              changes to these terms will be shown in the app. Continuing to order after a
              change means you accept the updated terms.
            </p>
          </ProseSection>

          <ProseSection heading="9. Contact">
            <p>
              Questions about these terms go to{" "}
              <a
                href={`mailto:${clientEnv.NEXT_PUBLIC_SUPPORT_EMAIL}`}
                className="font-medium text-saffron underline-offset-4 hover:underline"
              >
                {clientEnv.NEXT_PUBLIC_SUPPORT_EMAIL}
              </a>
              .
            </p>
          </ProseSection>
        </Prose>
      </div>
    </>
  );
}
