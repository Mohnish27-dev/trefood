"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  RotateCcw,
  User,
  type LucideIcon,
} from "lucide-react";

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
  isVendorRole,
  type QuickUnlockDeviceState,
  type StoredQuickUnlockProfile,
} from "@/lib/quick-unlock";
import { cn } from "@/lib/utils";

interface StudentAuthFormProps {
  redirectTo: string | null;
  /**
   * Resolved on the server from the signed device cookie.
   */
  quickUnlockDevice?: QuickUnlockDeviceState | null;
  reason?: string | null | undefined;
  /** Rendered between the form and the campus footer (the stub-mode picker). */
  children?: ReactNode;
}

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
  admin: "That page needs an admin account.",
  auth_failed: "Authentication could not be completed. Please try signing in again.",
  // Only shown after the callback has already restarted the flow once on its
  // own, so "try again" is advice the student has effectively taken already.
  auth_expired:
    "Google sign-in could not be completed because this browser did not keep the sign-in cookie. Allow cookies for this site, or sign in with your email and password below.",
  google_cancelled: "Google sign-in was cancelled.",
  google_unavailable: "Google sign-in is not configured on this deployment. Use your email and password.",
  google_unverified: "Google has not verified that email address, so it cannot be used to sign in.",
};

export function StudentAuthForm({
  redirectTo,
  quickUnlockDevice = null,
  reason,
  children,
}: StudentAuthFormProps) {
  const [studentMode, setStudentMode] = useState<StudentAuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);

  const [storedProfile, setStoredProfile] = useState<StoredQuickUnlockProfile | null>(null);
  const [showQuickUnlock, setShowQuickUnlock] = useState<boolean>(false);
  const [staleProfile, setStaleProfile] = useState(false);

  const deviceTrusted = Boolean(quickUnlockDevice?.trusted);
  const deviceIsVendor = deviceTrusted && isVendorRole(quickUnlockDevice?.role);
  const quickUnlockDismissedRef = useRef(false);

  useEffect(() => {
    // If this device holds a vendor role, vendor login handles it.
    if (deviceIsVendor) return;

    const timer = setTimeout(() => {
      const profile = getStoredQuickUnlockProfile();

      if (!deviceTrusted) {
        if (profile?.pinHash) {
          clearStoredQuickUnlockProfile();
          setStaleProfile(true);
        }
        return;
      }

      const role = quickUnlockDevice?.role ?? null;

      if (profile?.pinHash && profile.userId === quickUnlockDevice?.userId) {
        setStoredProfile({ ...profile, role });
      } else if (quickUnlockDevice?.userId) {
        setStoredProfile({
          userId: quickUnlockDevice.userId,
          name: quickUnlockDevice.name ?? "",
          email: quickUnlockDevice.email ?? "",
          pinHash: "",
          pinSalt: "",
          biometricEnabled: quickUnlockDevice.biometricEnabled,
          credentialId: null,
          requireOnOpen: true,
          role,
          updatedAt: Date.now(),
        });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [deviceTrusted, deviceIsVendor, quickUnlockDevice]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Student form fields
  const [name, setName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  // The six-digit code screen, and the new password it collects on a reset.
  const [codeStep, setCodeStep] = useState<CodeStep | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resendIn, setResendIn] = useState(0);

  /**
   * Counts the resend cooldown down once a second.
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

  if (showQuickUnlock && storedProfile) {
    return (
      <div className="light auth-theme w-full max-w-md mx-auto min-h-dvh flex flex-col justify-center px-4 py-8 bg-tf-cream text-tf-ink">
        <QuickUnlockScreen
          profile={storedProfile}
          redirectTo={redirectTo}
          onSwitchAccount={() => {
            quickUnlockDismissedRef.current = true;
            setShowQuickUnlock(false);
          }}
        />
      </div>
    );
  }

  const isAdminRedirect = Boolean(redirectTo && /^\/admin(\/|$)/.test(redirectTo));

  const switchStudentMode = (mode: StudentAuthMode) => {
    setStudentMode(mode);
    setError(null);
    setSuccessMessage(null);
  };

  /** The two-tone headline under the artwork: plain lead, maroon accent. */
  const heading: { lead: string; accent: string; sub: string } =
    codeStep
      ? { lead: "Check your ", accent: "email", sub: "Enter the 6-digit code we just sent." }
      : studentMode === "signup"
        ? { lead: "Join ", accent: "TreFood!", sub: "Create your account in under a minute." }
        : studentMode === "forgot"
          ? { lead: "Reset your ", accent: "password", sub: "We will email you a 6-digit code." }
          : {
              lead: "Welcome to ",
              accent: "TreFood!",
              sub: isAdminRedirect
                ? "Sign in with your admin account to continue."
                : "Good Food. More Choices. Closer to You.",
            };

  return (
    <div className="light auth-theme relative w-full max-w-md mx-auto min-h-dvh flex flex-col bg-tf-cream text-tf-ink shadow-2xl">
      {/* ── Hero artwork: wordmark, tagline, categories and the food spread ── */}
      <header className="relative">
        <Image
          src="/images/auth/login-hero.webp"
          alt="TreFood, the campus commerce platform. Everything you need in one place: food, fruits, groceries, snacks and dine-out."
          width={1376}
          height={1602}
          priority
          sizes="(max-width: 448px) 100vw, 448px"
          className="block w-full h-auto select-none"
        />
        <Link
          href="/"
          className="absolute top-3 right-3 inline-flex items-center gap-0.5 rounded-full ring-1 ring-white/25 bg-black/25 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold text-white/90 hover:bg-black/40 transition-colors"
        >
          <span>Skip</span>
          <ChevronRight className="size-3" />
        </Link>
      </header>

      {/* ── Form ── */}
      <section className="flex-1 px-7 pt-1 pb-4">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tf-ink">
          {heading.lead}
          <span className="text-tf-maroon">{heading.accent}</span>
        </h1>
        <p className="mt-1 text-[15px] text-[#5a5655]">{heading.sub}</p>

        <div className="mt-5 space-y-3">
          {/* Reason Alert if redirected */}
          {reason && REASONS[reason] ? (
            <p className="rounded-xl ring-1 ring-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              {REASONS[reason]}
            </p>
          ) : null}

          {/* Error / Success Alerts */}
          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl ring-1 ring-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="flex items-start gap-2.5 rounded-xl ring-1 ring-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          {/* Stale Profile Alert */}
          {staleProfile ? (
            <div className="flex items-start gap-2.5 rounded-xl ring-1 ring-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <KeyRound className="size-4 shrink-0 mt-0.5" />
              <span>Sign in once below to switch your 4-digit PIN back on for this phone.</span>
            </div>
          ) : null}

          {/* Quick PIN Banner for Students */}
          {storedProfile && !deviceIsVendor ? (
            <div className="flex items-center justify-between gap-3 rounded-xl ring-1 ring-tf-maroon/25 bg-white p-3 text-xs shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <KeyRound className="size-4 shrink-0 text-tf-maroon" />
                <span className="truncate">
                  Quick PIN is ready for{" "}
                  <strong className="text-tf-maroon">
                    {storedProfile.name || storedProfile.email}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickUnlock(true)}
                className="shrink-0 rounded-lg bg-tf-maroon px-3 py-1.5 font-semibold text-white hover:bg-tf-maroon-deep transition-colors cursor-pointer"
              >
                Use PIN
              </button>
            </div>
          ) : null}
        </div>

        {/* ── Code step: shown instead of the whole student form ── */}
        {codeStep ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3 rounded-xl ring-1 ring-tf-maroon/20 bg-white p-3.5">
              <MailCheck className="size-5 shrink-0 text-tf-maroon mt-0.5" />
              <p className="min-w-0 text-xs leading-relaxed text-[#5a5655]">
                We sent a 6-digit code to{" "}
                <strong className="text-tf-ink break-all">{codeStep.email}</strong>.
              </p>
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
                onComplete={codeStep.kind === "signup" ? (v) => void submitCode(v) : undefined}
              />

              {codeStep.kind === "reset" ? (
                <div className="space-y-1.5">
                  <AuthInput
                    icon={Lock}
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Choose a new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    disabled={loading}
                    reveal={{ shown: showPassword, toggle: () => setShowPassword(!showPassword) }}
                  />
                  <p className="pl-1 text-[11px] text-[#7a7472]">
                    At least 8 characters, with a letter and a number.
                  </p>
                </div>
              ) : null}

              <PrimaryButton loading={loading} disabled={code.length !== 6}>
                {codeStep.kind === "signup" ? "Verify and continue" : "Set password and login"}
              </PrimaryButton>
            </form>

            <div className="flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={resendIn > 0 || loading}
                className="inline-flex items-center gap-1.5 font-semibold text-tf-maroon hover:underline disabled:text-[#9a918e] disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}</span>
              </button>

              <button
                type="button"
                onClick={leaveCodeStep}
                className="font-medium text-[#5a5655] hover:text-tf-ink cursor-pointer"
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={(e) => void handleStudentSubmit(e)} className="mt-4 space-y-3">
              {studentMode === "signup" ? (
                <AuthInput
                  icon={User}
                  id="student-name"
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  disabled={loading}
                />
              ) : null}

              <AuthInput
                icon={Mail}
                id="student-email"
                type="email"
                placeholder={isAdminRedirect ? "Admin email ID" : "Email ID"}
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />

              {studentMode !== "forgot" ? (
                <AuthInput
                  icon={Lock}
                  id="student-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={studentMode === "signup" ? "Create a password" : "Password"}
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  required
                  minLength={studentMode === "signup" ? 8 : 1}
                  autoComplete={studentMode === "signup" ? "new-password" : "current-password"}
                  disabled={loading}
                  reveal={{ shown: showPassword, toggle: () => setShowPassword(!showPassword) }}
                />
              ) : null}

              {studentMode === "signup" ? (
                <p className="pl-1 text-[11px] text-[#7a7472]">
                  At least 8 characters, with a letter and a number.
                </p>
              ) : null}

              {studentMode === "signin" ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchStudentMode("forgot")}
                    className="text-[15px] font-medium text-tf-maroon hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              ) : null}

              <div className="pt-1">
                <PrimaryButton loading={loading}>
                  {studentMode === "signin"
                    ? isAdminRedirect
                      ? "Login to Admin Console"
                      : "Login"
                    : studentMode === "signup"
                      ? "Create account"
                      : "Email me a reset code"}
                </PrimaryButton>
              </div>
            </form>

            {googleEnabled && studentMode !== "forgot" ? (
              <>
                <div className="my-5 flex items-center gap-4">
                  <div className="h-px flex-1 bg-[#d9cdc9]" />
                  <span className="text-sm font-medium text-tf-ink/80">OR</span>
                  <div className="h-px flex-1 bg-[#d9cdc9]" />
                </div>

                <a
                  href={googleHref}
                  className="flex h-13 w-full items-center justify-center gap-3 rounded-xl border bg-white text-[15px] font-medium text-tf-ink shadow-[0_4px_14px_rgba(84,0,24,0.08)] hover:bg-[#fffaf8] active:scale-[0.99] transition-all"
                >
                  <GoogleIcon className="size-6 shrink-0" />
                  <span>Continue with Google</span>
                </a>
              </>
            ) : null}

            <p className="mt-6 text-center text-[15px] text-[#4f4a49]">
              {studentMode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => switchStudentMode(studentMode === "signin" ? "signup" : "signin")}
                className="inline-flex items-center gap-1 font-bold text-tf-maroon hover:underline cursor-pointer"
              >
                <span>{studentMode === "signin" ? "Sign Up" : "Login"}</span>
                <ArrowRight className="size-4" />
              </button>
            </p>
          </>
        )}
      </section>

      {children}

      {/* ── Campus skyline footer ── */}
      <footer className="mt-auto">
        <Image
          src="/images/auth/login-footer.webp"
          alt="Powered for campuses"
          width={1376}
          height={318}
          sizes="(max-width: 448px) 100vw, 448px"
          className="block w-full h-auto select-none"
        />
      </footer>
    </div>
  );
}

/** The bordered, icon-led field from the campus sign-in design. */
function AuthInput({
  icon: Icon,
  reveal,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: LucideIcon;
  reveal?: { shown: boolean; toggle: () => void };
}) {
  return (
    <div className="relative flex items-center">
      <Icon
        className="absolute left-4 size-5 text-[#3d3a39] pointer-events-none"
        strokeWidth={1.75}
      />
      <input
        {...props}
        aria-label={props.placeholder}
        className={cn(
          "h-13 w-full rounded-xl border bg-white pl-13 text-[15px] text-tf-ink placeholder:text-[#7a7472] focus:outline-none focus:ring-1 focus:ring-tf-maroon disabled:opacity-60 transition-all",
          reveal ? "pr-12" : "pr-4",
          className,
        )}
      />
      {reveal ? (
        <button
          type="button"
          onClick={reveal.toggle}
          aria-label={reveal.shown ? "Hide password" : "Show password"}
          className="absolute right-3 p-1 text-[#3d3a39] hover:text-tf-ink focus:outline-none cursor-pointer"
        >
          {reveal.shown ? (
            <Eye className="size-5" strokeWidth={1.75} />
          ) : (
            <EyeOff className="size-5" strokeWidth={1.75} />
          )}
        </button>
      ) : null}
    </div>
  );
}

/** The full-width maroon submit button, label centred and arrow on the right. */
function PrimaryButton({
  loading,
  disabled,
  children,
}: {
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="relative flex h-13 w-full items-center justify-center rounded-xl bg-tf-maroon text-lg font-semibold text-white shadow-lg shadow-tf-maroon/25 hover:bg-[#6e001b] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
    >
      {loading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <>
          <span>{children}</span>
          <ArrowRight className="absolute right-5 size-6" />
        </>
      )}
    </button>
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
