"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  RotateCcw,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  requestPasswordReset,
  resendCode,
  resetPasswordWithCode,
  signInWithEmail,
  signUpWithEmail,
  verifySignupCode,
} from "@/server/actions/session";
import { OtpCodeInput } from "@/components/student/otp-code-input";
import { clientEnv } from "@/lib/env";
import { QuickUnlockScreen } from "@/components/student/quick-unlock-screen";
import {
  clearStoredQuickUnlockProfile,
  getStoredQuickUnlockProfile,
  type QuickUnlockDeviceState,
  type StoredQuickUnlockProfile,
} from "@/lib/quick-unlock";
import { cn } from "@/lib/utils";

interface StudentAuthFormProps {
  redirectTo: string | null;
  initialType?: "student" | "vendor";
  /**
   * Resolved on the server from the signed device cookie.
   */
  quickUnlockDevice?: QuickUnlockDeviceState | null;
  reason?: string | null | undefined;
}

type UserType = "student" | "vendor";
type StudentAuthMode = "signin" | "signup" | "forgot";

/**
 * The code screen, when one is showing.
 *
 * `signup` finishes creating the account; `reset` also collects a new
 * password, and covers both "forgot password" and an account that predates
 * TREFOOD owning its own sign-in.
 */
interface CodeStep {
  kind: "signup" | "reset";
  email: string;
  /** Epoch ms before which the resend button stays disabled. */
  resendAt: number;
}

const REASONS: Record<string, string> = {
  vendor: "That account is not linked to a restaurant. Pick a vendor account below.",
  admin: "That page needs an admin account.",
  auth_failed: "Authentication could not be completed. Please try signing in again.",
  auth_expired: "That sign-in attempt took too long. Try again.",
  google_cancelled: "Google sign-in was cancelled.",
  google_unavailable: "Google sign-in is not configured on this deployment. Use your email and password.",
  google_unverified: "Google has not verified that email address, so it cannot be used to sign in.",
};

