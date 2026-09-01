import type { GeoPoint } from "./types/common.js";

/**
 * Coordinate formatting.
 *
 * This module exists to be the ONE documented exception to the project-wide ban on
 * `toFixed`. That ban protects money, where a float is always a bug — but a latitude
 * genuinely is a float, and rounding one for display is correct.
 *
 * Keeping the exception here, behind a named function, means the money rule stays
 * absolute and every legitimate use is visible in one place. Weakening the lint rule
 * instead would have quietly re-opened the money path.
 *
 * Five decimal places is about 1.1 metres — the right precision for a gate pin, and
 * more than a hand-held GPS reading is worth.
 */
const GATE_PRECISION = 5;

export function formatCoordinate(value: number): string {
  // eslint-disable-next-line no-restricted-properties -- see the note above: this is geography, not money.
  return value.toFixed(GATE_PRECISION);
}

/**
 * Renders a point as `latitude, longitude` for a human.
 *
 * Note the ORDER FLIP. GeoJSON stores [longitude, latitude]; every map app, every
 * paste into Google Maps, and every person says latitude first. Swapping them puts
 * NIT Patna in the Indian Ocean, so the conversion happens once, here.
 */
export function formatGeoPoint(point: GeoPoint): string {
  const [longitude, latitude] = point.coordinates;
  return `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
}
