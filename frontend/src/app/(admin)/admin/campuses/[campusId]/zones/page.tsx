"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, Trash2 } from "lucide-react";
import {
  ZONE_TYPES,
  formatClock,
  formatCoordinate,
  nitPatnaCampus,
  type GeoPolygon,
  type IDeliveryZone,
  type ZoneType,
} from "@trefood/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLocalStorage } from "@/hooks/use-local-storage";

/**
 * Leaflet touches `window` at module scope, so it must not be server-rendered.
 * `ssr: false` is not a performance choice here — importing it on the server throws.
 */
const ZoneMapEditor = dynamic(
  () => import("@/components/admin/zone-map-editor").then((mod) => mod.ZoneMapEditor),
  { ssr: false, loading: () => <div className="bg-muted h-[28rem] animate-pulse rounded-lg" /> },
);

interface DraftState {
  geofence: GeoPolygon | null;
  zones: IDeliveryZone[];
}

/** `21:30` → 1290. Curfews are stored as minutes from midnight, campus-local. */
function parseClock(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

export default function CampusZonesPage() {
  const campus = nitPatnaCampus;

  /**
   * Draft edits persist to localStorage until Phase 7 wires the backend.
   *
   * The Phase 4 exit gate asks for a drawn polygon and five gate pins that SURVIVE a
   * reload — which is also the honest test of the editor: a geofence you cannot come
   * back to is not an editor, it is a drawing toy.
   */
  const { value: draft, setValue: setDraft } = useLocalStorage<DraftState>(
    `trefood.admin.campus.${campus._id}`,
    { geofence: campus.geofence, zones: campus.zones },
  );

  const [newZone, setNewZone] = useState({
    name: "",
    zoneType: "HOSTEL_BOYS" as ZoneType,
    curfew: "",
    instructions: "",
  });
  const [pendingPin, setPendingPin] = useState<[number, number] | null>(null);

  function addZone() {
    if (newZone.name.trim() === "" || pendingPin === null) return;
    const curfewMinutes = newZone.curfew.trim() === "" ? undefined : parseClock(newZone.curfew);

    setDraft((current) => ({
      ...current,
      zones: [
        ...current.zones,
        {
          zoneId: `zone-${Date.now()}`,
          name: newZone.name.trim(),
          zoneType: newZone.zoneType,
          ...(curfewMinutes === undefined ? {} : { curfewMinutes }),
          location: { type: "Point", coordinates: pendingPin },
          instructions: newZone.instructions.trim() || undefined,
          isActive: true,
        },
      ],
    }));

    setNewZone({ name: "", zoneType: "HOSTEL_BOYS", curfew: "", instructions: "" });
    setPendingPin(null);
  }

  const isCurfewValid =
    newZone.curfew.trim() === "" || parseClock(newZone.curfew) !== undefined;

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">{campus.name} — gates &amp; geofence</h1>
        <p className="text-muted-foreground text-sm">
          Draw the campus boundary, then drop a pin for each gate. Walk the campus and
          record the real coordinates — this data is the product.
        </p>
      </div>

      <ZoneMapEditor
        center={[25.6205, 85.1779]}
        geofence={draft.geofence}
        zones={draft.zones}
        onGeofenceChange={(geofence) => setDraft((current) => ({ ...current, geofence }))}
        onPinDropped={(longitude, latitude) => setPendingPin([longitude, latitude])}
      />

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Add a gate</h2>
        {pendingPin === null ? (
          <p className="text-muted-foreground text-sm">
            Use the marker tool on the map to drop a pin, then name the gate here.
          </p>
        ) : (
          <p className="text-status-done flex items-center gap-1 text-sm">
            <Check className="size-4" aria-hidden />
            Pin dropped at {formatCoordinate(pendingPin[1])}, {formatCoordinate(pendingPin[0])}
          </p>
        )}

        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label htmlFor="zone-name">Gate name</Label>
            <Input
              id="zone-name"
              value={newZone.name}
              onChange={(event) => setNewZone({ ...newZone, name: event.target.value })}
              placeholder="Ganga Boys Hostel — Main Gate"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="zone-type">Type</Label>
            <select
              id="zone-type"
              value={newZone.zoneType}
              onChange={(event) =>
                setNewZone({ ...newZone, zoneType: event.target.value as ZoneType })
              }
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {ZONE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="zone-curfew">Curfew (24h)</Label>
            <Input
              id="zone-curfew"
              value={newZone.curfew}
              onChange={(event) => setNewZone({ ...newZone, curfew: event.target.value })}
              placeholder="21:30 — blank for 24×7"
            />
            {/* A curfew after midnight (01:00) means the NEXT day, and the guard
                handles it. Saying so here prevents an admin "fixing" it to 25:00. */}
            <p className="text-muted-foreground text-xs">
              {isCurfewValid ? "01:00 means after midnight." : "Use HH:MM, e.g. 21:30."}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="zone-instructions">Handover instructions</Label>
            <Input
              id="zone-instructions"
              value={newZone.instructions}
              onChange={(event) => setNewZone({ ...newZone, instructions: event.target.value })}
              placeholder="Hand over at the guard desk"
            />
          </div>
        </div>

        <Button
          disabled={newZone.name.trim() === "" || pendingPin === null || !isCurfewValid}
          onClick={addZone}
        >
          Add gate
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Gates ({draft.zones.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-xs uppercase">
            <tr>
              <th className="py-2 text-start font-medium">Name</th>
              <th className="py-2 text-start font-medium">Type</th>
              <th className="py-2 text-start font-medium">Curfew</th>
              <th className="py-2 text-start font-medium">Coordinates</th>
              <th className="py-2 text-start font-medium">Instructions</th>
              <th className="py-2 text-end font-medium">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {draft.zones.map((zone) => (
              <tr key={zone.zoneId}>
                <td className="py-2 font-medium">
                  {zone.name}
                  {zone.zoneId === campus.settings.fallbackZoneId ? (
                    <span className="text-brand block text-xs">fallback gate</span>
                  ) : null}
                </td>
                <td className="text-muted-foreground">{zone.zoneType}</td>
                <td>
                  {zone.curfewMinutes === undefined ? (
                    <span className="text-status-done">24×7</span>
                  ) : (
                    formatClock(zone.curfewMinutes)
                  )}
                </td>
                <td className="text-muted-foreground font-mono text-xs">
                  {formatCoordinate(zone.location.coordinates[1])},{" "}
                  {formatCoordinate(zone.location.coordinates[0])}
                </td>
                <td className="text-muted-foreground max-w-xs truncate text-xs">
                  {zone.instructions ?? "—"}
                </td>
                <td className="text-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${zone.name}`}
                    // The fallback gate cannot be removed: F11 reroutes to it when a
                    // gate shuts mid-flight, and a campus without one has no way out.
                    disabled={zone.zoneId === campus.settings.fallbackZoneId}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        zones: current.zones.filter((z) => z.zoneId !== zone.zoneId),
                      }))
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Separator />
      <p className="text-muted-foreground text-xs">
        Draft edits are saved in this browser. Persisting to the database arrives in
        Phase 7.
      </p>
    </main>
  );
}
