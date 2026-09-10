import "server-only";

import { cookies } from "next/headers";

import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import { ROLE, type Role } from "@/lib/constants";
import type { User } from "@/types/user";

/**
 * Session and authorisation.
 *
 * TREFOOD authenticates its own users. Email and password, Google sign-in, and
 * a six-digit code over our own mailbox all resolve to one thing: a row in the
 * `sessions` collection, keyed by an opaque cookie. Nothing above this file
 * knows which credential opened it.
 *
 * That was not always true. Authentication used to be delegated to a hosted
 * provider, which meant a second copy of every account, a JWT that could not be
 * revoked early, and a shared email quota that rate-limited real students at
 * dinner time. All three problems were the same problem: the identity did not
 * live here. Now it does.
 *
 * Two implementations remain:
 *
 *   stub     — resolves the seeded demo account named by a cookie. Lets the
 *              whole prototype run with no credentials at all, and is refused
 *              outright in production.
 *   trefood  — the real one. Reads the session cookie, checks the row.
 *
 * Selected by AUTH_PROVIDER.
 */

import { VENDOR_SESSION_COOKIE, verifyVendorSessionToken } from "@/server/auth/passwords";
import {
  QUICK_UNLOCK_SESSION_COOKIE,
  verifyQuickUnlockToken,
} from "@/server/auth/quick-unlock";
import { resolveSessionFromCookie } from "@/server/auth/session-store";

export const DEMO_USER_COOKIE = "trefood_demo_user";

export interface Session {
  user: User;
  role: Role;
}

/* ------------------------------------------------------------------ */
/* Public API — the only functions the rest of the app may call        */
/* ------------------------------------------------------------------ */

export async function getSession(): Promise<Session | null> {
  // 1. The real session cookie. Password, Google and emailed-code sign-ins
  //    all land here, so this is the common case and it comes first.
  const resolved = await resolveSessionFromCookie();
  if (resolved) return { user: resolved.user, role: resolved.user.role };

  // 2. Legacy vendor cookie, from before vendor and student auth were unified.
  //    Kept so a vendor mid-shift is not signed out by a deploy. Safe to delete
  //    once the longest of these has aged past its one-year cookie.
  const vendorUser = await resolveLegacyVendorUser();
  if (vendorUser) return { user: vendorUser, role: vendorUser.role };

  // 3. Stub accounts, development only.
  if (serverEnv().AUTH_PROVIDER === "stub") {
    const stubUser = await resolveStubUser();
    if (stubUser) return { user: stubUser, role: stubUser.role };
  }

  // 4. Quick unlock (4-digit PIN / biometrics). Deliberately LAST: a real
  // password or Google session always wins, so a stale quick-unlock cookie can
  // never shadow the account somebody has just signed into on this device.
  const quickUser = await resolveQuickUnlockUser();
  return quickUser ? { user: quickUser, role: quickUser.role } : null;
}

/** Throws when unauthenticated. Use in Server Actions, never in a read path that can degrade. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError("UNAUTHENTICATED", "You need to sign in to do that.");
  return session;
}

export async function requireRole(...allowed: readonly Role[]): Promise<Session> {
  const session = await requireSession();
  if (!allowed.includes(session.role)) {
    throw new AuthError("FORBIDDEN", "Your account cannot do that.");
  }
  return session;
}

/**
 * Vendor scoping.
 *
 * "Never trust a client-supplied restaurantId" (ARCH section 2). This returns
 * the restaurant id from the SESSION, and every vendor query filters on it.
 */
export async function requireVendor(): Promise<Session & { restaurantId: string }> {
  const session = await requireRole(ROLE.VENDOR_OWNER, ROLE.VENDOR_STAFF);
  const restaurantId = session.user.restaurantId;
  if (!restaurantId) {
    throw new AuthError("FORBIDDEN", "This account is not linked to a restaurant.");
  }
  return { ...session, restaurantId };
}

export async function requireAdmin(): Promise<Session> {
  return requireRole(ROLE.ADMIN, ROLE.SUPER_ADMIN);
}

/**
 * Resource ownership, checked separately from role.
 *
 * Middleware gates the route group; this gates the row. Middleware alone is
 * not authorisation (PRD Part 4.9).
 */
export function assertOwnership(ownerId: string, session: Session): void {
  if (session.user._id !== ownerId) {
    throw new AuthError("FORBIDDEN", "That does not belong to you.");
  }
}

export type AuthErrorCode = "UNAUTHENTICATED" | "FORBIDDEN";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Legacy vendor provider.
 *
 * Reads the signed cookie that direct vendor sign-in used to mint. Nothing
 * writes one any more; vendors now get an ordinary session like everybody else.
 */
async function resolveLegacyVendorUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(VENDOR_SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = verifyVendorSessionToken(token);
  if (!userId) return null;

  return (await db.users()).findOne({ _id: userId });
}

/**
 * Quick unlock provider.
 *
 * The cookie is only ever minted by `unlockWithQuickUnlock()`, after the
 * server has checked the PIN against `users.quickUnlock`. It is re-validated
 * on every request: turning quick unlock off in Account clears the stored
 * hash, and this drops the session the moment that happens.
 */
async function resolveQuickUnlockUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(QUICK_UNLOCK_SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = verifyQuickUnlockToken("session", token);
  if (!userId) return null;

  const user = await (await db.users()).findOne({ _id: userId });
  if (!user?.quickUnlock?.pinHash) return null;

  return user;
}

/**
 * Prototype provider.
 *
 * Reads a seeded user id from a cookie set by the sign-in screen. This is NOT
 * authentication and never pretends to be: it exists so the whole ordering
 * flow is demonstrable without a mailbox or a Google client, and it is refused
 * outright in production.
 */
async function resolveStubUser(): Promise<User | null> {
  if (serverEnv().NODE_ENV === "production") {
    throw new AuthError(
      "UNAUTHENTICATED",
      "AUTH_PROVIDER=stub cannot be used in production. Set AUTH_PROVIDER=trefood.",
    );
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(DEMO_USER_COOKIE)?.value;

  // No cookie means genuinely signed out, not "fall back to the demo student".
  // Browsing needs no account at all (ARCH section 4, step 1) and auth is only
  // required at checkout, so a null session here is the normal state — and it
  // is what makes signing in and out something a person can actually observe.
  if (!userId) return null;

  return (await db.users()).findOne({ _id: userId });
}

/* ------------------------------------------------------------------ */
/* Stub-mode account switching                                         */
/* ------------------------------------------------------------------ */

/**
 * Every account, for the stub-auth sign-in picker (AUTH_PROVIDER=stub only).
 * Stub mode has no credential check, so this is how a developer signs in as a
 * vendor or admin locally. Real deployments never render it.
 */
export async function listDemoUsers(): Promise<User[]> {
  return (await db.users()).find({}).sort({ role: 1, name: 1 }).toArray();
}
