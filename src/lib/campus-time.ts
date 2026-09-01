import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfDay } from "date-fns";

/**
 * Campus-local calendar arithmetic.
 *
 * The settlement day, the vendor's "today" earnings and the expiry counter all
 * mean *campus-local* days, not UTC ones. On Vercel the server runs in UTC, so
 * "today" there ends five and a half hours early for NIT Patna — which would
 * put every order placed between 18:30 and 23:59 IST into the wrong settlement
 * run, every single night.
 *
 * `TZDate` carries the zone with the instant, so `startOfDay` resolves in the
 * campus timezone rather than the server's. Nothing in this file reads the
 * server clock's zone, ever.
 *
 * Companion to `curfew.ts`, which does the same for minutes-from-midnight.
 */

/** "2026-09-01" for this instant, in the campus timezone. */
export function campusDateString(at: Date, timezone: string): string {
  return format(new TZDate(at, timezone), "yyyy-MM-dd");
}

/** The instant range covering one campus-local calendar day, as plain Dates for Mongo. */
export function campusDayRange(dateString: string, timezone: string): { start: Date; end: Date } {
  const start = startOfDay(new TZDate(`${dateString}T12:00:00`, timezone));
  return {
    start: new Date(start.getTime()),
    // Half-open: [start, end). Avoids the millisecond a `<=` bound would drop.
    end: new Date(addDays(start, 1).getTime()),
  };
}

export function shiftCampusDate(dateString: string, days: number): string {
  return format(addDays(new Date(`${dateString}T12:00:00Z`), days), "yyyy-MM-dd");
}

/** "01 Sep" — compact enough for a table column. */
export function formatCampusDate(dateString: string): string {
  return format(new Date(`${dateString}T12:00:00Z`), "dd MMM yyyy");
}

/** Clock time in the campus timezone, e.g. "23:07". Never the server's clock. */
export function campusClock(at: Date, timezone: string): string {
  return format(new TZDate(at, timezone), "HH:mm");
}
