"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import { COOKIE_MAX_AGE_SECONDS } from "@/lib/cookies";
import { DEMO_USER_COOKIE } from "@/server/auth/session";

/**
 * Sign-in, behind the same seam as everything else auth touches.
 *
 * D7 — Google sign-in now, phone captured at first checkout, phone OTP later
 * once TRAI DLT clears. That plan is only cheap if no call site knows which
 * provider is live, so these actions talk to the provider layer and nothing
 * else.
 *
 * With `AUTH_PROVIDER=stub` this resolves one of the seeded accounts, which is
 * what makes the prototype demonstrable with no Supabase project: a student, a
 * COD-blocked student, four vendors and an admin, switchable in one tap. It is
 * NOT authentication and never pretends to be — `resolveStubUser` refuses to
 * run in production, so shipping this by accident fails loudly at boot rather
 * than quietly handing out sessions.
 *
 * Phase 8 replaces the body of `startSignIn` with a Supabase OAuth redirect.
 * The pages calling it do not change.
 */

export type SignInState = { status: "idle" } | { status: "error"; message: string };

const signInSchema = z.object({
  userId: z.string().min(1),
  /** Where to land afterwards. Relative paths only — see below. */
  redirectTo: z.string().optional(),
});

export async function signInAsDemoUser(input: unknown): Promise<SignInState> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Pick an account to continue." };

  if (serverEnv().AUTH_PROVIDER !== "stub") {
    return {
      status: "error",
      message: "Demo accounts are disabled. Sign in with Google instead.",
    };
  }

  const user = await (await db.users()).findOne({ _id: parsed.data.userId });
  if (!user) return { status: "error", message: "That account no longer exists." };

  const store = await cookies();
  store.set(DEMO_USER_COOKIE, user._id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: serverEnv().NODE_ENV === "production",
  });

  // An open redirect is a real vulnerability even in a prototype: anything
  // absolute or protocol-relative is discarded rather than sanitised.
  const target = parsed.data.redirectTo;
  redirect(target && /^\/(?!\/)/.test(target) ? target : landingFor(user.role));
}

function landingFor(role: string): string {
  if (role === "VENDOR_OWNER" || role === "VENDOR_STAFF") return "/vendor/orders";
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin/orders";
  return "/";
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_USER_COOKIE);
  redirect("/signin");
}
