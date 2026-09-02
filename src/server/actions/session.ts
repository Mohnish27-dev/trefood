"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import { COOKIE_MAX_AGE_SECONDS } from "@/lib/cookies";
import { DEMO_USER_COOKIE } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createVendorSessionToken,
  VENDOR_SESSION_COOKIE,
  verifyPassword,
} from "@/server/auth/passwords";

export type AuthActionState =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string };

const demoSignInSchema = z.object({
  userId: z.string().min(1),
  redirectTo: z.string().optional(),
});

export async function signInAsDemoUser(input: unknown): Promise<AuthActionState> {
  const parsed = demoSignInSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Pick an account to continue." };

  if (serverEnv().AUTH_PROVIDER !== "stub") {
    return {
      status: "error",
      message: "Demo accounts are disabled. Sign in with Google or Email instead.",
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

  const target = parsed.data.redirectTo;
  redirect(target && /^\/(?!\/)/.test(target) ? target : landingFor(user.role));
}

const emailPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  redirectTo: z.string().optional(),
});

export async function signInWithEmail(input: unknown): Promise<AuthActionState> {
  const parsed = emailPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password;
  const target = parsed.data.redirectTo;

  // 1. Check for direct vendor login in MongoDB
  const usersCollection = await db.users();
  const dbUser = await usersCollection.findOne({ email });

  if (dbUser && dbUser.passwordHash) {
    const isValid = verifyPassword(password, dbUser.passwordHash);
    if (!isValid) {
      return { status: "error", message: "Invalid email or password." };
    }

    const token = createVendorSessionToken(dbUser._id);
    const store = await cookies();
    store.set(VENDOR_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      secure: serverEnv().NODE_ENV === "production",
    });

    const destination = target && /^\/(?!\/)/.test(target) ? target : landingFor(dbUser.role);
    redirect(destination);
  }

  // 2. Fall back to Supabase auth (for students / OAuth accounts)
  if (serverEnv().AUTH_PROVIDER === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { status: "error", message: error.message };
    }

    // Determine landing page based on user role if available
    let roleLanding = "/";
    if (data.user) {
      const authEmail = data.user.email;
      const mongoUser = await usersCollection.findOne(
        authEmail
          ? { $or: [{ authId: data.user.id }, { email: authEmail }] }
          : { authId: data.user.id },
      );
      if (mongoUser) roleLanding = landingFor(mongoUser.role);
    }

    const destination = target && /^\/(?!\/)/.test(target) ? target : roleLanding;
    redirect(destination);
  }

  return { status: "error", message: "Invalid email or password." };
}

const signUpSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  redirectTo: z.string().optional(),
});

export async function signUpWithEmail(input: unknown): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.name,
        name: parsed.data.name,
      },
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  // If email confirmation is disabled or session is created immediately:
  if (data.session) {
    const target = parsed.data.redirectTo;
    redirect(target && /^\/(?!\/)/.test(target) ? target : "/c/nit-patna");
  }

  return {
    status: "success",
    message: "Account created! Please check your email to confirm your account.",
  };
}

const otpSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  redirectTo: z.string().optional(),
});

export async function sendMagicLink(input: unknown): Promise<AuthActionState> {
  const parsed = otpSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const supabase = await createSupabaseServerClient();
  const target = parsed.data.redirectTo;
  const redirectUrl = target && /^\/(?!\/)/.test(target) ? target : "/c/nit-patna";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message: "Magic login link sent to your email! Check your inbox.",
  };
}

function landingFor(role: string): string {
  if (role === "VENDOR_OWNER" || role === "VENDOR_STAFF") return "/vendor/orders";
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin/orders";
  return "/c/nit-patna";
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_USER_COOKIE);
  store.delete(VENDOR_SESSION_COOKIE);

  if (serverEnv().AUTH_PROVIDER === "supabase") {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Best-effort sign-out from Supabase
    }
  }

  redirect("/signin");
}

/* ------------------------------------------------------------------ */
/* Quick Unlock (4-Digit PIN & Biometrics) Server Sync                */
/* ------------------------------------------------------------------ */

const quickUnlockSchema = z.object({
  pinHash: z.string().min(1).optional(),
  pinSalt: z.string().min(1).optional(),
  biometricEnabled: z.boolean().optional(),
  credentialId: z.string().nullable().optional(),
  requireOnOpen: z.boolean().optional(),
});

export async function saveQuickUnlockSettings(input: unknown): Promise<AuthActionState> {
  const parsed = quickUnlockSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid quick unlock configuration." };
  }

  const session = await (await import("@/server/auth/session")).getSession();
  if (!session) {
    return { status: "error", message: "You need to be signed in to save quick unlock settings." };
  }

  const usersCol = await db.users();
  const existing = await usersCol.findOne({ _id: session.user._id });
  if (!existing) {
    return { status: "error", message: "User account not found." };
  }

  const currentSettings = existing.quickUnlock ?? {};
  const updatedSettings = {
    pinHash: parsed.data.pinHash ?? currentSettings.pinHash ?? null,
    pinSalt: parsed.data.pinSalt ?? currentSettings.pinSalt ?? null,
    biometricEnabled: parsed.data.biometricEnabled ?? currentSettings.biometricEnabled ?? false,
    credentialId:
      parsed.data.credentialId !== undefined
        ? parsed.data.credentialId
        : (currentSettings.credentialId ?? null),
    requireOnOpen: parsed.data.requireOnOpen ?? currentSettings.requireOnOpen ?? true,
    updatedAt: new Date(),
  };

  await usersCol.updateOne(
    { _id: session.user._id },
    { $set: { quickUnlock: updatedSettings, updatedAt: new Date() } },
  );

  return { status: "success", message: "Quick unlock settings saved successfully." };
}

export async function resetQuickUnlockSettings(): Promise<AuthActionState> {
  const session = await (await import("@/server/auth/session")).getSession();
  if (!session) {
    return { status: "error", message: "You need to be signed in to reset quick unlock." };
  }

  const usersCol = await db.users();
  await usersCol.updateOne(
    { _id: session.user._id },
    { $set: { quickUnlock: null, updatedAt: new Date() } },
  );

  return { status: "success", message: "Quick unlock has been reset." };
}

export async function getQuickUnlockStatus(): Promise<{
  configured: boolean;
  biometricEnabled: boolean;
  requireOnOpen: boolean;
}> {
  const session = await (await import("@/server/auth/session")).getSession();
  if (!session || !session.user.quickUnlock?.pinHash) {
    return { configured: false, biometricEnabled: false, requireOnOpen: false };
  }

  return {
    configured: Boolean(session.user.quickUnlock.pinHash),
    biometricEnabled: Boolean(session.user.quickUnlock.biometricEnabled),
    requireOnOpen: session.user.quickUnlock.requireOnOpen ?? true,
  };
}

