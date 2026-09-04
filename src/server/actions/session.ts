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
import { ROLE } from "@/lib/constants";
import { resolveLandingPath } from "@/lib/routes";
import {
  credentialIdMatches,
  QUICK_UNLOCK_LOCKOUT_MS,
  QUICK_UNLOCK_MAX_ATTEMPTS,
  QUICK_UNLOCK_SESSION_COOKIE,
  verifyQuickPin,
} from "@/server/auth/quick-unlock";
import {
  clearQuickUnlockCookies,
  ensureQuickUnlockDeviceCookie,
  setQuickUnlockDeviceCookie,
  setQuickUnlockSessionCookie,
  trustedDeviceUserId,
} from "@/server/auth/quick-unlock-cookies";

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

  redirect(resolveLandingPath(parsed.data.redirectTo, user.role));
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

  // 1. Check for direct vendor login in MongoDB (vendors only, bypasses Supabase)
  const usersCollection = await db.users();
  const dbUser = await usersCollection.findOne({ email });

  const isVendor = dbUser?.role === ROLE.VENDOR_OWNER || dbUser?.role === ROLE.VENDOR_STAFF;
  if (dbUser && dbUser.passwordHash && isVendor) {
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

    await ensureQuickUnlockDeviceCookie(dbUser);
    redirect(resolveLandingPath(target, dbUser.role));
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

    // Determine landing page based on user role. A student with no mirrored
    // Mongo document yet still belongs on the campus feed, never on "/".
    let role: string | null = null;
    if (data.user) {
      const authEmail = data.user.email;
      const mongoUser = await usersCollection.findOne(
        authEmail
          ? { $or: [{ authId: data.user.id }, { email: authEmail }] }
          : { authId: data.user.id },
      );
      role = mongoUser?.role ?? null;
      await ensureQuickUnlockDeviceCookie(mongoUser);
    }

    redirect(resolveLandingPath(target, role));
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
    redirect(resolveLandingPath(parsed.data.redirectTo, ROLE.STUDENT));
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
  const redirectUrl = resolveLandingPath(parsed.data.redirectTo, ROLE.STUDENT);

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

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_USER_COOKIE);
  store.delete(VENDOR_SESSION_COOKIE);
  // The quick-unlock SESSION goes; the device trust cookie stays. Signing out
  // means "stop being signed in", not "forget my phone" — the PIN screen on
  // /signin can then mint a fresh session, which is the whole point of it.
  // "Use a different account" (forgetQuickUnlockDevice) is what forgets.
  store.delete(QUICK_UNLOCK_SESSION_COOKIE);

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
/* Quick Unlock (4-Digit PIN & Biometrics)                             */
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
    // A fresh PIN clears any standing lockout left over from the old one.
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: new Date(),
  };

  await usersCol.updateOne(
    { _id: session.user._id },
    { $set: { quickUnlock: updatedSettings, updatedAt: new Date() } },
  );

  // Trust this device from now on. This is the half that was missing: without
  // it the PIN screen had nothing on the server to authenticate against, so
  // unlocking never produced a session.
  if (updatedSettings.pinHash) {
    await setQuickUnlockDeviceCookie(session.user._id);
  }

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

  await clearQuickUnlockCookies();

  return { status: "success", message: "Quick unlock has been reset." };
}

/** "Use a different account" on the unlock screen. Forgets this device entirely. */
export async function forgetQuickUnlockDevice(): Promise<AuthActionState> {
  await clearQuickUnlockCookies();
  return { status: "success", message: "This device no longer remembers a quick unlock PIN." };
}

const unlockSchema = z
  .object({
    mode: z.enum(["pin", "biometric"]),
    pin: z
      .string()
      .regex(/^[0-9]{4}$/, "Enter your 4-digit PIN")
      .optional(),
    credentialId: z.string().min(1).optional(),
    redirectTo: z.string().optional(),
  })
  .refine((value) => (value.mode === "pin" ? Boolean(value.pin) : Boolean(value.credentialId)), {
    message: "Missing unlock credentials.",
  });

export type QuickUnlockResult =
  | { status: "success"; redirectTo: string }
  | { status: "error"; message: string; reason: "untrusted" | "locked" | "invalid" };

/**
 * Verifies a quick unlock on the SERVER and mints a session cookie.
 *
 * The browser half (`@/lib/quick-unlock`) is a convenience only — it can tell
 * the keypad that the PIN looks wrong so the dots shake, but it cannot sign
 * anybody in. This can, and nothing else may.
 */
export async function unlockWithQuickUnlock(input: unknown): Promise<QuickUnlockResult> {
  const parsed = unlockSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Missing unlock credentials.", reason: "invalid" };
  }

  const userId = await trustedDeviceUserId();
  if (!userId) {
    return {
      status: "error",
      message: "This device is not set up for quick unlock. Sign in once to enable it again.",
      reason: "untrusted",
    };
  }

  const usersCol = await db.users();
  const user = await usersCol.findOne({ _id: userId });
  const settings = user?.quickUnlock;

  if (!user || !settings?.pinHash || !settings.pinSalt) {
    return {
      status: "error",
      message: "Quick unlock is no longer configured for this account. Please sign in.",
      reason: "untrusted",
    };
  }

  const lockedUntil = settings.lockedUntil ? new Date(settings.lockedUntil).getTime() : 0;
  if (lockedUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
    return {
      status: "error",
      message: `Too many wrong attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or sign in with your password.`,
      reason: "locked",
    };
  }

  const ok =
    parsed.data.mode === "pin"
      ? verifyQuickPin(parsed.data.pin ?? "", settings.pinHash, settings.pinSalt)
      : Boolean(settings.biometricEnabled) &&
        credentialIdMatches(parsed.data.credentialId, settings.credentialId);

  if (!ok) {
    const attempts = (settings.failedAttempts ?? 0) + 1;
    const shouldLock = attempts >= QUICK_UNLOCK_MAX_ATTEMPTS;

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          "quickUnlock.failedAttempts": shouldLock ? 0 : attempts,
          "quickUnlock.lockedUntil": shouldLock
            ? new Date(Date.now() + QUICK_UNLOCK_LOCKOUT_MS)
            : null,
          updatedAt: new Date(),
        },
      },
    );

    if (shouldLock) {
      return {
        status: "error",
        message: "Too many wrong attempts. Quick unlock is paused for 15 minutes.",
        reason: "locked",
      };
    }

    const left = QUICK_UNLOCK_MAX_ATTEMPTS - attempts;
    return {
      status: "error",
      message:
        parsed.data.mode === "pin"
          ? `Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Biometric unlock could not be verified. Enter your 4-digit PIN.",
      reason: "invalid",
    };
  }

  await usersCol.updateOne(
    { _id: user._id },
    {
      $set: {
        "quickUnlock.failedAttempts": 0,
        "quickUnlock.lockedUntil": null,
        updatedAt: new Date(),
      },
    },
  );

  await setQuickUnlockSessionCookie(user._id);
  // Refresh the device trust so a daily user never quietly falls off it.
  await setQuickUnlockDeviceCookie(user._id);

  return {
    status: "success",
    redirectTo: resolveLandingPath(parsed.data.redirectTo, user.role),
  };
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
