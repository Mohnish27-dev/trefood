import { PRICING_DEFAULTS, TIMERS } from "../constants.js";
import { paise, rupees } from "../money.js";
import type { ICampus } from "../types/index.js";

/**
 * NIT Patna, with five delivery zones.
 *
 * ⚠️ THE COORDINATES AND CURFEW TIMES BELOW ARE PLACEHOLDERS.
 *
 * docs/MASTER_PROMPT_PRD.md Part 8 item 4 is explicit that the real gates, curfews
 * and coordinates must be captured by walking the campus, and that "this data is the
 * product". These values are shaped correctly so the UI can be built against them;
 * they are not survey data, and Phase 7 replaces every one of them.
 *
 * The curfew SHAPES are the point, and they are the ones the product must handle:
 * a 21:30 girls' hostel, a 22:00 boys' hostel, a 19:00 academic block, and a 24×7
 * main gate that everything can fall back to.
 */

/** 21:30 → 21×60 + 30. Stored as minutes from midnight, campus-local (F11). */
const at = (hour: number, minute: number): number => hour * 60 + minute;

export const MAIN_GATE_ZONE_ID = "zone-main-gate";
export const GANGA_BOYS_ZONE_ID = "zone-ganga-boys";
export const KAVERI_GIRLS_ZONE_ID = "zone-kaveri-girls";
export const ACADEMIC_BLOCK_ZONE_ID = "zone-academic-a";
export const BRAHMAPUTRA_BOYS_ZONE_ID = "zone-brahmaputra-boys";

export const nitPatnaCampus: ICampus = {
  _id: "campus-nitp",
  slug: "nit-patna",
  name: "NIT Patna",
  city: "Patna",
  timezone: "Asia/Kolkata",

  geofence: {
    type: "Polygon",
    coordinates: [
      [
        [85.1762, 25.6221],
        [85.1801, 25.6221],
        [85.1801, 25.6190],
        [85.1762, 25.6190],
        [85.1762, 25.6221],
      ],
    ],
  },

  zones: [
    {
      zoneId: MAIN_GATE_ZONE_ID,
      name: "Main Campus Gate",
      zoneType: "MAIN_GATE",
      // No curfew. This is what makes it eligible as the fallback zone (F11).
      location: { type: "Point", coordinates: [85.1779, 25.6205] },
      instructions: "Guard desk, immediately inside the main gate. Open 24×7.",
      isActive: true,
    },
    {
      zoneId: GANGA_BOYS_ZONE_ID,
      name: "Ganga Boys Hostel — Main Gate",
      zoneType: "HOSTEL_BOYS",
      curfewMinutes: at(22, 0),
      location: { type: "Point", coordinates: [85.1788, 25.6213] },
      instructions: "Hand over at the gate. Do not enter the hostel block.",
      isActive: true,
    },
    {
      zoneId: KAVERI_GIRLS_ZONE_ID,
      name: "Kaveri Girls Hostel — Gate 1",
      zoneType: "HOSTEL_GIRLS",
      // The tightest curfew on campus, and the one the guard exists for.
      curfewMinutes: at(21, 30),
      location: { type: "Point", coordinates: [85.1770, 25.6216] },
      instructions: "Hand over to the security desk at Gate 1. No entry past the gate.",
      isActive: true,
    },
    {
      zoneId: ACADEMIC_BLOCK_ZONE_ID,
      name: "Academic Block A",
      zoneType: "ACADEMIC",
      curfewMinutes: at(19, 0),
      location: { type: "Point", coordinates: [85.1785, 25.6198] },
      instructions: "Ground-floor entrance, near the notice board.",
      isActive: true,
    },
    {
      zoneId: BRAHMAPUTRA_BOYS_ZONE_ID,
      name: "Brahmaputra Boys Hostel",
      zoneType: "HOSTEL_BOYS",
      curfewMinutes: at(22, 0),
      location: { type: "Point", coordinates: [85.1795, 25.6208] },
      instructions: "Hand over at the gate.",
      isActive: true,
    },
  ],

  settings: {
    deliveryFeePaise: rupees(15),
    commissionPct: PRICING_DEFAULTS.commissionPct,
    gatewayFeePct: PRICING_DEFAULTS.gatewayFeePct,
    codHandlingFeePaise: paise(PRICING_DEFAULTS.codHandlingFeePaise),

    // Placeholder: Part 8 item 3 requires the real figure before launch.
    transitMinutes: 8,

    vendorAckSeconds: TIMERS.vendorAckExpirySeconds,
    gateGraceSeconds: TIMERS.gateGraceSeconds,

    couponFundedBy: PRICING_DEFAULTS.couponFundedBy,
    roundingMode: PRICING_DEFAULTS.roundingMode,

    fallbackZoneId: MAIN_GATE_ZONE_ID,
  },

  isActive: true,
};
