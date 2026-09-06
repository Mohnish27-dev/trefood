import { Clock, MapPin, ShieldCheck, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/shared/logo";
import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { Prose, ProseSection } from "@/components/student/account/prose";
import { clientEnv } from "@/lib/env";

export const metadata: Metadata = { title: "About TREFOOD" };

/**
 * About.
 *
 * The product's own argument for existing, which is worth writing down: the
 * mainstream apps are built around a rider with a map, and a campus is built
 * around a gate with a curfew. Everything unusual in this app — the gate
 * picker in the header, the gate code, the fifteen-minute window — falls out of
 * that one difference.
 */
export default function AboutPage() {
  return (
    <>
      <SubPageHeader title="About TREFOOD" />

      <div className="space-y-5 p-4">
        <Card className="relative overflow-hidden p-5 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-20 h-40 bg-[radial-gradient(60%_100%_at_50%_100%,rgb(255_107_26/0.18),transparent_70%)]"
          />
          <div className="relative flex flex-col items-center">
            <BrandLogo size="lg" showText={false} />
            <p className="mt-3 font-display text-lg font-bold tracking-tight text-bone">
              TREFOOD
            </p>
            <p className="mt-1 text-sm text-muted">Food, to your gate.</p>
          </div>
        </Card>

        <Prose>
          <ProseSection heading="Why this exists">
            <p>
              Every mainstream food app is built around a rider on a map. A campus is not
              built that way. Food arrives at a gate, a guard is standing there, the hostel
              shuts at a fixed time, and nobody is riding to your room. Bolting a campus
              onto an app designed for city streets produces exactly the frustrations
              students already know: an order accepted at 11:40 for a gate that locks at
              midnight, a rider circling a block he cannot enter, a delivery marked complete
              that never reached anyone.
            </p>
            <p>
              TREFOOD starts from the gate instead. That single decision is why this app
              looks slightly unusual, and why each unusual part is deliberate.
            </p>
          </ProseSection>
        </Prose>

        <div className="space-y-2">
          <Fact
            icon={MapPin}
            title="The gate comes first"
            body="Restaurants declare which gates they will deliver to, so choosing yours genuinely changes what you can order. That is why the gate picker sits at the top of the list rather than hiding at checkout."
          />
          <Fact
            icon={Clock}
            title="Curfews are respected"
            body="If food could not realistically reach your hostel before its gate closes, the order is refused with a reason instead of taken and then failed."
          />
          <Fact
            icon={ShieldCheck}
            title="A code, not a signature"
            body="Handover is confirmed by a short code you read out. It is the loudest thing on the order screen, because it is the moment that matters."
          />
          <Fact
            icon={Store}
            title="The restaurant delivers"
            body="Food is carried by the restaurant's own staff, who already know the campus. There is no live map because there is no third rider to track — you are told the moment it reaches the gate."
          />
        </div>

        <Prose>
          <ProseSection heading="How the money works">
            <p>
              Restaurants set their own prices. TREFOOD takes a commission on each order,
              which is how it pays for itself, and settles the rest to the restaurant. The
              payment gateway&apos;s convenience fee is passed straight through and is
              never TREFOOD&apos;s revenue. Nothing about the split changes what you pay
              after you have seen the total.
            </p>
          </ProseSection>

          <ProseSection heading="Where it runs">
            <p>
              TREFOOD is live on the NIT Patna campus. If you run a canteen or a restaurant
              near a campus and want to be on it, or you want it on yours, write to{" "}
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

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-2 text-xs text-muted">
          <Link href="/legal/terms" className="hover:text-bone">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-bone">
            Privacy
          </Link>
          <Link href="/legal/refunds" className="hover:text-bone">
            Refunds
          </Link>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Fact({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-saffron/25 bg-saffron-wash">
          <Icon className="size-4 text-saffron" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-bone">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
        </div>
      </div>
    </Card>
  );
}
