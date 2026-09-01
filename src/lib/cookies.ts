/**
 * Cookie names shared by the server and the client.
 *
 * Deliberately NOT in a "use client" module: the restaurant list is filtered
 * on the server, so a Server Component has to read the same cookie the picker
 * writes. Keeping the name in one neutral place is what stops the two sides
 * drifting apart silently.
 */

const ZONE_COOKIE = "trefood_zone";

export const CAMPUS_COOKIE = "trefood_campus";
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Per-campus, so a student with two campuses keeps a gate for each. */
export function zoneCookieName(campusSlug: string): string {
  return `${ZONE_COOKIE}_${campusSlug.replace(/[^a-z0-9]/gi, "_")}`;
}
