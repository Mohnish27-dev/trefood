/**
 * Identifiers.
 *
 * Mongo stores `ObjectId`; this package types every id as a `string`, because
 * `shared` is imported by the browser and must never depend on the `mongodb` driver.
 * The backend converts at the database boundary — `ObjectId` inside `db/`, `string`
 * everywhere else — which is also exactly what the API serialises over the wire.
 */
export type Id = string;

/**
 * An ISO-8601 timestamp string.
 *
 * Dates cross the HTTP boundary as strings, so the shared types say so rather than
 * pretending a `Date` survives `JSON.stringify`. The backend parses to `Date` at the
 * database boundary; the frontend parses with `date-fns` where it needs to compute.
 */
export type IsoDateTime = string;

/**
 * Minutes from midnight, campus-local. `1290` is 21:30. `60` is 01:00 — which means
 * the NEXT day.
 *
 * Curfews are stored this way, and never as a `Date` or an ISO string, because of the
 * timezone trap in docs/FAILURES_AND_EDGE_CASES.md §F11: a curfew is a wall-clock
 * fact about a gate, not an instant in time. Comparisons must always happen in the
 * campus timezone, never UTC and never the server clock.
 */
export type MinutesFromMidnight = number;

/** A GeoJSON polygon, as stored on the campus document. */
export interface GeoPolygon {
  type: "Polygon";
  /** [longitude, latitude] pairs — GeoJSON order, which is the reverse of Google Maps. */
  coordinates: Array<Array<[number, number]>>;
}

/** A single [longitude, latitude] point. */
export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}
