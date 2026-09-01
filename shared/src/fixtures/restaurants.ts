import { rupees } from "../money.js";
import type { IRestaurant } from "../types/index.js";
import {
  ACADEMIC_BLOCK_ZONE_ID,
  BRAHMAPUTRA_BOYS_ZONE_ID,
  GANGA_BOYS_ZONE_ID,
  KAVERI_GIRLS_ZONE_ID,
  MAIN_GATE_ZONE_ID,
} from "./campus.js";

const allDay = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  opensAt: 8 * 60,
  closesAt: 2 * 60, // 02:00 — crosses midnight, which the curfew logic must handle.
}));

/**
 * Three restaurants, chosen so every state the restaurant list must render exists:
 * one open and serving everywhere, one CLOSED, and one open with 86-ed items.
 */

/** Open, serves every zone. The default happy path in every screen. */
export const nitCanteen: IRestaurant = {
  _id: "rest-nit-canteen",
  campusId: "campus-nitp",
  slug: "nit-canteen",
  name: "NIT Canteen",
  cuisine: ["North Indian", "Chinese"],
  phone: "+919876543210",
  servedZoneIds: [
    MAIN_GATE_ZONE_ID,
    GANGA_BOYS_ZONE_ID,
    KAVERI_GIRLS_ZONE_ID,
    ACADEMIC_BLOCK_ZONE_ID,
    BRAHMAPUTRA_BOYS_ZONE_ID,
  ],
  isOpen: true,
  openingHours: allDay,
  defaultPrepMinutes: 20,
  minOrderPaise: rupees(50),
  packagingFeePaise: rupees(10),
  foodGstPct: 0,
  kycStatus: "APPROVED",
  createdAt: "2026-08-01T06:00:00.000Z",
};

/**
 * CLOSED. Must render greyed at the BOTTOM of the list, never hidden — a student
 * should see that it exists and is shut right now.
 */
export const gangaDhaba: IRestaurant = {
  _id: "rest-ganga-dhaba",
  campusId: "campus-nitp",
  slug: "ganga-dhaba",
  name: "Ganga Dhaba",
  cuisine: ["North Indian"],
  phone: "+919876543211",
  servedZoneIds: [MAIN_GATE_ZONE_ID, GANGA_BOYS_ZONE_ID, BRAHMAPUTRA_BOYS_ZONE_ID],
  isOpen: false,
  openingHours: allDay,
  defaultPrepMinutes: 25,
  minOrderPaise: rupees(60),
  packagingFeePaise: rupees(10),
  foodGstPct: 0,
  kycStatus: "APPROVED",
  createdAt: "2026-08-01T06:00:00.000Z",
};

/**
 * Open, but does NOT serve the girls' hostel or the academic block. Exists so the
 * zone filter has something to actually filter — pick Kaveri Girls and this one
 * disappears from the list.
 */
export const momoJunction: IRestaurant = {
  _id: "rest-momo-junction",
  campusId: "campus-nitp",
  slug: "momo-junction",
  name: "Momo Junction",
  cuisine: ["Tibetan", "Chinese"],
  phone: "+919876543212",
  servedZoneIds: [MAIN_GATE_ZONE_ID, GANGA_BOYS_ZONE_ID, BRAHMAPUTRA_BOYS_ZONE_ID],
  isOpen: true,
  openingHours: allDay,
  defaultPrepMinutes: 15,
  minOrderPaise: rupees(40),
  packagingFeePaise: rupees(8),
  foodGstPct: 0,
  kycStatus: "APPROVED",
  createdAt: "2026-08-01T06:00:00.000Z",
};

export const restaurants: IRestaurant[] = [nitCanteen, gangaDhaba, momoJunction];
