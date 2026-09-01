import { MapPinned } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { requireAdmin } from "@/server/auth/session";
import { listAllCampuses } from "@/server/services/admin";
import { formatMinutes } from "@/server/services/curfew";

export const metadata: Metadata = { title: "Campuses" };
export const dynamic = "force-dynamic";

/**
 * The campus list.
 *
 * A second campus is a database row and never a code change — every domain
 * document carries a campusId, so multi-tenancy is a filter rather than a
 * migration. This page is the proof: nothing here is special-cased for NIT
 * Patna.
 */
export default async function AdminCampusesPage() {
  await requireAdmin();
  const campuses = await listAllCampuses();

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-xl font-semibold text-bone">Campuses & gates</h1>
        <p className="mt-1 text-sm text-muted">
          Gates, curfews and handover instructions. This data is the product — walk the campus
          and record it properly.
        </p>
      </header>

      {campuses.length === 0 ? (
        <Card>
          <EmptyState
            icon={MapPinned}
            title="No campuses yet"
            description="Run the seed to create NIT Patna with its five gates, then edit them here."
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {campuses.map((campus) => {
            const active = campus.zones.filter((zone) => zone.isActive);
            const fallback = active.find((zone) => zone.isFallback);

            return (
              <Link
                key={campus._id}
                href={`/admin/campuses/${campus._id}/zones`}
                className="group block"
              >
                <Card className="p-4 transition-colors group-hover:border-saffron/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-bone">
                        {campus.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {campus.city} · {campus.timezone}
                      </p>
                    </div>
                    {campus.isActive ? (
                      <Badge tone="success">Live</Badge>
                    ) : (
                      <Badge tone="neutral">Off</Badge>
                    )}
                  </div>

                  <ul className="mt-3 space-y-1">
                    {active.map((zone) => (
                      <li key={zone.id} className="flex justify-between gap-3 text-xs">
                        <span className="truncate text-bone">{zone.name}</span>
                        <span className="shrink-0 tabular text-muted">
                          {zone.curfewMinutes === null
                            ? "24×7"
                            : formatMinutes(zone.curfewMinutes)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Without a 24x7 fallback the curfew guard has nothing to
                      offer a student whose gate just shut, which turns a
                      helpful message into a dead end. */}
                  {fallback === undefined ? (
                    <p className="mt-3 rounded-lg border border-amber/30 bg-amber-wash px-2.5 py-1.5 text-[11px] text-amber">
                      No 24×7 fallback gate. Blocked zones will have no alternative to offer.
                    </p>
                  ) : null}

                  {campus.geofence === null ? (
                    <p className="mt-2 text-[11px] text-faint">Boundary not drawn yet.</p>
                  ) : null}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
