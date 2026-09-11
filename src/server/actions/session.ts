"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import { COOKIE_MAX_AGE_SECONDS } from "@/lib/cookies";
import { DEMO_USER_COOKIE, getSession } from "@/server/auth/session";
import { hashPassword, verifyPassword, VENDOR_SESSION_COOKIE } from "@/server/auth/passwords";
import { resolveLandingPath } from "@/lib/routes";
import { buildStudent, needsPasswordSetup } from "@/server/auth/accounts";
import {
  normaliseEmail,
  sendOtp,
  verifyOtp,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MINUTES,
} from "@/server/auth/otp";
import {
  AUTH_METHOD,
  authCookieDomain,
  createSession,
  destroyAllSessions,
  destroyCurrentSession,
} from "@/server/auth/session-store";
import { sendMail } from "@/server/mail/mailer";
import { passwordChangedMessage, welcomeMessage } from "@/server/mail/templates";
import { OTP_PURPOSE } from "@/types/auth";
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

/**
 * Every credential the sign-in screen can present.
 *
 * The shape is a discriminated union rather than a bare success/error pair
 * because sign-up is no longer one step. "We emailed you a code" is a real
 * outcome that moves the screen to a different form, and squeezing it into a
 * success message would leave the client parsing English to decide what to render.
 */
export type AuthActionState =
  | { status: "idle" }
  | { status: "success"; message?: string }
  /** A code is in flight. The screen switches to the six-box code form. */
  | { status: "otp_sent"; email: string; purpose: "SIGNUP" | "PASSWORD_RESET"; message: string; cooldownMs: number }
  /**
   * The account is real but has no password here — it predates TREFOOD owning
   * its authentication, or it has only ever used Google. A code is already on
   * its way, and the screen collects a new password.
   */
  | { status: "needs_password_setup"; email: string; message: string; cooldownMs: number }
  | { status: "error"; message: string };

/** Six characters was the old provider's floor. Eight, with a letter and a digit, is ours. */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be under 128 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "That email address is too long");

/** Five wrong passwords, then the account rests for fifteen minutes. */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

function cooldownSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/* ------------------------------------------------------------------ */
/* Stub mode                                                           */
/* ------------------------------------------------------------------ */

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
      message: "Demo accounts are disabled. Sign in with Google or your email instead.",
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

/* ------------------------------------------------------------------ */
/* Sign up — email, password, and a six-digit code                     */
/* ------------------------------------------------------------------ */

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80, "That name is too long"),
  email: emailSchema,
  password: passwordSchema,
  redirectTo: z.string().optional(),
});

/**
 * Step one of two: validates, then emails a code.
 *
 * No user document is written here. The name and the password hash are parked
 * on the pending code instead, so an address nobody ever verifies never lands
 * in the users collection — which keeps the unique email index meaningful and
 * makes it impossible to squat somebody else's address by starting a sign-up
 * you never finish.
 */
export async function signUpWithEmail(input: unknown): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const email = normaliseEmail(parsed.data.email);
  const existing = await (await db.users()).findOne({ email });

  if (existing) {
    // A real account already owns this address. Say so plainly: the alternative
    // is emailing a code that can never work, and a person staring at an inbox.
    return {
      status: "error",
      message: existing.googleId
        ? "That email already has an account. Use Continue with Google, or reset your password."
        : "That email already has an account. Sign in instead, or reset your password.",
    };
  }

  const passwordHash = hashPassword(parsed.data.password);
  const outcome = await sendOtp(email, OTP_PURPOSE.SIGNUP, {
    name: parsed.data.name,
    passwordHash,
  });

  return otpSendOutcomeToState(outcome, email, "SIGNUP");
}

const verifySignupSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code from your email"),
  redirectTo: z.string().optional(),
});

/**
 * Step two of two: redeems the code and creates the account.
 *
 * The pending signup rides on the code record, so verifying the code and
 * knowing which account to create are the same read. There is no window in
 * which one is true and the other is not.
 */
