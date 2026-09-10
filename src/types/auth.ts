/**
 * Authentication documents.
 *
 * TREFOOD owns its own authentication end to end: email + password, Google
 * OAuth, and a six-digit code delivered over the business mailbox. There is no
 * third-party auth service in the request path, which is the whole point —
 * a hosted provider's shared sending quota was rate-limiting real students
 * during a lunch rush, and a quota nobody in this building controls is not a
 * dependency an ordering flow can carry.
 *
 * Two collections back it:
 *
 *   sessions   — one document per signed-in browser. The cookie carries an
 *                opaque random token and nothing else, so a session can be
 *                revoked the instant a password changes or an admin bans an
 *                account. A self-describing JWT could not do that.
 *   emailOtps  — a pending six-digit code. Also holds the not-yet-created
 *                signup, so an unverified address never occupies the unique
 *                email index and cannot be squatted.
 */

/** Why a code was sent. A code minted for one purpose never satisfies another. */
export const OTP_PURPOSE = {
  /** Verifying a brand-new account before the user document is written. */
  SIGNUP: "SIGNUP",
  /** Forgot password, and the first sign-in of a pre-migration account. */
  PASSWORD_RESET: "PASSWORD_RESET",
} as const;

export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE];

/** How a browser proved who it belongs to. Recorded for the audit trail. */
export const AUTH_METHOD = {
  PASSWORD: "PASSWORD",
  GOOGLE: "GOOGLE",
  OTP: "OTP",
  QUICK_UNLOCK: "QUICK_UNLOCK",
} as const;

export type AuthMethod = (typeof AUTH_METHOD)[keyof typeof AUTH_METHOD];

export interface AuthSession {
  /**
   * SHA-256 of the token in the cookie, never the token itself. A dump of this
   * collection is then not a set of usable session cookies.
   */
  _id: string;
  userId: string;
  method: AuthMethod;

  createdAt: Date;
  /** TTL-indexed. Mongo reaps the document; the read path also checks it. */
  expiresAt: Date;
  /** Refreshed lazily, so "sign out other devices" can show something useful. */
  lastSeenAt: Date;

  userAgent: string | null;
  ip: string | null;
}

export interface EmailOtp {
  _id: string;
  /** Lower-cased. The lookup key, alongside purpose. */
  email: string;
  purpose: OtpPurpose;

  /** SHA-256 of `${salt}:${code}`. The plain code exists only in the email. */
  codeHash: string;
  codeSalt: string;

  /** Six wrong guesses burns the code. Six digits is a million, not a target. */
  attempts: number;

  /**
   * SIGNUP only: the account to create once the code checks out. Held here so
   * an unverified address never reaches the users collection.
   */
  pendingSignup?: {
    name: string;
    passwordHash: string;
  } | null;

  createdAt: Date;
  /** TTL-indexed, and re-checked on read. */
  expiresAt: Date;
  /** Set on success. A consumed code cannot be replayed. */
  consumedAt?: Date | null;
}
