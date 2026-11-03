import { MapPinned } from "lucide-react";
import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { AddCampusDialog } from "@/components/admin/add-campus-dialog";
import { CampusCards, type CampusCardItem } from "@/components/admin/campus-cards";
import { isFullAdmin } from "@/lib/constants";
import { requireStaff } from "@/server/auth/session";
import { listAllCampuses } from "@/server/services/admin";

export const metadata: Metadata = { title: "Campuses" };
export const dynamic = "force-dynamic";

/**
 * The campus management list.
 *
 * A second campus is a database row and never a code change — every domain
 * document carries a campusId, so multi-tenancy is a filter rather than a
 * migration. Admins can add and configure new campuses with custom premises,
 * curfews, coordinates, and boundaries.
 */
export default async function AdminCampusesPage() {
  const session = await requireStaff();
  const canManage = isFullAdmin(session.role);
  const campuses = await listAllCampuses();

  const campusItems: CampusCardItem[] = campuses.map((c) => ({
    _id: c._id,
    slug: c.slug,
    name: c.name,
    city: c.city,
    timezone: c.timezone,
    center: c.center,
    geofence: c.geofence,
    zones: c.zones,
    isActive: c.isActive,
  }));

  return (
    <>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-bone">Campuses & gates</h1>
          <p className="mt-1 text-sm text-muted">
            Gates, curfews and handover instructions. Add new college campuses and manage their premises.
          </p>
        </div>
        <AddCampusDialog canManage={canManage} />
      </header>

      {campusItems.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={MapPinned}
            title="No campuses yet"
            description="Add your first college campus and define its gates to start delivering."
            action={<AddCampusDialog canManage={canManage} />}
          />
        </Card>
      ) : (
        <CampusCards campuses={campusItems} canManage={canManage} />
      )}
    </>
  );
}