export async function verifySignupCode(input: unknown): Promise<AuthActionState> {
  const parsed = verifySignupSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter the 6-digit code." };
  }

  const email = normaliseEmail(parsed.data.email);
  const result = await verifyOtp(email, OTP_PURPOSE.SIGNUP, parsed.data.code);

  if (!result.ok) return { status: "error", message: otpFailureMessage(result.reason, result.attemptsLeft) };

  const pending = result.record.pendingSignup;
  if (!pending) {
    return { status: "error", message: "That sign-up has expired. Start again." };
  }

  const users = await db.users();

  // Between the code being sent and being typed, the same address could have
  // been claimed — by Google sign-in, most likely. Adopt that account rather
  // than colliding on the unique index and showing a database error.
  const existing = await users.findOne({ email });
  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          emailVerified: true,
          passwordHash: pending.passwordHash,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    await createSession(existing._id, AUTH_METHOD.OTP);
    await ensureQuickUnlockDeviceCookie(existing);
    redirect(resolveLandingPath(parsed.data.redirectTo, existing.role));
  }

  const student = buildStudent({
    email,
    name: pending.name,
    emailVerified: true,
    passwordHash: pending.passwordHash,
  });

  await users.insertOne(student);
  await createSession(student._id, AUTH_METHOD.OTP);
  await ensureQuickUnlockDeviceCookie(student);

  // Best effort, and deliberately not awaited into the failure path: a welcome
  // mail that bounces must not undo an account that was created correctly.
  const welcome = welcomeMessage(student.name);
  void sendMail({ to: student.email, subject: welcome.subject, html: welcome.html, text: welcome.text });

  redirect(resolveLandingPath(parsed.data.redirectTo, student.role));
}

const resendSchema = z.object({
  email: emailSchema,
  purpose: z.enum(["SIGNUP", "PASSWORD_RESET"]),
});

/** "Didn't get it?" Rate limits live in `sendOtp`, not here. */
export async function resendCode(input: unknown): Promise<AuthActionState> {
  const parsed = resendSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Could not resend the code." };

  const email = normaliseEmail(parsed.data.email);
  const purpose = parsed.data.purpose === "SIGNUP" ? OTP_PURPOSE.SIGNUP : OTP_PURPOSE.PASSWORD_RESET;

  if (purpose === OTP_PURPOSE.SIGNUP) {
    // Resending a sign-up code needs the pending signup that the previous code
    // carried. Read it back rather than asking the browser to hold a password hash.
    const previous = await (await db.emailOtps()).findOne(
      { email, purpose: OTP_PURPOSE.SIGNUP },
      { sort: { createdAt: -1 } },
    );
    const pending = previous?.pendingSignup ?? null;
    if (!pending) {
      return { status: "error", message: "That sign-up has expired. Start again." };
    }
    return otpSendOutcomeToState(await sendOtp(email, purpose, pending), email, "SIGNUP");
  }

  const user = await (await db.users()).findOne({ email });
  if (!user) {
    // Same answer as a real send. A resend endpoint that distinguishes is an
    // account-existence oracle with a convenient retry button.
    return {
      status: "otp_sent",
      email,
      purpose: "PASSWORD_RESET",
      message: `If that address has an account, a new code is on its way. It expires in ${OTP_TTL_MINUTES} minutes.`,
      cooldownMs: OTP_RESEND_COOLDOWN_MS,
    };
  }

  return otpSendOutcomeToState(await sendOtp(email, purpose), email, "PASSWORD_RESET");
}

/* ------------------------------------------------------------------ */
/* Sign in — email and password                                        */
/* ------------------------------------------------------------------ */

const signInSchema = z.object({
  email: emailSchema,
  // Deliberately NOT `passwordSchema`: an existing password set under the old
  // eight-character rule must still be typeable. Strength is enforced where a
  // password is chosen, never where one is checked.
  password: z.string().min(1, "Enter your password"),
  redirectTo: z.string().optional(),
});

/**
 * One sign-in for everybody.
 *
 * Students, vendors and admins used to take different paths — vendors against
 * a hash in Mongo, everybody else against the hosted provider — which is why
 * a vendor could be signed in and a student not, on the same screen, for the
 * same reason. There is one credential check now and one kind of session.
 */
