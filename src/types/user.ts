import type { Role } from "@/lib/constants";

export interface User {
  _id: string;
  /** Supabase auth user id. Null for seeded demo accounts. */
  authId: string | null;
  role: Role;

  name: string;
  email: string;
  /** Captured at first checkout (D7), then reused forever. */
  phone: string | null;
  /** Hashed password for direct vendor login (scrypt salt:hash). */
  passwordHash?: string | null;

  campusId: string | null;
  /** Vendor staff and owners only. Never trust a client-supplied value. */
  restaurantId: string | null;

  /**
   * Restaurants the student starred. Stored on the user rather than in a
   * join collection: the list is small, it is only ever read for one person
   * at a time, and it must survive a device change — which localStorage
   * would not.
   */
  favouriteRestaurantIds?: string[];

  /**
   * F8/F9 — a no-show at the gate, or a refusal to pay the cash, records a
   * strike. Strikes never block on their own: cash on delivery is the only way
   * to order, so an automatic block would be an automatic ban. They surface
   * the account on the admin queue, and an admin decides.
   */
  strikes: number;
  /** Admin-set. The only thing that actually stops a student ordering. */
  ordersBlocked: boolean;
  ordersBlockedReason: string | null;

  /** Quick Unlock settings (4-digit PIN hash/salt, Biometrics, and app lock preferences) */
  quickUnlock?: {
    pinHash?: string | null;
    pinSalt?: string | null;
    biometricEnabled?: boolean;
    credentialId?: string | null;
    requireOnOpen?: boolean;
    /** Wrong-PIN counter. Reset on every successful unlock. */
    failedAttempts?: number;
    /** Set once the counter trips; quick unlock is refused until it passes. */
    lockedUntil?: Date | null;
    updatedAt?: Date;
  } | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface StudentStrike {
  orderId: string;
  orderNumber: string;
  reason: "NO_SHOW" | "REFUSED_PAYMENT";
  at: Date;
}
