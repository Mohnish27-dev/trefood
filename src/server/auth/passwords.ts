import "server-only";

import crypto from "node:crypto";
import { serverEnv } from "@/lib/env";

export const VENDOR_SESSION_COOKIE = "trefood_vendor_session";

/**
 * Hash a plain-text password using scrypt with a random 16-byte salt.
 * Returns `${salt}:${hash}`.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a plain-text password against a stored `${salt}:${hash}` string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verifyHash, "hex"));
  } catch {
    return false;
  }
}

/**
 * Create a signed session token for a direct vendor login: `${userId}.${hmac}`.
 */
export function createVendorSessionToken(userId: string): string {
  const secret = serverEnv().CRON_SECRET || "trefood-vendor-auth-secret";
  const signature = crypto.createHmac("sha256", secret).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

/**
 * Verify a signed vendor session token and return the userId if valid.
 */
export function verifyVendorSessionToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [userId, signature] = parts;
    if (!userId || !signature) return null;

    const secret = serverEnv().CRON_SECRET || "trefood-vendor-auth-secret";
    const expected = crypto.createHmac("sha256", secret).update(userId).digest("hex");

    if (
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
    ) {
      return userId;
    }
    return null;
  } catch {
    return null;
  }
}