export async function signInWithEmail(input: unknown): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter your email and password." };
  }

  const email = normaliseEmail(parsed.data.email);
  const users = await db.users();
  const user = await users.findOne({ email });

  // Same message for "no such account" and "wrong password". Anything else
  // turns the sign-in form into a list of who has an account here.
  const invalid: AuthActionState = { status: "error", message: "Invalid email or password." };
  if (!user) return invalid;

  const lockedUntil = user.loginLock?.lockedUntil ? new Date(user.loginLock.lockedUntil).getTime() : 0;
  if (lockedUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60_000));
    return {
      status: "error",
      message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or reset your password.`,
    };
  }

  if (needsPasswordSetup(user)) {
    // A real account with no password here. Either it came from the old hosted
    // provider, or it has only ever used Google. Both are fixed the same way:
    // one emailed code, then a password this system actually owns.
    const outcome = await sendOtp(email, OTP_PURPOSE.PASSWORD_RESET);
    if (!outcome.ok) return otpSendOutcomeToState(outcome, email, "PASSWORD_RESET");

    return {
      status: "needs_password_setup",
      email,
      message: user.googleId
        ? `That account uses Google sign-in. To add a password, enter the code we just emailed you.`
        : `Your account needs a password on our new sign-in. We emailed you a 6-digit code.`,
      cooldownMs: outcome.cooldownMs,
    };
  }

  if (!verifyPassword(parsed.data.password, user.passwordHash ?? "")) {
    const attempts = (user.loginLock?.failedAttempts ?? 0) + 1;
    const shouldLock = attempts >= LOGIN_MAX_ATTEMPTS;

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          loginLock: {
            failedAttempts: shouldLock ? 0 : attempts,
            lockedUntil: shouldLock ? new Date(Date.now() + LOGIN_LOCKOUT_MS) : null,
          },
          updatedAt: new Date(),
        },
      },
    );

    if (shouldLock) {
      return {
        status: "error",
        message: "Too many failed attempts. Sign-in is paused for 15 minutes, or reset your password.",
      };
    }
    return invalid;
  }

  await users.updateOne(
    { _id: user._id },
    { $set: { loginLock: null, updatedAt: new Date() } },
  );

  await createSession(user._id, AUTH_METHOD.PASSWORD);
  await ensureQuickUnlockDeviceCookie(user);

  redirect(resolveLandingPath(parsed.data.redirectTo, user.role));
}

/* ------------------------------------------------------------------ */
/* Forgot password, and the pre-migration password setup               */
/* ------------------------------------------------------------------ */

const forgotSchema = z.object({ email: emailSchema });

/**
 * Sends a reset code.
 *
 * Always reports success, whether or not the address has an account. A "no
 * such user" here would let anybody test an address against our user list from
 * an unauthenticated form.
 */
export async function requestPasswordReset(input: unknown): Promise<AuthActionState> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const email = normaliseEmail(parsed.data.email);
  const user = await (await db.users()).findOne({ email });

  const pretend: AuthActionState = {
    status: "otp_sent",
    email,
    purpose: "PASSWORD_RESET",
    message: `If that address has an account, a 6-digit code is on its way. It expires in ${OTP_TTL_MINUTES} minutes.`,
    cooldownMs: OTP_RESEND_COOLDOWN_MS,
  };

  if (!user) {
    // Burn roughly the time a real send takes, so the response clock does not
    // answer the question the response body refuses to.
    await new Promise((resolve) => setTimeout(resolve, 350));
    return pretend;
  }

  const outcome = await sendOtp(email, OTP_PURPOSE.PASSWORD_RESET);
  if (!outcome.ok && outcome.reason !== "SEND_FAILED") {
    return otpSendOutcomeToState(outcome, email, "PASSWORD_RESET");
  }
  return pretend;
}

const resetSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code from your email"),
  password: passwordSchema,
  redirectTo: z.string().optional(),
});

/**
 * Redeems a reset code and sets the new password.
 *
 * Every other session for the account dies here. A reset that leaves whoever
 * prompted it still signed in elsewhere has not actually taken the account back.
 */
export async function resetPasswordWithCode(input: unknown): Promise<AuthActionState> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const email = normaliseEmail(parsed.data.email);
  const result = await verifyOtp(email, OTP_PURPOSE.PASSWORD_RESET, parsed.data.code);
  if (!result.ok) {
    return { status: "error", message: otpFailureMessage(result.reason, result.attemptsLeft) };
  }

  const users = await db.users();
  const user = await users.findOne({ email });
  if (!user) return { status: "error", message: "That account no longer exists." };

  const now = new Date();
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash: hashPassword(parsed.data.password),
        passwordChangedAt: now,
        emailVerified: true,
        loginLock: null,
        updatedAt: now,
      },
    },
  );

  // Order matters: revoke first, then open the new session, or the one we are
  // about to create is caught by our own sweep.
  await destroyAllSessions(user._id);
  await createSession(user._id, AUTH_METHOD.OTP);
  await ensureQuickUnlockDeviceCookie(user);

  const notice = passwordChangedMessage(user.name, now);
  void sendMail({ to: user.email, subject: notice.subject, html: notice.html, text: notice.text });

  redirect(resolveLandingPath(parsed.data.redirectTo, user.role));
}

/* ------------------------------------------------------------------ */
/* Sign out                                                            */
/* ------------------------------------------------------------------ */

export async function signOut(): Promise<void> {
  await destroyCurrentSession();

  const store = await cookies();
  store.delete(DEMO_USER_COOKIE);
  store.delete(VENDOR_SESSION_COOKIE);
  // The quick-unlock SESSION goes; the device trust cookie stays. Signing out
  // means "stop being signed in", not "forget my phone" — the PIN screen on
  // /signin can then mint a fresh session, which is the whole point of it.
  // "Use a different account" (forgetQuickUnlockDevice) is what forgets.
  store.delete({ name: QUICK_UNLOCK_SESSION_COOKIE, path: "/", domain: authCookieDomain() });

  redirect("/signin");
}

/** Account screen: drop every other browser, keep this one. */
export async function signOutOtherDevices(): Promise<AuthActionState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "You need to be signed in to do that." };

  const removed = await destroyAllSessions(session.user._id, { exceptCurrent: true });
  return {
    status: "success",
    message:
      removed === 0
        ? "This is the only device signed in."
        : `Signed out of ${removed} other device${removed === 1 ? "" : "s"}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Shared translation of OTP outcomes into screen state                */
/* ------------------------------------------------------------------ */

function otpSendOutcomeToState(
  outcome: Awaited<ReturnType<typeof sendOtp>>,
  email: string,
  purpose: "SIGNUP" | "PASSWORD_RESET",
): AuthActionState {
  if (outcome.ok) {
    return {
      status: "otp_sent",
      email,
      purpose,
      message: `We emailed a 6-digit code to ${email}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      cooldownMs: outcome.cooldownMs,
    };
  }

  if (outcome.reason === "COOLDOWN") {
    return {
      status: "error",
      message: `Wait ${cooldownSeconds(outcome.retryAfterMs)} seconds before asking for another code.`,
    };
  }

  if (outcome.reason === "HOURLY_LIMIT") {
    const minutes = Math.max(1, Math.ceil(outcome.retryAfterMs / 60_000));
    return {
      status: "error",
      message: `Too many codes requested for this address. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  return {
    status: "error",
    message: "We could not send the email just now. Check the address and try again in a moment.",
  };
}

function otpFailureMessage(
  reason: "NO_CODE" | "EXPIRED" | "BURNT" | "WRONG",
  attemptsLeft: number,
): string {
  switch (reason) {
    case "NO_CODE":
      return "That code is no longer valid. Ask for a new one.";
    case "EXPIRED":
      return `That code has expired. Codes last ${OTP_TTL_MINUTES} minutes — ask for a new one.`;
    case "BURNT":
      return "Too many wrong attempts on that code. Ask for a new one.";
    case "WRONG":
      return `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`;
  }
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
