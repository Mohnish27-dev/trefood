import { MapPin } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/states";
import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { PickupLocationPicker } from "@/components/student/account/pickup-location-picker";
import type { ZoneOption } from "@/components/student/zone-picker";
import { getCampusBySlug, listRestaurantsForZone } from "@/server/services/catalog";
import {
  checkCampusCurfews,
  curfewMessageWithFallback,
  formatMinutes,
} from "@/server/services/curfew";
import { DEFAULT_CAMPUS_SLUG } from "@/lib/routes";

export const metadata: Metadata = { title: "Pickup location" };
export const dynamic = "force-dynamic";

/**
 * Pickup location.
 *
 * The curfew verdicts are computed exactly the way the browse header computes
 * them — same optimistic bound, fastest prep time on campus — so a gate that
 * reads "open" here cannot read "closed" there thirty seconds later. Checkout
 * still re-runs the guard against the real restaurant, which is the two-layer
 * design, not a duplicate.
 */
export default async function PickupLocationPage() {
  // The gate lives in a cookie, not on the user, so this screen works signed
  // out too — and it is the first thing a new student needs to set.
  const campus = await getCampusBySlug(DEFAULT_CAMPUS_SLUG);

  if (!campus) {
    return (
      <>
        <SubPageHeader title="Pickup location" />
        <EmptyState
          icon={MapPin}
          title="No campus configured"
          description="Gates are set up per campus, and this one is not live yet. Contact support if you think that is wrong."
        />
      </>
    );
  }

  const now = new Date();
  const restaurants = await listRestaurantsForZone(campus, null, now);
  const fastestPrep =
    restaurants.length > 0 ? Math.min(...restaurants.map((r) => r.prepMinutes)) : 15;

  const report = checkCampusCurfews({
    now,
    timezone: campus.timezone,
    zones: campus.zones.filter((z) => z.isActive),
    prepMinutes: fastestPrep,
    transitMinutes: campus.settings.transitMinutes,
    bufferMinutes: campus.settings.curfewBufferMinutes,
  });

  const zones: ZoneOption[] = campus.zones
    .filter((z) => z.isActive)
    .map((zone) => {
      const verdict = report.verdicts.find((v) => v.zoneId === zone.id);
      return {
        id: zone.id,
        name: zone.name,
        zoneType: zone.zoneType,
        curfewLabel: zone.curfewMinutes === null ? null : formatMinutes(zone.curfewMinutes),
        available: verdict?.available ?? true,
        blockedMessage: verdict ? curfewMessageWithFallback(verdict, report.fallbackZone) : null,
        instructions: zone.instructions,
      };
    });

  return (
    <>
      <SubPageHeader title="Pickup location" />
      <PickupLocationPicker
        campusSlug={campus.slug}
        campusName={campus.name}
        zones={zones}
      />
    </>
  );
}
