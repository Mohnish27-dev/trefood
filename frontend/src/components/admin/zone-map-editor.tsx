"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoPolygon, IDeliveryZone } from "@trefood/shared";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

interface ZoneMapEditorProps {
  center: [number, number];
  geofence: GeoPolygon | null;
  zones: IDeliveryZone[];
  onGeofenceChange: (geofence: GeoPolygon | null) => void;
  onPinDropped: (longitude: number, latitude: number) => void;
}

/**
 * The campus geofence and gate-pin editor.
 *
 * Leaflet + OpenStreetMap raster tiles — no API key, no billing account, no usage
 * cap. Maps appear in exactly two places in TREFOOD and neither needs a paid tier:
 * here, and a static pin on the student's gate screen. There is no routing, no
 * directions, and no live position to draw, because riders carry no device
 * (docs/DECISIONS.md §3).
 *
 * ── Why vanilla Leaflet rather than react-leaflet ──
 * `leaflet-draw` predates hooks and mutates the map imperatively. The React wrappers
 * for it are unmaintained against current react-leaflet, and gluing them together
 * produces a component that breaks on every dependency bump. Driving Leaflet directly
 * in one effect is less code, and the imperative API is the real one.
 *
 * ── GeoJSON coordinate order ──
 * GeoJSON is [longitude, latitude]. Leaflet is [latitude, longitude]. They are
 * reversed, and swapping them puts NIT Patna in the Indian Ocean. Every conversion
 * below is explicit for that reason.
 */
export function ZoneMapEditor({
  center,
  geofence,
  zones,
  onGeofenceChange,
  onPinDropped,
}: ZoneMapEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        // Dynamic import: Leaflet touches `window` at module scope, so it cannot be
        // imported during server rendering.
        const L = (await import("leaflet")).default;
        await import("leaflet-draw");
        if (cancelled) return;

        const map = L.map(container).setView(center, 16);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        // Re-draw an existing geofence, converting GeoJSON [lng,lat] to Leaflet [lat,lng].
        const ring = geofence?.coordinates[0];
        if (ring !== undefined) {
          const latLngs = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
          drawnItems.addLayer(L.polygon(latLngs, { color: "#c2410c" }));
        }

        for (const zone of zones) {
          const [lng, lat] = zone.location.coordinates;
          L.marker([lat, lng])
            .addTo(map)
            .bindTooltip(zone.name, { permanent: false });
        }

        const drawControl = new L.Control.Draw({
          edit: { featureGroup: drawnItems, remove: true },
          draw: {
            // Only a polygon is meaningful for a campus boundary. Offering circles
            // and rectangles invites a shape the backend cannot store as a geofence.
            polygon: { allowIntersection: false, showArea: true },
            polyline: false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: {},
          },
        });
        map.addControl(drawControl);

        function readPolygon(layer: L.Layer): GeoPolygon | null {
          if (!(layer instanceof L.Polygon)) return null;
          const latLngs = layer.getLatLngs()[0];
          if (!Array.isArray(latLngs)) return null;
          const points = (latLngs as L.LatLng[]).map(
            (point) => [point.lng, point.lat] as [number, number],
          );
          const first = points[0];
          if (first === undefined) return null;
          // GeoJSON rings must close: the last point repeats the first.
          return { type: "Polygon", coordinates: [[...points, first]] };
        }

        map.on(L.Draw.Event.CREATED, (event) => {
          const layer = (event as unknown as { layer: L.Layer }).layer;
          if (layer instanceof L.Marker) {
            const { lat, lng } = layer.getLatLng();
            layer.addTo(map);
            onPinDropped(lng, lat);
            return;
          }
          // One boundary per campus: a new polygon replaces the old one rather than
          // stacking a second, ambiguous shape.
          drawnItems.clearLayers();
          drawnItems.addLayer(layer);
          onGeofenceChange(readPolygon(layer));
        });

        map.on(L.Draw.Event.EDITED, () => {
          const [layer] = drawnItems.getLayers();
          onGeofenceChange(layer === undefined ? null : readPolygon(layer));
        });

        map.on(L.Draw.Event.DELETED, () => onGeofenceChange(null));

        setStatus("ready");
        cleanup = () => map.remove();
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // Intentionally mount-only: Leaflet owns the DOM node after this, and re-running
    // would tear down and rebuild the map under the admin's cursor mid-draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[28rem] w-full rounded-lg border"
        // Leaflet needs a concrete height before it will render tiles.
        style={{ minHeight: "28rem" }}
      />
      {status === "loading" ? (
        <p className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
          Loading map…
        </p>
      ) : null}
      {status === "failed" ? (
        <p className="text-status-failed absolute inset-0 flex items-center justify-center text-sm">
          The map could not load. Zones can still be edited in the list below.
        </p>
      ) : null}
    </div>
  );
}
