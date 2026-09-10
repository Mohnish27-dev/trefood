import "server-only";

import crypto from "node:crypto";

import { cookies, headers } from "next/headers";

import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import { AUTH_METHOD, type AuthMethod, type AuthSession } from "@/types/auth";
import type { User } from "@/types/user";

/**
 * Sessions, owned by TREFOOD.
 *
 * The cookie holds 32 random bytes and nothing else. It is not a JWT and
 * deliberately not self-describing: the moment a session says who you are on
 * its own, revoking it early becomes impossible, and this app has three things
 * that must revoke immediately — a password change, an admin ban, and
 * "sign out my other devices" after a shared laptop.
 *
 * What is stored is the SHA-256 of the token, never the token, so a leaked
 * dump of the collection is not a pile of working cookies.
 */

export const SESSION_COOKIE = "trefood_session";

/** Thirty days. A campus phone is a personal device; asking weekly is theatre. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * `lastSeenAt` is only rewritten once an hour. Without this the session
 * collection takes a write on every single page view, which is a lot of disk
 * for a field nobody reads more precisely than "today".
 */
const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;

function tokenDigest(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Base64url of 32 random bytes: 256 bits, URL-safe, no padding to mangle. */
function mintToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** The cookie attributes, in one place, so the Route Handler and the Server Action agree. */
export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: serverEnv().NODE_ENV === "production",
  };
}

/**
 * Writes the session row and returns the token, touching no cookies.
 *
 * Split out from `createSession` because a Route Handler that returns its own
 * `NextResponse.redirect(...)` builds a fresh response, and a cookie written
 * through the `cookies()` store does not reliably survive that. The Google
 * callback sets the cookie on the response it returns; everything else uses
 * `createSession` below.
 */
export async function openSession(userId: string, method: AuthMethod): Promise<string> {
  const token = mintToken();
  const now = new Date();

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");

  const record: AuthSession = {
    _id: tokenDigest(token),
    userId,
    method,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000),
    lastSeenAt: now,
    userAgent: headerList.get("user-agent")?.slice(0, 256) ?? null,
    // The left-most entry is the client; everything after it is our own proxies.
    ip: forwardedFor?.split(",")[0]?.trim() ?? null,
  };

  await (await db.sessions()).insertOne(record);
  return token;
}

/**
 * Opens a session and sets the cookie.
 *
 * Called at the end of every successful credential check inside a Server
 * Action: password, an emailed code, and quick unlock. There is exactly one
 * place a session is born, which is what makes the audit fields worth trusting.
 */
export async function createSession(userId: string, method: AuthMethod): Promise<string> {
  const token = await openSession(userId, method);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  return token;
}

export interface ResolvedSession {
  user: User;
  session: AuthSession;
}

/**
 * Resolves the cookie to a live session and its user.
 *
 * Four things can invalidate it, and all four are checked here rather than
 * anywhere upstream: the token is unknown, the session has expired, the user
 * has been deleted, or the password changed after the session was opened.
 * That last one is what makes a password change a real remedy.
 */
export async function resolveSessionFromCookie(): Promise<ResolvedSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessions = await db.sessions();
  const session = await sessions.findOne({ _id: tokenDigest(token) });
  if (!session) return null;

  const now = Date.now();

  // Mongo's TTL monitor runs about once a minute, so an expired document can
  // still be sitting here. Expired is expired.
  if (new Date(session.expiresAt).getTime() <= now) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  const user = await (await db.users()).findOne({ _id: session.userId });
  if (!user) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  if (
    user.passwordChangedAt &&
    new Date(user.passwordChangedAt).getTime() > new Date(session.createdAt).getTime()
  ) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  if (now - new Date(session.lastSeenAt).getTime() > LAST_SEEN_REFRESH_MS) {
    await sessions.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date(now) } });
  }

  return { user, session };
}

/** Ends the session this browser holds, and clears the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await (await db.sessions()).deleteOne({ _id: tokenDigest(token) });
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Ends every session for a user, optionally sparing the current browser.
 *
 * Used by "sign out everywhere", and called automatically after a password is
 * changed or reset — a reset that leaves the thief signed in has not fixed
 * anything.
 */
export async function destroyAllSessions(
  userId: string,
  options: { exceptCurrent?: boolean } = {},
): Promise<number> {
  const sessions = await db.sessions();

  let keep: string | null = null;
  if (options.exceptCurrent) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    keep = token ? tokenDigest(token) : null;
  }

  const filter = keep ? { userId, _id: { $ne: keep } } : { userId };
  const result = await sessions.deleteMany(filter);
  return result.deletedCount ?? 0;
}

/** The signed-in devices shown on the account screen, newest first. */
export async function listSessions(userId: string): Promise<AuthSession[]> {
  return (await db.sessions()).find({ userId }).sort({ lastSeenAt: -1 }).toArray();
}

export { AUTH_METHOD };
