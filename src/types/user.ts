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
   * F8/F9 — COD is disabled after two no-shows, or immediately on a refusal
   * to pay. Never a permanent ban: a blocked-COD student who must prepay is a
   * better customer than a lost one, and prepaid carries zero collection risk.
   */
  codBlocked: boolean;
  codBlockedReason: string | null;
  strikes: number;

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
  reason: "NO_SHOW_COD" | "REFUSED_PAYMENT";
  at: Date;
}
