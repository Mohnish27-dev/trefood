import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ZoneEditor, type EditorZone } from "@/components/admin/zone-editor";
import { requireAdmin } from "@/server/auth/session";
import { getCampusById } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Gates" };
export const dynamic = "force-dynamic";

export default async function AdminZonesPage({
  params,
}: {
  params: Promise<{ campusId: string }>;
}) {
  await requireAdmin();

  const { campusId } = await params;
  const campus = await getCampusById(campusId);
  if (!campus) notFound();

  const zones: EditorZone[] = campus.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    zoneType: zone.zoneType,
    curfewMinutes: zone.curfewMinutes,
    opensMinutes: zone.opensMinutes,
    lat: zone.lat,
    lng: zone.lng,
    instructions: zone.instructions,
    isActive: zone.isActive,
    isFallback: zone.isFallback,
  }));

  return (
    <>
      <header className="mb-5">
        <Link
          href="/admin/campuses"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-bone"
        >
          <ArrowLeft className="size-4" />
          All campuses
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-bone">
          {campus.name} — gates
        </h1>
        <p className="mt-1 text-sm text-muted">
          A wrong curfew here is a rider standing at a locked gate. Verify these on foot.
        </p>
      </header>

      <ZoneEditor
        campusId={campus._id}
        campusName={campus.name}
        center={campus.center}
        zones={zones}
        geofence={campus.geofence?.coordinates[0] ?? null}
      />
    </>
  );
}
