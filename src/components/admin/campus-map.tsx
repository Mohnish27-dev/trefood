"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMapEvents } from "react-leaflet";

/**
 * The campus map. Leaflet + OpenStreetMap.
 *
 * No API key and no billing, which is the entire reason it is not Google Maps.
 * The only map surfaces in this product are this editor and a static gate pin,
 * and neither justifies a metered SDK.
 *
 * This module touches `window` on import — Leaflet does so at module scope —
 * so it is the ONE place in the codebase loaded through `next/dynamic` with
 * `ssr: false`. Importing it directly from a Server Component crashes the
 * render, which is why the wrapper in `zone-editor.tsx` exists.
 *
 * Geofence drawing is click-to-add-point rather than `leaflet-draw`. Drawing a
 * campus boundary is a once-a-year task done by one person, and a hand-rolled
 * polygon click handler is forty lines against a plugin plus its type
 * definitions plus its CSS.
 */

export interface MapZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isActive: boolean;
  isFallback: boolean;
}

/**
 * Markers are `divIcon`s rather than Leaflet's default image pins.
 *
 * The default icon resolves its PNGs by URL at runtime, which every bundler
 * breaks differently — the classic "marker is a broken image" bug. Inline HTML
 * has no such dependency, costs no request, and takes the palette.
 */
function pin(zone: MapZone): L.DivIcon {
  const colour = !zone.isActive ? "#5a6274" : zone.isFallback ? "#34d399" : "#ff6b1a";
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${colour};border:2px solid #0b0d12;box-shadow:0 0 0 2px ${colour}55"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function CampusMap({
  center,
  zones,
  polygon,
  drawing,
  draftPoints,
  onMapClick,
  onZoneClick,
}: {
  center: { lat: number; lng: number };
  zones: MapZone[];
  /** The saved boundary, as [lng, lat] GeoJSON pairs. */
  polygon: [number, number][] | null;
  drawing: boolean;
  /** Points added so far in this drawing session, as [lat, lng]. */
  draftPoints: [number, number][];
  onMapClick: (lat: number, lng: number) => void;
  onZoneClick: (zoneId: string) => void;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={16}
      scrollWheelZoom
      className="h-[28rem] w-full rounded-2xl border border-line"
      // Leaflet paints its own background; without this the dark page shows
      // through the tile gaps while they load.
      style={{ background: "#12151d" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickCatcher enabled={drawing} onMapClick={onMapClick} />

      {polygon && polygon.length >= 3 ? (
        <Polygon
          // GeoJSON is [lng, lat]; Leaflet wants [lat, lng]. Getting this
          // backwards puts NIT Patna in the Indian Ocean.
          positions={polygon.map(([lng, lat]) => [lat, lng] as [number, number])}
          pathOptions={{ color: "#ff6b1a", weight: 2, fillOpacity: 0.06 }}
        />
      ) : null}

      {draftPoints.length >= 2 ? (
        <Polyline
          positions={draftPoints}
          pathOptions={{ color: "#fbbf24", weight: 2, dashArray: "6 6" }}
        />
      ) : null}

      {draftPoints.map((point, index) => (
        <Marker
          key={`draft-${index}`}
          position={point}
          icon={L.divIcon({
            className: "",
            html: `<span style="display:block;width:10px;height:10px;border-radius:9999px;background:#fbbf24;border:2px solid #0b0d12"></span>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
          })}
        />
      ))}

      {zones.map((zone) => (
        <Marker
          key={zone.id}
          position={[zone.lat, zone.lng]}
          icon={pin(zone)}
          eventHandlers={{ click: () => onZoneClick(zone.id) }}
        />
      ))}
    </MapContainer>
  );
}

function ClickCatcher({
  enabled,
  onMapClick,
}: {
  enabled: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (enabled) onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}
