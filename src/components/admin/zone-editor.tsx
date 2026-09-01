"use client";

import { Loader2, MapPin, Pencil, Plus, Save, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { saveGeofence, saveZone, toggleZoneActive } from "@/server/actions/admin";
import { ZONE_TYPE, type ZoneType } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Leaflet touches `window` at module scope, so the map is the one component in
 * this codebase that must not be server-rendered. Everything else on the page
 * renders normally; only the canvas waits for the client.
 */
const CampusMap = dynamic(() => import("./campus-map").then((mod) => mod.CampusMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[28rem] w-full rounded-2xl" />,
});

export interface EditorZone {
  id: string;
  name: string;
  zoneType: ZoneType;
  curfewMinutes: number | null;
  opensMinutes: number;
  lat: number;
  lng: number;
  instructions: string;
  isActive: boolean;
  isFallback: boolean;
}

const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  [ZONE_TYPE.HOSTEL_BOYS]: "Boys' hostel",
  [ZONE_TYPE.HOSTEL_GIRLS]: "Girls' hostel",
  [ZONE_TYPE.ACADEMIC]: "Academic block",
  [ZONE_TYPE.MAIN_GATE]: "Main gate",
  [ZONE_TYPE.RESIDENTIAL]: "Residential",
};

/**
 * The gate editor.
 *
 * This screen holds the data the product is built on. A wrong curfew here does
 * not produce a rendering bug — it produces a rider standing outside a locked
 * hostel at 21:34 holding food nobody can take. That is why the form insists
 * on handover instructions, why the fallback gate must be 24×7, and why every
 * save writes an audit entry.
 *
 * Curfews are entered as HH:MM and stored as minutes from midnight. A gate
 * that shuts at 01:00 means *next day*, and a Date would silently carry the
 * wrong one.
 */
