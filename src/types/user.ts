import type { Role } from "@/lib/constants";

export interface User {
  _id: string;
  /**
   * Legacy external auth id, from the hosted provider TREFOOD used before it
   * owned its own authentication. Read-only history: nothing mints one now.
   * An account that still carries one and has no `passwordHash` is a
   * pre-migration user, and the sign-in path routes it through an emailed
   * code to set a password rather than rejecting it.
   *
   * @deprecated Superseded by `googleId` and `passwordHash`.
   */
  authId: string | null;

  /** Google account subject (`sub`) once the account has signed in with Google. */
  googleId?: string | null;

  role: Role;

  name: string;
  email: string;
  /** True once a six-digit code sent to this address has been redeemed. */
  emailVerified?: boolean;
  /** Captured at first checkout (D7), then reused forever. */
  phone: string | null;
  /** scrypt `salt:hash`. Absent for an account that only ever used Google. */
  passwordHash?: string | null;
  /**
   * Every session older than this is refused. Changing a password therefore
   * signs out every other browser, which is the only reason a stolen password
   * is worth changing at all.
   */
  passwordChangedAt?: Date | null;

  /**
   * Wrong-password throttle. A six-character minimum is guessable at machine
   * speed, so the account, not the password, is what has to slow an attacker
   * down. Cleared on every successful sign-in.
   */
  loginLock?: {
    failedAttempts: number;
    lockedUntil?: Date | null;
  } | null;

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
