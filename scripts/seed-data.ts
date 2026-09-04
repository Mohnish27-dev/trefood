/**
 * NIT Patna seed data.
 *
 * What this seed owns — and all it owns:
 *
 *   1. the campus document with its gates and curfew times
 *   2. the admin account
 *   3. the removal of the old demo catalogue (see LEGACY below)
 *
 * Restaurants, menus and every other account are REAL data now: vendors are
 * created by the admin from /admin/vendors (which provisions their login),
 * and each vendor builds their own menu from /vendor/menu. Students are
 * auto-provisioned on their first Supabase sign-in. Nothing scripted seeds
 * them any more.
 *
 * MASTER_PROMPT_PRD.md Part 8.4 asks for the ACTUAL gates, curfew times and
 * coordinates — "walk the campus and record them; this data is the product".
 * Everything marked VERIFY ON CAMPUS below is a researched placeholder.
 * Correcting them is a data edit, not a code change.
 *
 * Ids are deterministic and readable, so re-running the seed is idempotent
 * and a Mongo dump is legible at 2 AM.
 */

import { DEFAULTS, ROLE, ZONE_TYPE } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";
import type { Campus, DeliveryZone } from "@/types/campus";
import type { User } from "@/types/user";

const R = rupeesToPaise;
const HM = (h: number, m = 0): number => h * 60 + m;

export const CAMPUS_ID = "campus_nitp";

/* ══════════════════════════════════════════════════════════════════════
   Delivery zones — GATES, not addresses.
   Handover happens at a gate because outside riders cannot enter hostels
   or academic blocks. VERIFY ON CAMPUS: names, coordinates, curfew times.
   ══════════════════════════════════════════════════════════════════════ */

