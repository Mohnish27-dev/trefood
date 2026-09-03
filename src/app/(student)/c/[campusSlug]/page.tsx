import { Store } from "lucide-react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/states";
import { CampusRestaurantFeed } from "@/components/student/campus-restaurant-feed";
import { ZonePicker, type ZoneOption } from "@/components/student/zone-picker";
import { zoneCookieName } from "@/lib/cookies";
import { getCampusBySlug, listRestaurantsForZone } from "@/server/services/catalog";
import {
  checkCampusCurfews,
  curfewMessageWithFallback,
  formatMinutes,
} from "@/server/services/curfew";

// Restaurant availability and curfew verdicts both depend on the clock, so
// this page can never be statically cached.
export const dynamic = "force-dynamic";

export default async function RestaurantListPage({ params }: PageProps<"/c/[campusSlug]">) {
  const { campusSlug } = await params;
  const campus = await getCampusBySlug(campusSlug);
  if (!campus) notFound();

  const cookieStore = await cookies();
  const storedZoneId = cookieStore.get(zoneCookieName(campusSlug))?.value ?? null;
  const selectedZone = campus.zones.find((z) => z.id === storedZoneId) ?? null;
  const zoneId = selectedZone?.id ?? null;

  const now = new Date();

  /**
   * Curfew verdicts for every gate, computed with the FASTEST prep time on
   * campus. This is the optimistic bound: it answers "could anything at all
   * still reach this gate?", which is the right question for a gate picker.
   * Checkout re-runs the same guard against the chosen restaurant's real prep
   * time, so a zone that passes here can still be refused later — with a
   * specific reason, which is the whole point of the two-layer design.
   */
  const restaurants = await listRestaurantsForZone(campus, zoneId, now);
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

  const zoneOptions: ZoneOption[] = campus.zones
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
      <ZonePicker
        campusSlug={campusSlug}
        campusName={campus.name}
        zones={zoneOptions}
        selectedZoneId={zoneId}
      />

      <div className="px-4 py-4">
        {selectedZone === null ? (
          <EmptyState
            icon={Store}
            title="Pick your gate first"
            description="Restaurants declare which gates they deliver to, so choosing yours decides what you can order. Tap “Deliver to” above."
          />
        ) : restaurants.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Nothing reaches this gate yet"
            description={`No restaurant currently delivers to ${selectedZone.name}. Try the main campus gate, which every restaurant serves.`}
          />
        ) : (
          <CampusRestaurantFeed
            campusSlug={campusSlug}
            transitMinutes={campus.settings.transitMinutes}
            restaurants={restaurants}
          />
        )}
      </div>
    </>
  );
}
