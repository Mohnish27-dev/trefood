import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CheckoutView, type CheckoutZone } from "@/components/student/checkout-view";
import { CAMPUS_COOKIE, zoneCookieName } from "@/lib/cookies";
import { getSession } from "@/server/auth/session";
import { getCampusBySlug } from "@/server/services/catalog";
import {
  checkCampusCurfews,
  curfewMessageWithFallback,
  formatMinutes,
} from "@/server/services/curfew";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const campusSlug = cookieStore.get(CAMPUS_COOKIE)?.value ?? "nit-patna";

  const campus = await getCampusBySlug(campusSlug);
  if (!campus) redirect("/");

  const session = await getSession();
  const selectedZoneId = cookieStore.get(zoneCookieName(campusSlug))?.value ?? null;

  /**
   * Curfew verdicts, computed with the campus median prep time. The authoritative
   * check runs again server-side inside `placeOrder`, against the chosen
   * restaurant's real prep time — the client is never authorisation, and the
   * clock moves between rendering this page and tapping the button.
   */
  const report = checkCampusCurfews({
    now: new Date(),
    timezone: campus.timezone,
    zones: campus.zones.filter((z) => z.isActive),
    prepMinutes: 20,
    transitMinutes: campus.settings.transitMinutes,
    bufferMinutes: campus.settings.curfewBufferMinutes,
  });

  const zones: CheckoutZone[] = campus.zones
    .filter((z) => z.isActive)
    .map((zone) => {
      const verdict = report.verdicts.find((v) => v.zoneId === zone.id);
      return {
        id: zone.id,
        name: zone.name,
        instructions: zone.instructions,
        available: verdict?.available ?? true,
        blockedMessage: verdict ? curfewMessageWithFallback(verdict, report.fallbackZone) : null,
        curfewLabel: zone.curfewMinutes === null ? null : formatMinutes(zone.curfewMinutes),
      };
    });

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-14 items-center border-b border-line bg-ink/95 px-4 backdrop-blur-lg pt-safe">
        <h1 className="font-display text-base font-semibold text-bone">Checkout</h1>
      </header>

      <CheckoutView
        zones={zones}
        selectedZoneId={selectedZoneId}
        codBlockedReason={
          session?.user.codBlocked === true
            ? (session.user.codBlockedReason ??
              "Cash on delivery is disabled on your account.")
            : null
        }
        initialPhone={session?.user.phone ?? ""}
      />
    </>
  );
}