export const ZONES: DeliveryZone[] = [
  {
    id: "zone_main_gate",
      name: "Main Gate of The campus",
    zoneType: ZONE_TYPE.MAIN_GATE,
    curfewMinutes: null, // 24x7 — the fallback every other zone points at
    opensMinutes: 0,
    lat: 25.6206, // VERIFY ON CAMPUS
    lng: 85.1721,
    instructions: "Wait at the security post to the right of the main barrier.",
    isActive: true,
    isFallback: true,
  },
  {
    id: "zone_boys_hostel",
    name: "Boys Hostel",
    zoneType: ZONE_TYPE.HOSTEL_BOYS,
    curfewMinutes: HM(22), // 22:00 — covers Kautilya, Nagarjuna, Aryabhatta
    opensMinutes: HM(6),
    lat: 25.6225,
    lng: 85.1725,
    instructions: "Hostel gate security cabin (covers Kautilya, Nagarjuna, and Aryabhatta). Do not enter the block.",
    isActive: true,
    isFallback: false,
  },
  {
    id: "zone_cse_dept",
    name: "CSE Department",
    zoneType: ZONE_TYPE.ACADEMIC,
    curfewMinutes: HM(19), // 19:00 — academic block closing
    opensMinutes: HM(8),
    lat: 25.6201,
    lng: 85.173,
    instructions: "Reception desk at the Computer Science & Engineering department entrance.",
    isActive: true,
    isFallback: false,
  },
  {
    id: "zone_ece_dept",
    name: "ECE Department",
    zoneType: ZONE_TYPE.ACADEMIC,
    curfewMinutes: HM(19), // 19:00 — academic block closing
    opensMinutes: HM(8),
    lat: 25.6203,
    lng: 85.1738,
    instructions: "Reception desk at the Electronics & Communication Engineering department entrance.",
    isActive: true,
    isFallback: false,
  },
  {
    id: "zone_girls_hostel",
    name: "Girls Hostel",
    zoneType: ZONE_TYPE.HOSTEL_GIRLS,
    curfewMinutes: HM(21, 30), // 21:30 — covers Kadambini and Sarojini
    opensMinutes: HM(6),
    lat: 25.6195,
    lng: 85.1748,
    instructions: "Guard cabin at Girls Hostel gate (covers Kadambini and Sarojini). Female security staff will call the student out.",
    isActive: true,
    isFallback: false,
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Campus
   ══════════════════════════════════════════════════════════════════════ */

export const CAMPUS: Campus = {
  _id: CAMPUS_ID,
  slug: "nit-patna",
  name: "NIT Patna",
  city: "Patna",
  timezone: "Asia/Kolkata",
  center: { lat: 25.6206, lng: 85.1721 },
  geofence: {
    type: "Polygon",
    coordinates: [
      [
        // A rough rectangle around the campus. The admin geofence editor
        // replaces this with a traced boundary. VERIFY ON CAMPUS.
        [85.1698, 25.6182],
        [85.1762, 25.6182],
        [85.1762, 25.6242],
        [85.1698, 25.6242],
        [85.1698, 25.6182],
      ],
    ],
  },
  zones: ZONES,
  settings: {
    deliveryFeePaise: R(15), // PRD Part 8.3 — set the real fee before launch
    commissionBps: DEFAULTS.commissionBps,
    gatewayFeeBps: DEFAULTS.gatewayFeeBps, // A3 — 0 bps: user pays for order only without convenience fees
    codHandlingFeePaise: DEFAULTS.codHandlingFeePaise,
    couponFundedBy: "PLATFORM",
    roundingMode: "CEIL",
    transitMinutes: 8, // PRD Part 8.3 — walk it and time it
    vendorAckSeconds: DEFAULTS.vendorAckSeconds,
    vendorAutoExpireSeconds: DEFAULTS.vendorAutoExpireSeconds,
    gateGraceSeconds: DEFAULTS.gateGraceSeconds,
    curfewBufferMinutes: DEFAULTS.curfewBufferMinutes,
    stockoutResolutionSeconds: DEFAULTS.stockoutResolutionSeconds,
    disputeWindowMinutes: DEFAULTS.disputeWindowMinutes,
    codEnabled: true,
  },
  isActive: true,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-01T00:00:00Z"),
};

/* ══════════════════════════════════════════════════════════════════════
   Accounts — the admin, and nothing else.
   ══════════════════════════════════════════════════════════════════════ */

export const ADMIN_EMAIL = "zaid0072khan@gmail.com";

function user(partial: Pick<User, "_id" | "role" | "name" | "email"> & Partial<User>): User {
  return {
    authId: null,
    phone: null,
    campusId: CAMPUS_ID,
    restaurantId: null,
    codBlocked: false,
    codBlockedReason: null,
    strikes: 0,
    createdAt: new Date("2026-08-10T00:00:00Z"),
    updatedAt: new Date("2026-08-10T00:00:00Z"),
    ...partial,
  };
}

export const USERS: User[] = [
  user({
    _id: "user_admin",
    role: ROLE.SUPER_ADMIN,
    name: "Zaid Khan",
    email: ADMIN_EMAIL,
    campusId: null,
  }),
];

/* ══════════════════════════════════════════════════════════════════════
   LEGACY — the old scripted demo catalogue.

   The prototype shipped with four fictional restaurants, their menus and a
   demo student so the simulation panel had something to drive. Real vendors
   are now created from the admin console, so the seed actively removes the
   old fixtures — and everything that references them — from any database it
   runs against. Idempotent: on a clean database every delete matches zero
   documents.
   ══════════════════════════════════════════════════════════════════════ */

export const LEGACY_DEMO_RESTAURANT_IDS = [
  "rest_nit_canteen",
  "rest_tandoori_nights",
  "rest_wrap_roll",
  "rest_amul_parlour",
];

export const LEGACY_DEMO_USER_IDS = ["usr_demo_student", "user_student_demo"];

/** Demo-student logins that were never tied to a deterministic id. */
export const LEGACY_DEMO_USER_EMAILS = ["aarav@nitp.ac.in"];

/** Orders placed by the /demo panel and the demo-order script. */
export const LEGACY_DEMO_ORDER_KEY_PATTERN = "^demo-";

/** The pre-real-auth admin logins, replaced by ADMIN_EMAIL above. */
export const LEGACY_ADMIN_EMAILS = ["ops@trefood.in", "mohnishpamnani08@gmail.com"];
