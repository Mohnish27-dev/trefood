/**
 * Gate availability by the clock.
 *
 * FAILURES_AND_EDGE_CASES.md section 2, F11.
 *
 * Gates have curfews. Girls' hostels shut at 21:30, boys' at 22:00, academic
 * blocks at 19:00. A delivery that arrives four minutes late cannot be
 * completed at all — the rider stands outside a locked gate holding food.
 * So availability is checked BEFORE checkout is allowed, not after.
 *
 * The timezone trap, stated plainly:
 *
 *   Curfews are stored as MINUTES FROM MIDNIGHT, campus-local, never as a
 *   "21:30" string and never as a Date. A 01:00 curfew means *next day*, and
 *   a Date would silently carry the wrong one. Every comparison in this file
 *   goes through the campus timezone, never through the server clock — the
 *   server runs in UTC on Vercel and would be five and a half hours wrong.
 *
 * Pure: no DB, no session. Takes a `now` so tests can pin the clock.
 */

import type { DeliveryZone } from "@/types/campus";
import type { Paise } from "@/lib/money";

export const MINUTES_PER_DAY = 1_440;

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

/** Minutes from midnight in the campus timezone. The only clock reading in the system. */
export function campusLocalMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** 1290 -> "21:30". Display only. */
export function formatMinutes(minutes: number): string {
  const normalised = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.trunc(normalised / 60);
  const m = normalised % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "21:30" -> 1290. For admin input. */
export function parseMinutes(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) throw new Error(`"${hhmm}" is not a valid HH:MM time`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/* ------------------------------------------------------------------ */
/* Window arithmetic                                                   */
/* ------------------------------------------------------------------ */

type ZoneWindow = Pick<DeliveryZone, "curfewMinutes" | "opensMinutes">;

/**
 * Is the gate physically open at this minute-of-day?
 *
 * Handles a window that crosses midnight, which is the normal case for a
 * hostel that opens at 06:00 and shuts at 01:00.
 */
export function isGateOpenAt(zone: ZoneWindow, minuteOfDay: number): boolean {
  if (zone.curfewMinutes === null) return true; // 24x7

  const opens = zone.opensMinutes;
  const closes = zone.curfewMinutes;
  if (opens === closes) return true; // a full 24-hour window

  return opens < closes
    ? minuteOfDay >= opens && minuteOfDay < closes
    : minuteOfDay >= opens || minuteOfDay < closes; // crosses midnight
}

/**
 * Minutes from `now` until this gate shuts. `Infinity` for a 24x7 gate,
 * `0` if it is already shut.
 */
export function minutesUntilClose(zone: ZoneWindow, nowMinutes: number): number {
  if (zone.curfewMinutes === null) return Number.POSITIVE_INFINITY;
  if (!isGateOpenAt(zone, nowMinutes)) return 0;

  const closes = zone.curfewMinutes;
  // The next occurrence of the curfew strictly after now. If the curfew hour
  // has already passed today, the gate we are inside shuts tomorrow.
  const closesAt = closes > nowMinutes ? closes : closes + MINUTES_PER_DAY;
  return closesAt - nowMinutes;
}

/* ------------------------------------------------------------------ */
/* The guard                                                           */
/* ------------------------------------------------------------------ */

export interface CurfewCheckInput {
  now: Date;
  timezone: string;
  zone: DeliveryZone;
  /** The restaurant's prep estimate. */
  prepMinutes: number;
  /** Campus transit time, restaurant to gate. */
  transitMinutes: number;
  /** Arrival inside this many minutes of the curfew is refused. Default 10. */
  bufferMinutes: number;
}

export type CurfewBlockCode = "ZONE_INACTIVE" | "GATE_SHUT_NOW" | "ARRIVES_TOO_LATE";

export interface CurfewVerdict {
  zoneId: string;
  available: boolean;
  /** Set only when `available` is false. */
  code: CurfewBlockCode | null;
  /** Plain-language, student-facing. Never jargon; this is read at checkout. */
  message: string | null;
  /** Minute-of-day the food is expected to reach the gate, campus-local. */
  estimatedArrivalMinutes: number;
  /** Minutes remaining before this gate shuts. `null` for a 24x7 gate. */
  minutesUntilClose: number | null;
  /**
   * The last minute-of-day an order could still be placed for this gate today.
   * Drives the "Order by 20:45" half of the message. `null` for a 24x7 gate,
   * or when the window has already passed.
   */
  orderByMinutes: number | null;
}

/**
 * Layer 1 of F11 — the pre-checkout guard, which prevents roughly 95% of cases.
 *
 *   estimatedArrival = now + prepMinutes + transitMinutes
 *   if estimatedArrival > (curfew - buffer): block this zone
 *
 * Layer 2 (the in-flight reroute to the fallback gate) lives in the order
 * service, because it needs to write a status and push the student.
 */
export function checkCurfew(input: CurfewCheckInput): CurfewVerdict {
  const { zone, prepMinutes, transitMinutes, bufferMinutes } = input;
  const nowMinutes = campusLocalMinutes(input.now, input.timezone);
  const travelMinutes = prepMinutes + transitMinutes;
  const estimatedArrivalMinutes = (nowMinutes + travelMinutes) % MINUTES_PER_DAY;

  if (!zone.isActive) {
    return {
      zoneId: zone.id,
      available: false,
      code: "ZONE_INACTIVE",
      message: `${zone.name} is not accepting deliveries right now.`,
      estimatedArrivalMinutes,
      minutesUntilClose: null,
      orderByMinutes: null,
    };
  }

  // A 24x7 gate short-circuits: it is the fallback the others point at.
  if (zone.curfewMinutes === null) {
    return {
      zoneId: zone.id,
      available: true,
      code: null,
      message: null,
      estimatedArrivalMinutes,
      minutesUntilClose: null,
      orderByMinutes: null,
    };
  }

  const untilClose = minutesUntilClose(zone, nowMinutes);
  const curfewLabel = formatMinutes(zone.curfewMinutes);

  // The last minute an order placed *now* could still be started. Negative
  // means the window has already gone.
  const orderByRaw = zone.curfewMinutes - bufferMinutes - travelMinutes;
  const orderByMinutes = untilClose > 0 && orderByRaw >= 0 ? orderByRaw : null;

  if (untilClose === 0) {
    return {
      zoneId: zone.id,
      available: false,
      code: "GATE_SHUT_NOW",
      message: `${zone.name} is closed. The gate shuts at ${curfewLabel}.`,
      estimatedArrivalMinutes,
      minutesUntilClose: 0,
      orderByMinutes: null,
    };
  }

  // The buffer is what makes this useful rather than merely correct: an order
  // that arrives at 21:29 for a 21:30 curfew is a coin flip, and a coin flip
  // at a hostel gate is a refund and an angry student.
  if (travelMinutes + bufferMinutes > untilClose) {
    return {
      zoneId: zone.id,
      available: false,
      code: "ARRIVES_TOO_LATE",
      message:
        `${zone.name} gate closes at ${curfewLabel}. This order would arrive at about ` +
        `${formatMinutes(estimatedArrivalMinutes)}, too close to be safe.`,
      estimatedArrivalMinutes,
      minutesUntilClose: untilClose,
      orderByMinutes,
    };
  }

  return {
    zoneId: zone.id,
    available: true,
    code: null,
    message: null,
    estimatedArrivalMinutes,
    minutesUntilClose: untilClose,
    orderByMinutes,
  };
}

/* ------------------------------------------------------------------ */
/* Whole-campus view                                                   */
/* ------------------------------------------------------------------ */

export interface CampusCurfewReport {
  verdicts: CurfewVerdict[];
  /** The 24x7 gate offered whenever another zone is blocked. */
  fallbackZone: DeliveryZone | null;
}

/**
 * Every zone at once, plus the fallback to offer.
 *
 * The checkout screen must never merely disable a zone: it has to say why, in
 * plain language, and hand the student the 24x7 alternative in the same breath.
 * "Ganga Girls Hostel gate closes at 21:30. Order by 20:45, or choose Main
 * Campus Gate (open 24x7)."
 */
export function checkCampusCurfews(
  input: Omit<CurfewCheckInput, "zone"> & { zones: readonly DeliveryZone[] },
): CampusCurfewReport {
  const verdicts = input.zones.map((zone) => checkCurfew({ ...input, zone }));
  const fallbackZone =
    input.zones.find((z) => z.isFallback && z.isActive && z.curfewMinutes === null) ?? null;
  return { verdicts, fallbackZone };
}

/** The full student-facing sentence, fallback included. */
export function curfewMessageWithFallback(
  verdict: CurfewVerdict,
  fallbackZone: DeliveryZone | null,
): string | null {
  if (verdict.available || verdict.message === null) return null;

  const parts = [verdict.message];
  if (verdict.orderByMinutes !== null) {
    parts.push(`Order by ${formatMinutes(verdict.orderByMinutes)}.`);
  }
  if (fallbackZone) {
    parts.push(`Or choose ${fallbackZone.name}, open 24x7.`);
  }
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Time formatting and dynamic minimum order                           */
/* ------------------------------------------------------------------ */

/** 630 -> "10:30 AM", 60 -> "1:00 AM", 1320 -> "10:00 PM" */
export function formatTime12h(minutes: number): string {
  const normalised = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h24 = Math.trunc(normalised / 60);
  const m = normalised % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export interface MinOrderInfo {
  minOrderPaise: Paise;
  isLateNight: boolean;
}

/**
 * Calculates the active minimum order for a restaurant at the given time.
 * For example, Chai Sutta Bar requires min order of ₹300 after 12:00 AM (midnight to closing at 1:00 AM),
 * and ₹40/₹50 during regular daytime hours.
 */
export function getEffectiveMinOrderPaise(
  restaurant: {
    minOrderPaise: Paise;
    lateNightMinOrderPaise?: Paise | null;
    lateNightStartMinutes?: number | null;
    lateNightEndMinutes?: number | null;
    closesMinutes?: number | null;
  },
  nowMinutes: number,
): MinOrderInfo {
  if (
    restaurant.lateNightMinOrderPaise !== undefined &&
    restaurant.lateNightMinOrderPaise !== null &&
    restaurant.lateNightMinOrderPaise > 0
  ) {
    const start = restaurant.lateNightStartMinutes ?? 0;
    const end = restaurant.lateNightEndMinutes ?? restaurant.closesMinutes ?? 60;
    const isLateNight =
      start < end
        ? nowMinutes >= start && nowMinutes < end
        : nowMinutes >= start || nowMinutes < end;

    if (isLateNight) {
      return { minOrderPaise: restaurant.lateNightMinOrderPaise, isLateNight: true };
    }
  }

  return { minOrderPaise: restaurant.minOrderPaise, isLateNight: false };
}

