import { Store, UtensilsCrossed } from "lucide-react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/states";
import { RestaurantCard } from "@/components/student/restaurant-card";
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

  const open = restaurants.filter((r) => r.isServingNow);
  const closed = restaurants.filter((r) => !r.isServingNow);

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
          <>
            <div className="mb-3 flex items-baseline justify-between">
              <h1 className="font-display text-lg font-semibold text-bone">
                {open.length} open now
              </h1>
              <p className="text-xs text-muted">
                {campus.settings.transitMinutes} min to your gate
              </p>
            </div>

            <div className="space-y-3">
              {open.map((restaurant) => (
                <RestaurantCard
                  key={restaurant._id}
                  restaurant={restaurant}
                  campusSlug={campusSlug}
                />
              ))}
            </div>

            {open.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="Everything is closed right now"
                description="Campus kitchens shut for a few hours overnight. The ones below open again later today."
              />
            ) : null}

            {/* Closed restaurants are SHOWN, greyed, at the bottom — never
                hidden. A student needs to know the place exists and is shut
                tonight, not wonder where it went. */}
            {closed.length > 0 ? (
              <section className="mt-8">
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-faint">
                    Closed right now
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                <div className="space-y-3">
                  {closed.map((restaurant) => (
                    <RestaurantCard
                      key={restaurant._id}
                      restaurant={restaurant}
                      campusSlug={campusSlug}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
