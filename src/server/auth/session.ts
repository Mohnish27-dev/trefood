import "server-only";

import { cookies } from "next/headers";

import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import { ROLE, type Role } from "@/lib/constants";
import { newId } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/types/user";

/**
 * Session and authorisation.
 *
 * D7 — Google sign-in now, phone captured at first checkout, phone OTP added
 * later once TRAI DLT registration clears. That is only cheap if the auth
 * layer sits behind an interface, so the OTP provider drops in without
 * touching a single call site. This file IS that interface.
 *
 * Two implementations:
 *
 *   stub      — resolves the seeded demo account named by a cookie. Lets the
 *               whole prototype run, and lets a demo switch between a normal
 *               student and a COD-blocked one to show the F9 screen.
 *   supabase  — Phase 8. Reads the Supabase JWT and maps it to the mirrored
 *               `users` document by authId.
 *
 * Selected by AUTH_PROVIDER. Nothing above this file knows which is active.
 */

export const DEMO_USER_COOKIE = "trefood_demo_user";

export interface Session {
  user: User;
  role: Role;
}

/* ------------------------------------------------------------------ */
/* Public API — the only functions the rest of the app may call        */
/* ------------------------------------------------------------------ */

export async function getSession(): Promise<Session | null> {
  const provider = serverEnv().AUTH_PROVIDER;
  const user = provider === "supabase" ? await resolveSupabaseUser() : await resolveStubUser();
  return user ? { user, role: user.role } : null;
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
 * Prototype provider.
 *
 * Reads a seeded user id from a cookie set by the sign-in screen. This is NOT
 * authentication and never pretends to be: it exists so the whole ordering
 * flow is demonstrable before Supabase is wired, and it is refused outright in
 * production.
 */
async function resolveStubUser(): Promise<User | null> {
  if (serverEnv().NODE_ENV === "production") {
    throw new AuthError(
      "UNAUTHENTICATED",
      "AUTH_PROVIDER=stub cannot be used in production. Set AUTH_PROVIDER=supabase.",
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

/**
 * Phase 8. The Supabase JWT identifies the auth user; the `users` collection
 * mirrors it with the role, phone and codBlocked flag that the domain needs.
 * If a student signs in for the first time, auto-provisions their MongoDB record.
 */
async function resolveSupabaseUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) return null;

  const usersCollection = await db.users();

  // 1. Look up by authId (Supabase user UUID)
  let mongoUser = await usersCollection.findOne({ authId: authUser.id });

  if (!mongoUser && authUser.email) {
    // 2. Look up by email (in case an existing record was seeded/created without authId)
    mongoUser = await usersCollection.findOne({ email: authUser.email });
    if (mongoUser) {
      await usersCollection.updateOne(
        { _id: mongoUser._id },
        { $set: { authId: authUser.id, updatedAt: new Date() } },
      );
      mongoUser.authId = authUser.id;
    }
  }

  if (!mongoUser) {
    // 3. Auto-provision new student record in MongoDB
    const metaName =
      (typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name) ||
      (typeof authUser.user_metadata?.name === "string" && authUser.user_metadata.name) ||
      authUser.email?.split("@")[0] ||
      "Student";

    const newStudent: User = {
      _id: newId("usr"),
      authId: authUser.id,
      role: ROLE.STUDENT,
      name: metaName,
      email: authUser.email ?? "",
      phone: authUser.phone ?? null,
      campusId: "campus_nitp",
      restaurantId: null,
      codBlocked: false,
      codBlockedReason: null,
      strikes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await usersCollection.insertOne(newStudent);
    mongoUser = newStudent;
  }

  return mongoUser;
}

/* ------------------------------------------------------------------ */
/* Demo account switching                                              */
/* ------------------------------------------------------------------ */

/** The accounts the /demo panel can switch between. Stub provider only. */
export async function listDemoUsers(): Promise<User[]> {
  return (await db.users()).find({}).sort({ role: 1, name: 1 }).toArray();
}
