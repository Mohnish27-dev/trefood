"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Clock,
  Layers,
  MapPin,
  Pencil,
  Plus,
  Power,
  ShieldAlert,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { EditCampusDialog } from "./edit-campus-dialog";
import { toggleCampusActive } from "@/server/actions/admin";
import type { DeliveryZone } from "@/types/campus";
import { cn } from "@/lib/utils";

export interface CampusCardItem {
  _id: string;
  slug: string;
  name: string;
  city: string;
  timezone: string;
  center: { lat: number; lng: number };
  geofence: { type: "Polygon"; coordinates: [number, number][][] } | null;
  zones: DeliveryZone[];
  isActive: boolean;
  vendorCount?: number;
}

export function CampusCards({
  campuses,
  canManage = true,
}: {
  campuses: CampusCardItem[];
  canManage?: boolean;
}) {
  const [editingCampus, setEditingCampus] = useState<CampusCardItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (campus: CampusCardItem) => {
    if (!canManage) return;
    setTogglingId(campus._id);
    try {
      const next = !campus.isActive;
      const res = await toggleCampusActive({ campusId: campus._id, isActive: next });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
      }
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {campuses.map((campus) => {
          const activeZones = campus.zones.filter((zone) => zone.isActive);
          const fallbackZone = activeZones.find((zone) => zone.isFallback);

          return (
            <Card
              key={campus._id}
              className={cn(
                "flex flex-col justify-between p-5 transition-all border",
                campus.isActive
                  ? "border-line hover:border-saffron/40 hover:shadow-md"
                  : "border-line/60 bg-surface/50 opacity-80",
              )}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-saffron">
                        <Building2 className="size-4" />
                      </span>
                      <h2 className="font-display text-base font-semibold text-bone truncate">
                        {campus.name}
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-muted flex items-center gap-1.5 pl-9">
                      <span>{campus.city}</span>
                      <span>·</span>
                      <span className="font-mono text-[11px]">{campus.timezone}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => setEditingCampus(campus)}
                        className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-raised hover:text-bone transition-colors cursor-pointer"
                        title="Edit campus details"
                        aria-label={`Edit ${campus.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    ) : null}

                    {campus.isActive ? (
                      <Badge tone="success">Live</Badge>
                    ) : (
                      <Badge tone="neutral">Off</Badge>
                    )}
                  </div>
                </div>

                {/* Status Badges Row */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-[11px] text-muted">
                    <MapPin className="size-3 text-saffron" />
                    <span>
                      {campus.zones.length} {campus.zones.length === 1 ? "Premise" : "Premises"} /{" "}
                      {activeZones.length} Active
                    </span>
                  </span>

                  {campus.geofence ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                      <ShieldCheck className="size-3" />
                      <span>Boundary traced</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-[11px] text-faint">
                      <span>Boundary not set</span>
                    </span>
                  )}
                </div>

                {/* Gates Preview */}
                <div className="mt-4 rounded-xl border border-line/60 bg-surface-raised/30 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-bone mb-2">
                    <span className="text-muted text-[11px] uppercase tracking-wider font-bold">
                      Premises & Curfews
                    </span>
                    <Link
                      href={`/admin/campuses/${campus._id}/zones`}
                      className="text-[11px] text-saffron hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>View all</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>

                  {campus.zones.length === 0 ? (
                    <p className="py-2 text-xs text-faint italic">
                      No premises added yet. Click &quot;Manage Gates & Premises&quot; below to add hostel gates, academic blocks, or delivery spots.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {campus.zones.map((zone) => (
                        <li
                          key={zone.id}
                          className={cn(
                            "flex items-center justify-between gap-2 text-xs py-0.5",
                            !zone.isActive && "opacity-50",
                          )}
                        >
                          <span className="truncate text-bone flex items-center gap-1.5">
                            <span
                              className={cn(
                                "size-1.5 rounded-full shrink-0",
                                zone.isFallback
                                  ? "bg-emerald-400"
                                  : zone.isActive
                                    ? "bg-saffron"
                                    : "bg-muted",
                              )}
                            />
                            {zone.name}
                            {zone.isFallback ? (
                              <span className="text-[10px] text-emerald-400 font-mono">(24×7 Fallback)</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 tabular font-mono text-[11px] text-muted">
                            {zone.curfewMinutes === null
                              ? "24×7"
                              : `${String(Math.trunc(zone.curfewMinutes / 60)).padStart(2, "0")}:${String(
                                  zone.curfewMinutes % 60,
                                ).padStart(2, "0")}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Warnings */}
                {fallbackZone === undefined && campus.zones.length > 0 ? (
                  <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber/30 bg-amber-wash px-2.5 py-1.5 text-[11px] text-amber">
                    <ShieldAlert className="size-3.5 shrink-0" />
                    <span>No 24×7 fallback gate. Add or designate a 24×7 gate for curfews.</span>
                  </p>
                ) : null}
              </div>

              {/* Action Buttons Footer */}
              <div className="mt-5 pt-3.5 border-t border-line/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" className="gap-1.5">
                    <Link href={`/admin/campuses/${campus._id}/zones`}>
                      <MapPin className="size-3.5" />
                      <span>Manage Gates & Boundary</span>
                    </Link>
                  </Button>

                  <Button asChild variant="secondary" size="sm" className="gap-1.5">
                    <Link href="/admin/pricing">
                      <Sliders className="size-3.5" />
                      <span>Pricing</span>
                    </Link>
                  </Button>
                </div>

                {canManage ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      {campus.isActive ? "Active" : "Disabled"}
                    </span>
                    <Switch
                      checked={campus.isActive}
                      disabled={togglingId === campus._id}
                      onCheckedChange={() => void handleToggle(campus)}
                      aria-label={`Toggle ${campus.name} status`}
                    />
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      {editingCampus && (
        <EditCampusDialog
          campus={editingCampus}
          open={Boolean(editingCampus)}
          onOpenChange={(open) => !open && setEditingCampus(null)}
          canManage={canManage}
        />
      )}
    </>
  );
}