export function ZoneEditor({
  campusId,
  campusName,
  center,
  zones: initialZones,
  geofence,
}: {
  campusId: string;
  campusName: string;
  center: { lat: number; lng: number };
  zones: EditorZone[];
  geofence: [number, number][] | null;
}) {
  const [zones, setZones] = useState(initialZones);
  const [editing, setEditing] = useState<EditorZone | null>(null);
  const [saving, setSaving] = useState(false);

  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);

  /* ── Zone form ────────────────────────────────────────────────── */

  const startNew = (): void =>
    setEditing({
      id: "",
      name: "",
      zoneType: ZONE_TYPE.HOSTEL_BOYS,
      curfewMinutes: 22 * 60,
      opensMinutes: 0,
      lat: center.lat,
      lng: center.lng,
      instructions: "",
      isActive: true,
      isFallback: false,
    });

  const submitZone = async (): Promise<void> => {
    if (!editing) return;
    setSaving(true);

    const result = await saveZone({
      campusId,
      zoneId: editing.id,
      name: editing.name,
      zoneType: editing.zoneType,
      curfewMinutes: editing.curfewMinutes,
      opensMinutes: editing.opensMinutes,
      lat: editing.lat,
      lng: editing.lng,
      instructions: editing.instructions,
      isActive: editing.isActive,
      isFallback: editing.isFallback,
    });
    setSaving(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
    // Reflect the change locally rather than round-tripping: the server has
    // already revalidated, and this keeps the map from flickering.
    setZones((prev) => {
      const next = prev.filter((zone) => zone.id !== editing.id);
      return [...next, { ...editing, id: editing.id || `pending-${Date.now()}` }];
    });
    setEditing(null);
  };

  const toggleActive = async (zone: EditorZone): Promise<void> => {
    const next = !zone.isActive;
    setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, isActive: next } : z)));

    const result = await toggleZoneActive({ campusId, zoneId: zone.id, isActive: next });
    if (result.status === "error") {
      setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, isActive: !next } : z)));
      toast.error(result.message);
    } else {
      toast.success(result.message);
    }
  };

  /* ── Geofence ─────────────────────────────────────────────────── */

  const onMapClick = (lat: number, lng: number): void => {
    if (drawing) {
      setDraft((prev) => [...prev, [lat, lng]]);
      return;
    }
    // Not drawing? Then a click is placing the gate being edited.
    if (editing) setEditing({ ...editing, lat, lng });
  };

  const commitGeofence = async (): Promise<void> => {
    setSaving(true);
    const result = await saveGeofence({
      campusId,
      // Back to GeoJSON order on the way out.
      coordinates: draft.length >= 3 ? draft.map(([lat, lng]) => [lng, lat] as [number, number]) : null,
    });
    setSaving(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setDrawing(false);
    setDraft([]);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
      {/* ── Map ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <CampusMap
          center={center}
          zones={zones}
          polygon={drawing ? null : geofence}
          drawing={drawing}
          draftPoints={draft}
          onMapClick={onMapClick}
          onZoneClick={(zoneId) => {
            const zone = zones.find((z) => z.id === zoneId);
            if (zone) setEditing(zone);
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          {drawing ? (
            <>
              <span className="text-xs text-amber">
                Click the map to trace the boundary — {draft.length} point
                {draft.length === 1 ? "" : "s"} so far, three minimum.
              </span>
              <Button
                size="sm"
                disabled={draft.length < 3 || saving}
                onClick={() => void commitGeofence()}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                Save boundary
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft([])}>
                Clear points
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDrawing(false);
                  setDraft([]);
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setDrawing(true)}>
                <Pencil />
                {geofence ? "Redraw boundary" : "Draw boundary"}
              </Button>
              {editing ? (
                <span className="text-xs text-muted">
                  Click the map to place {editing.name || "this gate"}.
                </span>
              ) : (
                <span className="text-xs text-faint">
                  Saffron pins are gates, mint is the 24×7 fallback, grey is closed.
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Gate list and form ───────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-bone">
            {campusName} gates
            <span className="ml-2 text-xs font-normal text-faint">{zones.length}</span>
          </h2>
          <Button size="sm" onClick={startNew}>
            <Plus />
            Add a gate
          </Button>
        </div>

        {editing ? (
          <ZoneForm
            zone={editing}
            saving={saving}
            onChange={setEditing}
            onCancel={() => setEditing(null)}
            onSave={() => void submitZone()}
          />
        ) : null}

        <div className="space-y-2">
          {zones.map((zone) => (
            <Card key={zone.id} className={cn("p-3", !zone.isActive && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-bone">
                    <MapPin className="size-3.5 shrink-0 text-saffron" />
                    {zone.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {ZONE_TYPE_LABELS[zone.zoneType]} ·{" "}
                    {zone.curfewMinutes === null
                      ? "open 24×7"
                      : `shuts ${minutesToLabel(zone.curfewMinutes)}`}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-faint">
                    {zone.instructions}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {zone.isFallback ? <Badge tone="success">Fallback</Badge> : null}
                  <Switch
                    checked={zone.isActive}
                    onCheckedChange={() => void toggleActive(zone)}
                    aria-label={`${zone.name} accepting deliveries`}
                  />
                  <button
                    type="button"
                    onClick={() => setEditing(zone)}
                    className="text-xs text-muted hover:text-bone"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ZoneForm({
  zone,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  zone: EditorZone;
  saving: boolean;
  onChange: (zone: EditorZone) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const isTwentyFourSeven = zone.curfewMinutes === null;

  return (
    <Card className="space-y-3 p-4">
      <p className="font-display text-sm font-semibold text-bone">
        {zone.id ? "Edit gate" : "New gate"}
      </p>

      <div>
        <Label htmlFor="zone-name">Name</Label>
        <Input
          id="zone-name"
          value={zone.name}
          onChange={(event) => onChange({ ...zone, name: event.target.value })}
          placeholder="Ganga Boys Hostel"
        />
      </div>

      <div>
        <Label htmlFor="zone-type">Type</Label>
        <Select
          id="zone-type"
          value={zone.zoneType}
          onChange={(event) => onChange({ ...zone, zoneType: event.target.value as ZoneType })}
        >
          {Object.entries(ZONE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
        <div>
          <p className="text-sm text-bone">Open 24×7</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            The gate every blocked zone falls back to.
          </p>
        </div>
        <Switch
          checked={isTwentyFourSeven}
          onCheckedChange={(next) =>
            onChange({ ...zone, curfewMinutes: next ? null : 22 * 60, isFallback: next && zone.isFallback })
          }
          aria-label="Open around the clock"
        />
      </div>

      {!isTwentyFourSeven ? (
        <div className="grid grid-cols-2 gap-3">
          <TimeField
            id="zone-opens"
            label="Opens"
            minutes={zone.opensMinutes}
            onChange={(minutes) => onChange({ ...zone, opensMinutes: minutes })}
          />
          <TimeField
            id="zone-curfew"
            label="Curfew"
            minutes={zone.curfewMinutes ?? 22 * 60}
            onChange={(minutes) => onChange({ ...zone, curfewMinutes: minutes })}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
          <div>
            <p className="text-sm text-bone">Use as the campus fallback</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              Offered by name whenever a curfew blocks another gate. Exactly one per campus.
            </p>
          </div>
          <Switch
            checked={zone.isFallback}
            onCheckedChange={(next) => onChange({ ...zone, isFallback: next })}
            aria-label="Campus fallback gate"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="zone-lat">Latitude</Label>
          <Input
            id="zone-lat"
            type="number"
            step="0.000001"
            value={zone.lat}
            onChange={(event) => onChange({ ...zone, lat: Number(event.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="zone-lng">Longitude</Label>
          <Input
            id="zone-lng"
            type="number"
            step="0.000001"
            value={zone.lng}
            onChange={(event) => onChange({ ...zone, lng: Number(event.target.value) })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="zone-instructions">Handover instructions</Label>
        <Textarea
          id="zone-instructions"
          value={zone.instructions}
          onChange={(event) => onChange({ ...zone, instructions: event.target.value })}
          placeholder="Wait at the main gate barrier, left of the guard desk."
          maxLength={200}
        />
        <p className="mt-1 text-[11px] leading-relaxed text-faint">
          Printed on every kitchen ticket. Whoever carries the packet reads this and nothing
          else.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          disabled={saving || zone.name.trim().length < 2 || zone.instructions.trim().length < 3}
          onClick={onSave}
        >
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Save gate
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <Trash2 />
          Discard
        </Button>
      </div>
    </Card>
  );
}

function TimeField({
  id,
  label,
  minutes,
  onChange,
}: {
  id: string;
  label: string;
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        value={minutesToLabel(minutes)}
        onChange={(event) => {
          const [hours, mins] = event.target.value.split(":");
          const parsed = Number(hours) * 60 + Number(mins);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
      />
    </div>
  );
}

function minutesToLabel(minutes: number): string {
  return `${String(Math.trunc(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