export function StudentAuthForm({
  redirectTo,
  initialType = "student",
  quickUnlockDevice = null,
  reason,
}: StudentAuthFormProps) {
  const [userType, setUserType] = useState<UserType>(initialType);
  const [studentMode, setStudentMode] = useState<StudentAuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [showVendorPassword, setShowVendorPassword] = useState(false);

  const [storedProfile, setStoredProfile] = useState<StoredQuickUnlockProfile | null>(null);
  const [showQuickUnlock, setShowQuickUnlock] = useState<boolean>(false);
  const [staleProfile, setStaleProfile] = useState(false);

  const deviceTrusted = Boolean(quickUnlockDevice?.trusted);

  useEffect(() => {
    const timer = setTimeout(() => {
      const profile = getStoredQuickUnlockProfile();

      if (!deviceTrusted) {
        if (profile?.pinHash) {
          clearStoredQuickUnlockProfile();
          setStaleProfile(true);
        }
        return;
      }

      if (profile?.pinHash) {
        setStoredProfile(profile);
        return;
      }

      if (quickUnlockDevice?.userId) {
        setStoredProfile({
          userId: quickUnlockDevice.userId,
          name: quickUnlockDevice.name ?? "",
          email: quickUnlockDevice.email ?? "",
          pinHash: "",
          pinSalt: "",
          biometricEnabled: quickUnlockDevice.biometricEnabled,
          credentialId: null,
          requireOnOpen: true,
          updatedAt: Date.now(),
        });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [deviceTrusted, quickUnlockDevice]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Student form fields
  const [name, setName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  // Vendor form fields
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorPassword, setVendorPassword] = useState("");

  // The six-digit code screen, and the new password it collects on a reset.
  const [codeStep, setCodeStep] = useState<CodeStep | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resendIn, setResendIn] = useState(0);

  /**
   * Counts the resend cooldown down once a second.
   *
   * The server enforces the real limit; this only stops somebody hammering a
   * button that is going to be refused, and tells them how long to wait.
   */
  useEffect(() => {
    if (!codeStep) return;

    const tick = () => {
      setResendIn(Math.max(0, Math.ceil((codeStep.resendAt - Date.now()) / 1000)));
    };
    tick();

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [codeStep]);

  const explicitNext =
    redirectTo && redirectTo !== "/" && /^\/(?!\/)/.test(redirectTo) ? redirectTo : null;

  /**
   * Google sign-in is a plain link, not a click handler.
   *
   * The flow is a top-level navigation to Google and back, so a link is what
   * it actually is — and it keeps working before React has hydrated, which the
   * old JavaScript-only button did not.
   */
  const googleEnabled = clientEnv.NEXT_PUBLIC_GOOGLE_ENABLED;

  const googleHref = explicitNext
    ? `/api/auth/google/start?next=${encodeURIComponent(explicitNext)}`
    : "/api/auth/google/start";

  /** Every action returns the same union; this is the one place it is read. */
  const applyState = (
    state: Awaited<ReturnType<typeof signInWithEmail>>,
    fallbackKind: "signup" | "reset",
  ): void => {
    if (state.status === "error") {
      setError(state.message);
      return;
    }

    if (state.status === "otp_sent") {
      setCodeStep({
        kind: state.purpose === "SIGNUP" ? "signup" : "reset",
        email: state.email,
        resendAt: Date.now() + state.cooldownMs,
      });
      setCode("");
      setSuccessMessage(state.message);
      return;
    }

    if (state.status === "needs_password_setup") {
      setCodeStep({ kind: "reset", email: state.email, resendAt: Date.now() + state.cooldownMs });
      setCode("");
      setSuccessMessage(state.message);
      return;
    }

    if (state.status === "success") {
      setSuccessMessage(state.message ?? "Done.");
      return;
    }

    // "idle" only reaches here if an action returns before doing anything.
    setCodeStep((current) => current ?? { kind: fallbackKind, email: studentEmail, resendAt: 0 });
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (studentMode === "signin") {
        // A successful sign-in redirects from the server and never returns.
        applyState(
          await signInWithEmail({
            email: studentEmail,
            password: studentPassword,
            ...(redirectTo ? { redirectTo } : {}),
          }),
          "reset",
        );
      } else if (studentMode === "signup") {
        applyState(
          await signUpWithEmail({
            name,
            email: studentEmail,
            password: studentPassword,
            ...(redirectTo ? { redirectTo } : {}),
          }),
          "signup",
        );
      } else {
        applyState(await requestPasswordReset({ email: studentEmail }), "reset");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication request failed.");
    } finally {
      setLoading(false);
    }
  };

  /** Redeems the code. On success the server redirects, so nothing returns. */
  const submitCode = async (value: string) => {
    if (!codeStep || loading) return;

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const state =
        codeStep.kind === "signup"
          ? await verifySignupCode({
              email: codeStep.email,
              code: value,
              ...(redirectTo ? { redirectTo } : {}),
            })
          : await resetPasswordWithCode({
              email: codeStep.email,
              code: value,
              password: newPassword,
              ...(redirectTo ? { redirectTo } : {}),
            });

      if (state.status === "error") {
        setError(state.message);
        setCode("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not verify that code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!codeStep || resendIn > 0 || loading) return;

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const state = await resendCode({
        email: codeStep.email,
        purpose: codeStep.kind === "signup" ? "SIGNUP" : "PASSWORD_RESET",
      });

      if (state.status === "error") {
        setError(state.message);
      } else if (state.status === "otp_sent") {
        setCodeStep({ ...codeStep, resendAt: Date.now() + state.cooldownMs });
        setCode("");
        setSuccessMessage(state.message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  };

  const leaveCodeStep = () => {
    setCodeStep(null);
    setCode("");
    setNewPassword("");
    setError(null);
    setSuccessMessage(null);
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await signInWithEmail({
        email: vendorEmail,
        password: vendorPassword,
        ...(redirectTo ? { redirectTo } : {}),
      });

      if (res.status === "error") {
        setError(res.message);
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Vendor sign-in failed.");
      setLoading(false);
    }
  };

  if (showQuickUnlock && storedProfile) {
    return (
      <div className="w-full max-w-md mx-auto min-h-dvh flex flex-col justify-center px-4 py-8">
        <QuickUnlockScreen
          profile={storedProfile}
          redirectTo={redirectTo}
          onSwitchAccount={() => setShowQuickUnlock(false)}
        />
      </div>
    );
  }

  const isAdminRedirect = Boolean(redirectTo && /^\/admin(\/|$)/.test(redirectTo));

  return (
    <div className="relative w-full max-w-md mx-auto min-h-dvh bg-ink text-bone flex flex-col justify-between overflow-hidden shadow-2xl">
      {/* ── Background Photo Layer ── */}
      <div className="absolute inset-x-0 top-0 h-[480px] sm:h-[520px] w-full overflow-hidden pointer-events-none z-0">
        <Image
          src="/images/auth-hero.jpg"
          alt="TREFOOD Food and Drinks"
          fill
          priority
          className="object-cover object-[82%_24%]"
          unoptimized
        />
        {/* Soft top gradient for header legibility */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-ink/60 via-ink/20 to-transparent" />

        {/* Left-to-right gradient protecting text while keeping the food crisp and bright on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/80 via-40% to-transparent to-70%" />

        {/* Bottom gradient blending smoothly into the ink background above Continue with Google */}
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-ink via-ink/80 via-30% to-transparent" />
      </div>

      {/* ── Content Layer ── */}
      <div className="relative z-10 flex flex-col flex-1 px-5 pt-4 pb-6 justify-between">
        {/* Top bar: Brand + Skip button */}
        <div>
          <div className="flex items-center justify-between pb-3">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
              <div className="relative size-10 overflow-hidden rounded-xl border border-saffron/30 shadow-md">
                <Image
                  src="/logo.png"
                  alt="TREFOOD Logo"
                  width={40}
                  height={40}
                  className="size-full object-cover"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-lg font-black tracking-tight text-bone leading-none">
                  TREFOOD
                </span>
                <span className="text-[9px] font-semibold tracking-[0.22em] text-muted uppercase mt-0.5">
                  FOOD • FRUITS • JUICES
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/"
                className="inline-flex items-center gap-1 rounded-full border border-line/90 bg-surface/70 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-bone hover:border-white/40 hover:bg-surface-raised transition-all"
              >
                <span>Skip</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Script Callout */}
          <div className="relative inline-block select-none rotate-[-4deg] self-start mt-2 mb-1">
            <span className="font-handwriting text-2xl text-bone/95 leading-[1.1] block">
              Good<br />Food<br />Brighter<br />Campus Days
            </span>
            <svg className="w-28 h-2 text-saffron mt-0.5" viewBox="0 0 100 10" fill="none">
              <path
                d="M2 5 Q 50 9 98 4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Hero Headline */}
          <div className="mt-1 mb-4">
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-bone leading-[1.12]">
              {userType === "student" ? (
                <>
                  Food, Fruits,<br />
                  Juices for<br />
                  <span className="text-saffron">every student.</span>
                </>
              ) : (
                <>
                  Partner with,<br />
                  Cook &amp; deliver to<br />
                  <span className="text-saffron">every hostel.</span>
                </>
              )}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed max-w-[300px]">
              {userType === "student"
                ? "Order from your favourite campus restaurants in a few taps."
                : "Sign in to your restaurant dashboard to manage orders and menu."}
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="space-y-3.5 my-auto">
          {/* Reason Alert if redirected */}
          {reason && REASONS[reason] ? (
            <p className="rounded-xl border border-amber/30 bg-amber-wash/90 p-3 text-xs text-amber">
              {REASONS[reason]}
            </p>
          ) : null}

          {/* Error / Success Alerts */}
          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-chili/30 bg-chili-wash/90 p-3 text-xs text-chili">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-mint/30 bg-mint-wash/90 p-3 text-xs text-mint">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          {/* Stale Profile Alert */}
          {staleProfile && userType === "student" ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber/30 bg-amber-wash/90 p-3 text-xs text-amber shadow-sm">
              <KeyRound className="size-4 shrink-0 mt-0.5" />
              <span>
                Sign in once below to switch your 4-digit PIN back on for this phone.
              </span>
            </div>
          ) : null}

          {/* Quick PIN Banner */}
          {storedProfile && userType === "student" ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-saffron/40 bg-saffron-wash/90 backdrop-blur-md p-3.5 text-xs shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <KeyRound className="size-4 shrink-0 text-saffron" />
                <span className="truncate text-bone">
                  Quick PIN is ready for{" "}
                  <strong className="text-saffron">
                    {storedProfile.name || storedProfile.email}
                  </strong>
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowQuickUnlock(true)}
                className="shrink-0 text-xs border-saffron/50 font-semibold bg-surface hover:bg-surface-raised cursor-pointer"
              >
                Use PIN
              </Button>
            </div>
          ) : null}

          {/* ── Code step: shown instead of the whole student form ── */}
          {userType === "student" && codeStep ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-saffron/30 bg-saffron-wash/80 backdrop-blur-md p-3.5">
                <MailCheck className="size-5 shrink-0 text-saffron mt-0.5" />
                <div className="min-w-0 text-xs leading-relaxed">
                  <p className="font-semibold text-bone">Check your email</p>
                  <p className="text-muted">
                    We sent a 6-digit code to{" "}
                    <strong className="text-bone break-all">{codeStep.email}</strong>.
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitCode(code);
                }}
                className="space-y-3.5"
              >
                <OtpCodeInput
                  value={code}
                  onChange={setCode}
                  disabled={loading}
                  // A reset needs a password too, so completing the code must
                  // not fire the request before that field has been filled in.
                  onComplete={codeStep.kind === "signup" ? (v) => void submitCode(v) : undefined}
                />

                {codeStep.kind === "reset" ? (
                  <div className="space-y-1.5">
                    <div className="relative flex items-center">
                      <Lock className="absolute left-4 size-4 text-muted pointer-events-none" />
                      <input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Choose a new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        disabled={loading}
                        className="w-full rounded-2xl border border-line/80 bg-surface/90 backdrop-blur-sm pl-11 pr-11 py-3.5 text-sm text-bone placeholder:text-muted/60 focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3.5 text-muted hover:text-bone focus:outline-none p-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <p className="pl-2 text-[11px] text-muted/70">
                      At least 8 characters, with a letter and a number.
                    </p>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  block
                  size="lg"
                  disabled={loading || code.length !== 6}
                  className="rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-saffron/20 active:scale-[0.99] transition-all cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {codeStep.kind === "signup" ? "Verify and continue" : "Set password and sign in"}
                      </span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={resendIn > 0 || loading}
                  className="inline-flex items-center gap-1.5 font-semibold text-saffron hover:underline disabled:text-muted disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                  <span>{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}</span>
                </button>

                <button
                  type="button"
                  onClick={leaveCodeStep}
                  className="font-medium text-muted hover:text-bone cursor-pointer"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : null}

          {/* Student Auth: Google OAuth */}
          {userType === "student" && !codeStep ? (
            <>
              {/* Rendered only when a Google client is actually configured.
                  A button that always shows and sometimes dead-ends on
                  Google's own error page is worse than no button. */}
              {googleEnabled ? (
                <>
                  <a
                    href={googleHref}
                    className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-white text-zinc-900 font-semibold text-sm shadow-md hover:bg-zinc-100 active:scale-[0.99] transition-all border border-zinc-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <GoogleIcon className="size-5 shrink-0" />
                      <span className="font-semibold text-zinc-900 text-[14px]">
                        Continue with Google
                      </span>
                    </div>
                    <ArrowRight className="size-4 text-zinc-700" />
                  </a>

                  {/* OR Divider */}
                  <div className="relative flex items-center justify-center my-3">
                    <div className="w-full border-t border-line/60" />
                    <span className="absolute bg-ink px-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
                      OR
                    </span>
                  </div>
                </>
              ) : null}

              {/* Sign in / Sign up / Reset tabs */}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface/80 backdrop-blur-md p-1 border border-line">
                <button
                  type="button"
                  onClick={() => {
                    setStudentMode("signin");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={cn(
                    "rounded-lg py-2 text-xs font-semibold tracking-wide transition-all cursor-pointer",
                    studentMode === "signin"
                      ? "bg-surface-raised text-bone shadow-sm"
                      : "text-muted hover:text-bone",
                  )}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudentMode("signup");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={cn(
                    "rounded-lg py-2 text-xs font-semibold tracking-wide transition-all cursor-pointer",
                    studentMode === "signup"
                      ? "bg-surface-raised text-bone shadow-sm"
                      : "text-muted hover:text-bone",
                  )}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudentMode("forgot");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={cn(
                    "rounded-lg py-2 text-xs font-semibold tracking-wide transition-all cursor-pointer",
                    studentMode === "forgot"
                      ? "bg-surface-raised text-bone shadow-sm"
                      : "text-muted hover:text-bone",
                  )}
                >
                  Reset
                </button>
              </div>

              {/* Student Auth Form */}
              <form onSubmit={(e) => void handleStudentSubmit(e)} className="space-y-3 pt-1">
                {studentMode === "signup" ? (
                  <div className="relative flex items-center">
                    <User className="absolute left-4 size-4 text-muted pointer-events-none" />
                    <input
                      id="student-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full rounded-2xl border border-line/80 bg-surface/90 backdrop-blur-sm pl-11 pr-4 py-3.5 text-sm text-bone placeholder:text-muted/60 focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron transition-all"
                    />
                  </div>
                ) : null}

                <div>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 size-4 text-muted pointer-events-none" />
                    <input
                      id="student-email"
                      type="email"
                      placeholder={
                        isAdminRedirect ? "Enter admin email" : "Enter your college email"
                      }
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full rounded-2xl border border-line/80 bg-surface/90 backdrop-blur-sm pl-11 pr-4 py-3.5 text-sm text-bone placeholder:text-muted/60 focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron transition-all"
                    />
                  </div>
                  {!isAdminRedirect && (
                    <p className="mt-1 text-[11px] text-muted/70 pl-2">
                      e.g. student@nitp.ac.in
                    </p>
                  )}
                </div>

                {studentMode !== "forgot" ? (
                  <div className="space-y-1.5">
                    <div className="relative flex items-center">
                      <Lock className="absolute left-4 size-4 text-muted pointer-events-none" />
                      <input
                        id="student-password"
                        type={showPassword ? "text" : "password"}
                        placeholder={
                          studentMode === "signup" ? "Create a password" : "Enter your password"
                        }
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        required
                        minLength={studentMode === "signup" ? 8 : 1}
                        autoComplete={
                          studentMode === "signup" ? "new-password" : "current-password"
                        }
                        disabled={loading}
                        className="w-full rounded-2xl border border-line/80 bg-surface/90 backdrop-blur-sm pl-11 pr-11 py-3.5 text-sm text-bone placeholder:text-muted/60 focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3.5 text-muted hover:text-bone focus:outline-none p-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>

                    {studentMode === "signup" ? (
                      <p className="pl-2 text-[11px] text-muted/70">
                        At least 8 characters, with a letter and a number.
                      </p>
                    ) : null}

                    {studentMode === "signin" ? (
                      <div className="flex justify-end pr-1">
                        <button
                          type="button"
                          onClick={() => {
                            setStudentMode("forgot");
                            setError(null);
                          }}
                          className="text-xs font-medium text-saffron hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  block
                  size="lg"
                  disabled={loading}
                  className="rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-saffron/20 active:scale-[0.99] transition-all mt-1 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {studentMode === "signin"
                          ? (isAdminRedirect ? "Sign in to Admin Console" : "Sign in")
                          : studentMode === "signup"
                            ? "Create account"
                            : "Email me a reset code"}
                      </span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Bottom toggle between sign in and sign up */}
              <div className="text-center text-xs text-muted pt-1">
                {studentMode === "signin" ? (
                  <span>
                    New to TreFood?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setStudentMode("signup");
                        setError(null);
                      }}
                      className="font-semibold text-saffron hover:underline cursor-pointer"
                    >
                      Create an account
                    </button>
                  </span>
                ) : studentMode === "signup" ? (
                  <span>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setStudentMode("signin");
                        setError(null);
                      }}
                      className="font-semibold text-saffron hover:underline cursor-pointer"
                    >
                      Sign in
                    </button>
                  </span>
                ) : (
                  <span>
                    Remember your password?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setStudentMode("signin");
                        setError(null);
                      }}
                      className="font-semibold text-saffron hover:underline cursor-pointer"
                    >
                      Sign in
                    </button>
                  </span>
                )}
              </div>
            </>
          ) : userType === "vendor" ? (
            /* ── Vendor View ── */
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-surface/80 backdrop-blur p-3.5 text-xs text-muted leading-relaxed">
                <p className="font-semibold text-bone mb-0.5">
                  Vendor &amp; Restaurant Partner Console
                </p>
                Sign in using the email and password provided by the campus administrator when your
                restaurant was onboarded.
              </div>

              <form onSubmit={(e) => void handleVendorSubmit(e)} className="space-y-3">
                <div className="space-y-1">
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 size-4 text-muted pointer-events-none" />
                    <input
                      id="vendor-auth-email"
                      type="email"
                      placeholder="Enter vendor email"
                      value={vendorEmail}
                      onChange={(e) => setVendorEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full rounded-2xl border border-line/80 bg-surface/90 backdrop-blur-sm pl-11 pr-4 py-3.5 text-sm text-bone placeholder:text-muted/60 focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-muted/70 pl-2">e.g. owner@canteen.in</p>
                </div>

                <div className="relative flex items-center">
                  <Lock className="absolute left-4 size-4 text-muted pointer-events-none" />
                  <input
                    id="vendor-auth-password"
                    type={showVendorPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={vendorPassword}
                    onChange={(e) => setVendorPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full rounded-2xl border border-line/80 bg-surface/90 backdrop-blur-sm pl-11 pr-11 py-3.5 text-sm text-bone placeholder:text-muted/60 focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVendorPassword(!showVendorPassword)}
                    aria-label={showVendorPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 text-muted hover:text-bone focus:outline-none p-1 cursor-pointer"
                  >
                    {showVendorPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  block
                  size="lg"
                  disabled={loading}
                  className="rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-saffron/20 active:scale-[0.99] transition-all mt-1 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <>
                      <span>Sign in to Vendor Console</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          ) : null}
        </div>

        {/* ── Food / Fruits / Juices Category Badges (from photo 2) ── */}
        <div className="mt-4">
          <div className="grid grid-cols-3 divide-x divide-line/60 py-4 my-2 border-y border-line/40">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-9 items-center justify-center text-saffron">
                <BurgerIcon className="size-6" />
              </div>
              <span className="text-xs font-semibold text-bone">Food</span>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-9 items-center justify-center text-chili">
                <AppleIcon className="size-6" />
              </div>
              <span className="text-xs font-semibold text-bone">Fruits</span>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-9 items-center justify-center text-amber">
                <JuiceCupIcon className="size-6" />
              </div>
              <span className="text-xs font-semibold text-bone">Juices</span>
            </div>
          </div>

          {/* ── Footer: Built for students + Restaurant partner (down right corner) ── */}
          <div className="flex items-center justify-between gap-3 pt-2 text-xs">
            {/* Left: Built for Students */}
            <div className="flex items-center gap-2.5 text-left">
              <GraduationCap className="size-6 text-muted shrink-0" />
              <div className="leading-tight">
                <p className="font-semibold text-bone text-xs">Built for Students.</p>
                <p className="text-[10px] text-muted">Powered for Every Campus.</p>
              </div>
            </div>

            {/* Right: Restaurant partner down right corner */}
            <div className="text-right leading-tight">
              <p className="text-xs text-muted">
                {userType === "student" ? "Restaurant partner?" : "Student ordering?"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setUserType(userType === "student" ? "vendor" : "student");
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="inline-flex items-center gap-1 font-semibold text-saffron hover:underline mt-0.5 cursor-pointer"
              >
                <span>{userType === "student" ? "Sign in here" : "Sign in here"}</span>
                <ArrowRight className="size-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function BurgerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 11c0-4.4 3.6-8 8-8s8 3.6 8 8H4z" />
      <circle cx="8" cy="7" r="0.75" fill="currentColor" />
      <circle cx="12" cy="6" r="0.75" fill="currentColor" />
      <circle cx="16" cy="7.5" r="0.75" fill="currentColor" />
      <path d="M3 13.5c1 0 1.5.7 2.5.7s1.5-.7 2.5-.7 1.5.7 2.5.7 1.5-.7 2.5-.7 1.5.7 2.5.7 1.5-.7 2.5-.7 1.5.7 2.5.7" />
      <path d="M4 17h16a1 1 0 0 1 1 1c0 1.7-2 3-9 3s-9-1.3-9-3a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21c-2.5 0-4.5-1.5-6.5-1.5-2.2 0-3.5 2-3.5-5 0-4.4 3.4-7.5 7.5-7.5 1.5 0 2.5.5 2.5.5s1-.5 2.5-.5c4.1 0 7.5 3.1 7.5 7.5 0 7-1.3 5-3.5 5-2 0-4 1.5-6.5 1.5z" />
      <path d="M12 7c0-2.5 1.5-4 3-4" />
      <path d="M15 3c-.5 1.5-1.8 2.2-3 2.5" />
    </svg>
  );
}

function JuiceCupIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 8.5l1.6 11.2c.2 1.3 1.3 2.3 2.6 2.3h2.6c1.3 0 2.4-1 2.6-2.3l1.6-11.2" />
      <path d="M5 8.5h14" />
      <path d="M11 8.5V4l4-2" />
    </svg>
  );
}
