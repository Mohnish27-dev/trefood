import type { Bps, Paise } from "@/lib/money";
import type { ZoneType } from "@/lib/constants";

/**
 * A delivery point. Not an address — a GATE.
 *
 * Handover happens at a gate, never at a door, because outside riders cannot
 * enter hostels or academic blocks. This is the physical fact the whole
 * product is shaped around (PRD Part 1).
 */
export interface DeliveryZone {
  id: string;
  name: string;
  zoneType: ZoneType;

  /**
   * Curfew as MINUTES FROM MIDNIGHT, campus-local. `null` means open 24x7.
   *
   * Stored as an integer, never as a "21:30" string and never as a Date,
   * because a 01:00 curfew means *next day* and a Date would silently carry
   * the wrong one. FAILURES section 2 F11, "Timezone trap".
   */
  curfewMinutes: number | null;
  /** When the gate opens, minutes from midnight. 0 for most. */
  opensMinutes: number;

  lat: number;
  lng: number;

  /** Printed on the KOT so the rider knows where to stand. */
  instructions: string;

  isActive: boolean;

  /**
   * The 24x7 gate this campus falls back to when a curfew blocks a zone at
   * checkout, or closes while the rider is in transit. Exactly one zone per
   * campus should carry this.
   */
  isFallback: boolean;
}

/** All the levers from DECISIONS.md section 4, per campus. */
export interface CampusSettings {
  /** D5 — flat fee per campus. Student pays it; it flows to the vendor. */
  deliveryFeePaise: Paise;
  /** D6 — charged on food + packaging + delivery. */
  commissionBps: Bps;
  /** A3 — convenience fee passed to the student. Non-refundable. */
  gatewayFeeBps: Bps;
  /** A7 — off by default. */
  codHandlingFeePaise: Paise;
  /** A1 — platform-funded coupons mean the vendor is paid on the pre-discount base. */
  couponFundedBy: "PLATFORM" | "VENDOR";
  /** A4. */
  roundingMode: "CEIL";

  /** Time from restaurant to gate. Feeds the ETA and the curfew guard. */
  transitMinutes: number;

  vendorAckSeconds: number;
  vendorAutoExpireSeconds: number;
  gateGraceSeconds: number;
  curfewBufferMinutes: number;
  stockoutResolutionSeconds: number;
  disputeWindowMinutes: number;

  /** Kill switch for hybrid COD across the whole campus. */
  codEnabled: boolean;
}

export interface GeoPolygon {
  type: "Polygon";
  /** GeoJSON ring: [lng, lat] pairs, first === last. */
  coordinates: [number, number][][];
}

export interface Campus {
  _id: string;
  slug: string;
  name: string;
  city: string;
  /** IANA zone. Every campus-local comparison goes through this, never the server clock. */
  timezone: string;

  center: { lat: number; lng: number };
  geofence: GeoPolygon | null;

  zones: DeliveryZone[];
  settings: CampusSettings;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
