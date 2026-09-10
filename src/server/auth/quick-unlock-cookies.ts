import "server-only";

import { cookies } from "next/headers";

import type { QuickUnlockDeviceState } from "@/lib/quick-unlock";
import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import type { User } from "@/types/user";
import {
  createQuickUnlockToken,
  QUICK_UNLOCK_DEVICE_COOKIE,
  QUICK_UNLOCK_DEVICE_MAX_AGE,
  QUICK_UNLOCK_SESSION_COOKIE,
  QUICK_UNLOCK_SESSION_MAX_AGE,
  verifyQuickUnlockToken,
} from "@/server/auth/quick-unlock";

/**
 * Quick Unlock — the request-scoped half.
 *
 * Kept apart from `quick-unlock.ts` for the same reason `passwords.ts` is kept
 * apart from `session.ts`: the crypto is pure and unit-testable, this reads and
 * writes cookies and the database.
 *
 * These helpers are also deliberately NOT in `@/server/actions/session`. Everything
 * exported from a "use server" module becomes a POST endpoint, and an endpoint
 * that mints a device cookie for a caller-supplied user id would hand anybody
 * a quick-unlock foothold on any account.
 */

async function setQuickUnlockCookie(
  name: string,
  purpose: "device" | "session",
  userId: string,
  maxAge: number,
): Promise<void> {
  const store = await cookies();
  store.set(name, createQuickUnlockToken(purpose, userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: serverEnv().NODE_ENV === "production",
  });
}

export async function setQuickUnlockDeviceCookie(userId: string): Promise<void> {
  await setQuickUnlockCookie(
    QUICK_UNLOCK_DEVICE_COOKIE,
    "device",
    userId,
    QUICK_UNLOCK_DEVICE_MAX_AGE,
  );
}

export async function setQuickUnlockSessionCookie(userId: string): Promise<void> {
  await setQuickUnlockCookie(
    QUICK_UNLOCK_SESSION_COOKIE,
    "session",
    userId,
    QUICK_UNLOCK_SESSION_MAX_AGE,
  );
}

export async function clearQuickUnlockCookies(): Promise<void> {
  const store = await cookies();
  store.delete(QUICK_UNLOCK_DEVICE_COOKIE);
  store.delete(QUICK_UNLOCK_SESSION_COOKIE);
}

/** The userId this browser is allowed to attempt a quick unlock for, or null. */
export async function trustedDeviceUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(QUICK_UNLOCK_DEVICE_COOKIE)?.value;
  if (!token) return null;
  return verifyQuickUnlockToken("device", token);
}

/**
 * Re-arms — or clears — the device cookie once we know who just signed in
 * normally. Re-arming means a full sign-out never costs somebody their PIN
 * setup; clearing means a browser stops offering the previous account's PIN
 * after somebody else signs in on it.
 */
export async function ensureQuickUnlockDeviceCookie(user: User | null): Promise<void> {
  if (!user?.quickUnlock?.pinHash) {
    await clearQuickUnlockCookies();
    return;
  }
  await setQuickUnlockDeviceCookie(user._id);
}

/**
 * The device-cookie decision, without touching the cookie store.
 *
 * The Google callback returns its own `NextResponse.redirect(...)`, and a
 * cookie written through the `cookies()` store does not reliably survive that
 * construction — so the route needs the value and sets it on the response
 * itself. Returns null when the cookie should be cleared instead of set.
 */
export function quickUnlockDeviceCookieFor(
  user: User | null,
): { name: string; value: string; maxAge: number } | null {
  if (!user?.quickUnlock?.pinHash) return null;
  return {
    name: QUICK_UNLOCK_DEVICE_COOKIE,
    value: createQuickUnlockToken("device", user._id),
    maxAge: QUICK_UNLOCK_DEVICE_MAX_AGE,
  };
}

/**
 * What the sign-in page needs in order to decide whether the PIN pad can
 * actually work. Rendering it when this says `trusted: false` is exactly the
 * loop that was reported: a PIN that verifies in the browser, then lands on a
 * page that bounces straight back to /signin because no session was created.
 */
export async function getQuickUnlockDeviceState(): Promise<QuickUnlockDeviceState> {
  const empty: QuickUnlockDeviceState = {
    trusted: false,
    userId: null,
    name: null,
    email: null,
    role: null,
    biometricEnabled: false,
    lockedUntilMs: null,
  };

  const userId = await trustedDeviceUserId();
  if (!userId) return empty;

  const user = await (await db.users()).findOne({ _id: userId });
  if (!user?.quickUnlock?.pinHash || !user.quickUnlock.pinSalt) return empty;

  const lockedUntil = user.quickUnlock.lockedUntil
    ? new Date(user.quickUnlock.lockedUntil).getTime()
    : null;

  return {
    trusted: true,
    userId: user._id,
    name: user.name,
    email: user.email,
    // Read from the user document, never from anything the browser sent. The
    // sign-in screen only uses it to pick a tab, but a role that came from the
    // client would be a role worth lying about.
    role: user.role,
    biometricEnabled: Boolean(user.quickUnlock.biometricEnabled),
    lockedUntilMs: lockedUntil && lockedUntil > Date.now() ? lockedUntil : null,
  };
}
