import type { Paise } from "../money.js";
import type { ZoneType } from "../constants.js";
import type { GeoPoint, GeoPolygon, Id, MinutesFromMidnight } from "./common.js";

/**
 * A delivery point. The most important object in the product after the order.
 *
 * The student picks one BEFORE browsing, and it filters which restaurants are even
 * shown — because vendors declare which zones they serve. That ordering is the single
 * biggest structural difference from a mainstream food app.
 */
export interface IDeliveryZone {
  zoneId: string;
  name: string;
  zoneType: ZoneType;

  /**
   * When this gate closes, campus-local. `undefined` means 24×7 — which is what makes
   * a zone eligible as the campus fallback (F11).
   */
  curfewMinutes?: MinutesFromMidnight;

  /** Where to stand. Rendered as a static pin; there is no routing and no live position. */
  location: GeoPoint;

  /** Free text printed on the KOT: "Hand over at the guard desk, left of the gate." */
  instructions?: string;

  isActive: boolean;
}

/** Per-campus pricing and timing. Every value here is why a second campus is a row, not a deploy. */
export interface ICampusSettings {
  /** D5 — flat per campus, set by admin, and it flows to the vendor. */
  deliveryFeePaise: Paise;
  /** D6 — charged on food + packaging + delivery. */
  commissionPct: number;
  /** A3 — VERIFY against your real Razorpay plan. It is the number students see. */
  gatewayFeePct: number;
  /** A7 — the lever that would make COD cost more than prepaid. Ships at 0. */
  codHandlingFeePaise: Paise;

  /** Gate-to-hostel travel time. Feeds both the ETA and the curfew guard. */
  transitMinutes: number;

  /** A5 / A6 — overrides for the defaults in constants.ts. */
  vendorAckSeconds: number;
  gateGraceSeconds: number;

  /** A1 — who pays for a coupon. */
  couponFundedBy: "PLATFORM" | "VENDOR";
  /** A4 — how the commission rounds. */
  roundingMode: "CEIL";

  /**
   * The 24×7 zone an order reroutes to when a gate shuts mid-flight (F11 layer 2),
   * and the one offered when the curfew guard blocks a choice at checkout.
   */
  fallbackZoneId: string;
}

export interface ICampus {
  _id: Id;
  slug: string;
  name: string;
  city: string;

  /** IANA name, e.g. "Asia/Kolkata". Every curfew comparison goes through this. */
  timezone: string;

  /** Drawn by an admin with leaflet-draw. Free: no Maps API, no billing. */
  geofence: GeoPolygon;

  zones: IDeliveryZone[];
  settings: ICampusSettings;

  isActive: boolean;
}
