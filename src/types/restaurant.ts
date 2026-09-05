import type { Bps, Paise } from "@/lib/money";

export interface AddOnOption {
  id: string;
  name: string;
  pricePaise: Paise;
  isAvailable: boolean;
}

/**
 * An add-on group with min/max selection. `minSelect: 1` makes it a required
 * choice (size, spice level); `minSelect: 0` makes it optional (extra cheese).
 */
export interface AddOnGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: AddOnOption[];
}

export interface MenuItem {
  _id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  isVeg: boolean;
  pricePaise: Paise;
  /** Supabase Storage URL. Mongo stores the string only (DECISIONS section 3). */
  imageUrl: string | null;

  /**
   * The 86 flag. A BOOLEAN, never a count.
   *
   * True stock counting means quantity tracking, decrements, reservations and
   * TTL release on abandoned carts — enormous complexity for a canteen that
   * cooks to order. FAILURES section 4 rules it out explicitly.
   */
  isAvailable: boolean;

  addOnGroups: AddOnGroup[];
  sortOrder: number;
  isPopular: boolean;
}

export interface MenuCategory {
  _id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
}

export interface RestaurantKyc {
  status: "PENDING" | "APPROVED" | "REJECTED";
  ownerName: string;
  ownerPhone: string;
  gstin: string | null;
  fssai: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

export interface RestaurantPayout {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string | null;
}

export interface Restaurant {
  _id: string;
  campusId: string;
  slug: string;
  name: string;
  cuisines: string[];
  phone: string;
  description: string;

  imageUrl: string | null;
  bannerUrl: string | null;

  /** Included in the commission base (D6). */
  packagingFeePaise: Paise;
  minOrderPaise: Paise;
  /** Late-night minimum order override (e.g. ₹300 after 12:00 AM). */
  lateNightMinOrderPaise?: Paise | null;
  /** When late-night min order starts, minutes from midnight (e.g. 0 for 12:00 AM). */
  lateNightStartMinutes?: number | null;
  /** When late-night min order ends, minutes from midnight (e.g. 60 for 1:00 AM). */
  lateNightEndMinutes?: number | null;
  /** Default prep estimate shown before acceptance; the vendor sets the real one on accept. */
  prepMinutes: number;

  /** A2 — 0 for canteens below the 20L registration threshold. */
  foodGstBps: Bps;
  /** Admin-set override. Null means use the campus rate. */
  commissionBpsOverride: Bps | null;

  /**
   * Which gates this restaurant will deliver to. Drives the student list:
   * pick a zone, see only the restaurants that serve it. This is the single
   * most important structural difference from a mainstream food app.
   */
  servedZoneIds: string[];

  /** Daily hours as minutes from midnight, campus-local. */
  opensMinutes: number;
  closesMinutes: number;
  /** The one-tap release valve. Vendor toggles this during a surge. */
  isOpen: boolean;
  isApproved: boolean;

  rating: number | null;
  ratingCount: number;

  kyc: RestaurantKyc;
  payout: RestaurantPayout;

  /** F4 — three expiries in a day auto-closes the restaurant and alerts admin. */
  expiryCountToday: number;
  autoClosedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}
