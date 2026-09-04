import "server-only";

import crypto from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Quick Unlock — server side.
 *
 * The 4-digit PIN and the biometric prompt used to live entirely in the
 * browser: they flipped a localStorage flag and then navigated. That is not a
 * sign-in, so the moment the auth cookie was gone (sign out, expiry, a new
 * browser profile) the PIN "succeeded" and the very next guarded page bounced
 * the person straight back to /signin — the unlock loop.
 *
 * Quick unlock is now a real credential, in two halves:
 *
 *   device cookie   — httpOnly, signed, long-lived. Names WHICH account is
 *                     allowed to attempt a quick unlock on this device. It
 *                     deliberately survives sign-out: it grants nothing on its
 *                     own, it only says "this phone belongs to that person".
 *   session cookie  — httpOnly, signed. Minted only after the server itself
 *                     has verified the PIN (or the registered credential id).
 *                     This is what `getSession()` resolves.
 *
 * Both are HMAC'd with a purpose prefix so a device token can never be
 * replayed as a session token.
 */

export const QUICK_UNLOCK_DEVICE_COOKIE = "trefood_quick_device";
export const QUICK_UNLOCK_SESSION_COOKIE = "trefood_quick_session";

/** A year, matching COOKIE_MAX_AGE_SECONDS. The PIN is the gate, not the clock. */
export const QUICK_UNLOCK_DEVICE_MAX_AGE = 60 * 60 * 24 * 365;
/** A quick-unlock session is shorter-lived than a password session by design. */
export const QUICK_UNLOCK_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** Brute-forcing 4 digits is 10k guesses. Five wrong tries buys a cool-off. */
export const QUICK_UNLOCK_MAX_ATTEMPTS = 5;
export const QUICK_UNLOCK_LOCKOUT_MS = 15 * 60 * 1000;

type TokenPurpose = "device" | "session";

function tokenSecret(): string {
  return serverEnv().CRON_SECRET || "trefood-quick-unlock-secret";
}

/** Signs `${userId}` for one purpose only. Returns `${userId}.${hmac}`. */
export function createQuickUnlockToken(purpose: TokenPurpose, userId: string): string {
  const signature = crypto
    .createHmac("sha256", tokenSecret())
    .update(`quick-unlock:${purpose}:${userId}`)
    .digest("hex");
  return `${userId}.${signature}`;
}

/** Verifies a token issued for `purpose` and returns the userId, or null. */
export function verifyQuickUnlockToken(purpose: TokenPurpose, token: string): string | null {
  try {
    const separator = token.lastIndexOf(".");
    if (separator <= 0) return null;

    const userId = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (!userId || !signature) return null;

    const expected = crypto
      .createHmac("sha256", tokenSecret())
      .update(`quick-unlock:${purpose}:${userId}`)
      .digest("hex");

    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}

/**
 * SHA-256 of `${salt}:${pin}` — byte-for-byte the scheme `hashPin()` in
 * `@/lib/quick-unlock` uses in the browser, so a PIN set on the device
 * verifies here and a PIN verified here matches the local profile.
 */
export function hashQuickPin(pin: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${pin.trim()}`).digest("hex");
}

export function verifyQuickPin(pin: string, expectedHash: string, salt: string): boolean {
  try {
    const computed = hashQuickPin(pin, salt);
    if (computed.length !== expectedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(expectedHash, "hex"));
  } catch {
    return false;
  }
}

/** Constant-time compare for the registered WebAuthn credential id. */
export function credentialIdMatches(
  provided: string | null | undefined,
  stored: string | null | undefined,
): boolean {
  if (!provided || !stored) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(stored, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
