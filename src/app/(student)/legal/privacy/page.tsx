import type { Metadata } from "next";

import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { LastUpdated, Prose, ProseList, ProseSection } from "@/components/student/account/prose";
import { clientEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy policy" };

/**
 * Privacy.
 *
 * Describes what the software genuinely stores, which is a short list: an
 * identity, a phone number, orders, and a gate. Anything TREFOOD does not hold
 * is said plainly — card details in particular, because "we take security
 * seriously" tells a student nothing and "the gateway holds it, we never see
 * it" tells them exactly what happens in a breach.
 */
export default function PrivacyPolicyPage() {
  return (
    <>
      <SubPageHeader title="Privacy policy" />

      <div className="space-y-5 p-4">
        <LastUpdated date="6 September 2026" />

        <Prose>
          <p>
            This policy covers what TREFOOD stores about you, why, and who else sees it. It
            is short because the service collects little: an ordering app needs to know who
            you are, how to reach you, and where to bring the food.
          </p>

          <ProseSection heading="What we store">
            <ProseList
              items={[
                "Your name, email address and phone number. The email identifies your account; the phone number is what a restaurant rings when they cannot find you at the gate.",
                "Your orders — items, prices, timings, the gate you chose, and how you paid.",
                "Your delivery gate, kept on your device so the restaurant list is right when you come back.",
                "Your favourites, stored on your account so they follow you to a new phone.",
                "If you set an app lock, a one-way hash of your PIN. The PIN itself is never stored and cannot be recovered from the hash — only checked against it.",
                "Basic technical records of requests to the service, used to find faults and abuse.",
              ]}
            />
          </ProseSection>

          <ProseSection heading="What we never store">
            <p>
              Card numbers, UPI credentials and bank details. Payments go directly to a
              licensed payment gateway, which holds those details under its own terms.
              TREFOOD receives only a reference for the payment and whether it succeeded,
              which is why there is no saved-cards screen in this app.
            </p>
            <p>
              There is no location tracking. Delivery is to a fixed campus gate you pick
              yourself, so the app has no reason to ask where your phone is and does not.
            </p>
          </ProseSection>

          <ProseSection heading="Who else sees it">
            <ProseList
              items={[
                "The restaurant you ordered from sees your name, your phone number, your order and your gate — everything needed to cook it and hand it over, and nothing else.",
                "The payment gateway sees what it needs to take the payment.",
                "Campus administrators of the service see orders, disputes and account standing in order to run it.",
                "Nobody else. Your data is not sold, and it is not shared for advertising.",
              ]}
            />
          </ProseSection>

          <ProseSection heading="Notifications">
            <p>
              If you turn on notifications, your browser gives us a subscription token so a
              message can be pushed to that device. It is used only for your own order
              updates and is deleted when you turn notifications off or the browser
              invalidates it.
            </p>
          </ProseSection>

          <ProseSection heading="How long it is kept">
            <p>
              Order records are kept for as long as they may be needed for accounting,
              settlement with restaurants, and any dispute or refund arising from them.
              Profile details are kept while your account exists.
            </p>
          </ProseSection>

          <ProseSection heading="Your choices">
            <ProseList
              items={[
                "Edit your name and phone number any time from your account screen.",
                "Turn notifications off from Preferences, or in your browser's site settings.",
                "Remove the app lock from your account screen, which deletes the stored PIN hash and any registered biometric credential.",
                "Ask for a copy of your data, or for your account to be closed, by writing to support.",
              ]}
            />
          </ProseSection>

          <ProseSection heading="Contact">
            <p>
              Privacy questions and data requests go to{" "}
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
