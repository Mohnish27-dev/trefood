import { TIMERS } from "./constants.js";
import type { MinutesFromMidnight } from "./types/common.js";

/**
 * The curfew guard — pure clock arithmetic, no database and no clock of its own.
 *
 * Lives in `shared` for the same reason `money.ts` does: the backend ENFORCES the
 * rule at checkout, and the frontend must show the same answer live in the zone
 * picker without a round-trip per second. If the two computed it separately they
 * would disagree, and a student would be offered a gate the server then refuses.
 *
 * Phase 7's `backend/src/services/curfew.ts` is the authoritative caller — it looks
 * up the campus, resolves the timezone, and decides. This file only does the maths.
 *
 * ⚠️ THE TIMEZONE TRAP (docs/FAILURES_AND_EDGE_CASES.md §F11): every value here is
 * minutes from midnight in the CAMPUS timezone. Never pass UTC minutes, and never
 * pass the server clock. A curfew is a wall-clock fact about a physical gate.
 */

/**
 * When a campus "day" starts, for the purpose of interpreting a curfew.
 *
 * A curfew of 01:00 means one in the morning of the NEXT day — the gate is open
 * through the evening and shuts after midnight. A curfew of 21:30 means tonight.
 * Splitting at 04:00 separates the two cases, and it is safely outside TREFOOD's
 * demand window: the late cluster runs 22:30–02:30 and nothing is open at 4 AM.
 */
const DAY_START_MINUTES = 4 * 60;

/** Places a wall-clock time onto a continuous timeline starting at DAY_START. */
function onDayTimeline(minutes: MinutesFromMidnight): number {
  return minutes >= DAY_START_MINUTES ? minutes : minutes + 24 * 60;
}

export interface CurfewCheckInput {
  /** Now, in minutes from midnight, campus-local. */
  nowMinutes: MinutesFromMidnight;
  /** The zone's curfew. `undefined` means 24×7 — never blocked. */
  curfewMinutes?: MinutesFromMidnight;
  /** The restaurant's prep time. */
  prepMinutes: number;
  /** `campus.settings.transitMinutes` — kitchen to gate. */
  transitMinutes: number;
  /** Safety margin before the gate shuts. Defaults to the 10 minutes in DECISIONS §4. */
  bufferMinutes?: number;
}

export interface CurfewCheckResult {
  /** True when this zone cannot be chosen right now. */
  isBlocked: boolean;
  /** When the order would arrive, minutes from midnight, campus-local. */
  estimatedArrivalMinutes: MinutesFromMidnight;
  /**
   * The last moment a student could still place this order, or `undefined` for a
   * 24×7 zone. Drives the "Order by 20:45" half of the message.
   */
  lastOrderMinutes?: MinutesFromMidnight;
  /** Minutes of ordering time left. Negative once the window has closed. */
  minutesRemaining?: number;
}

/** Wraps a timeline value back onto a 0–1439 wall clock. */
function toWallClock(timelineMinutes: number): MinutesFromMidnight {
  return ((timelineMinutes % 1440) + 1440) % 1440;
}

/** Formats minutes from midnight as `21:30`, for UI copy. */
export function formatClock(minutes: MinutesFromMidnight): string {
  const wall = toWallClock(minutes);
  const hours = Math.floor(wall / 60);
  return `${String(hours).padStart(2, "0")}:${String(wall % 60).padStart(2, "0")}`;
}

/**
 * F11 layer 1 — the pre-checkout guard, which prevents roughly 95% of curfew cases.
 *
 *     estimatedArrival = now + prepMinutes + transitMinutes
 *     blocked if estimatedArrival > (curfew − buffer)
 *
 * A delivery that arrives four minutes late cannot be completed at all: the gate is
 * shut, the rider cannot enter, and there is nobody to hand the food to. Blocking the
 * zone up front with a plain-language reason is far kinder than taking the money and
 * discovering it at the gate.
 */
export function checkCurfew(input: CurfewCheckInput): CurfewCheckResult {
  const {
    nowMinutes,
    curfewMinutes,
    prepMinutes,
    transitMinutes,
    bufferMinutes = TIMERS.curfewBufferSeconds / 60,
  } = input;

  const travelMinutes = prepMinutes + transitMinutes;
  const nowOnTimeline = onDayTimeline(nowMinutes);
  const arrivalOnTimeline = nowOnTimeline + travelMinutes;

  // A 24×7 zone — the main gate — is what everything else falls back to.
  if (curfewMinutes === undefined) {
    return {
      isBlocked: false,
      estimatedArrivalMinutes: toWallClock(arrivalOnTimeline),
    };
  }

  const curfewOnTimeline = onDayTimeline(curfewMinutes);
  const deadline = curfewOnTimeline - bufferMinutes;
  const lastOrderOnTimeline = deadline - travelMinutes;

  return {
    isBlocked: arrivalOnTimeline > deadline,
    estimatedArrivalMinutes: toWallClock(arrivalOnTimeline),
    lastOrderMinutes: toWallClock(lastOrderOnTimeline),
    minutesRemaining: lastOrderOnTimeline - nowOnTimeline,
  };
}

/**
 * The message a blocked student actually reads.
 *
 * Plain language, the real closing time, and — critically — a way forward. A blocked
 * zone with no alternative is a dead end; the 24×7 main gate always exists, and
 * offering it is the difference between a lost order and a slightly longer walk.
 */
export function curfewMessage(
  zoneName: string,
  curfewMinutes: MinutesFromMidnight,
  result: CurfewCheckResult,
  fallbackZoneName: string,
): string {
  const closes = formatClock(curfewMinutes);
  const orderBy =
    result.lastOrderMinutes === undefined ? null : formatClock(result.lastOrderMinutes);

  if (orderBy === null) {
    return `${zoneName} closes at ${closes}. Choose ${fallbackZoneName} instead.`;
  }
  return `${zoneName} gate closes at ${closes}. Order by ${orderBy}, or choose ${fallbackZoneName} (open 24×7).`;
}

/** Minutes from midnight for a `Date`, in a given IANA timezone. */
export function minutesFromMidnightIn(date: Date, timeZone: string): MinutesFromMidnight {
  // Intl is the only correct way to do this: it handles the zone without pulling in
  // a date library, and it never silently uses the server clock's offset.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}
