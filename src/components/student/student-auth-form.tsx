"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { signInWithEmail, signUpWithEmail, sendMagicLink } from "@/server/actions/session";
import { QuickUnlockScreen } from "@/components/student/quick-unlock-screen";
import { getStoredQuickUnlockProfile, type StoredQuickUnlockProfile } from "@/lib/quick-unlock";

interface StudentAuthFormProps {
  redirectTo: string | null;
  initialType?: "student" | "vendor";
}

type UserType = "student" | "vendor";
type StudentAuthMode = "signin" | "signup" | "magic";

export function StudentAuthForm({ redirectTo, initialType = "student" }: StudentAuthFormProps) {
  const [userType, setUserType] = useState<UserType>(initialType);
  const [studentMode, setStudentMode] = useState<StudentAuthMode>("signin");

  const [storedProfile, setStoredProfile] = useState<StoredQuickUnlockProfile | null>(null);
  const [showQuickUnlock, setShowQuickUnlock] = useState<boolean>(false);

  useEffect(() => {
    const profile = getStoredQuickUnlockProfile();
    if (profile && profile.pinHash) {
      setStoredProfile(profile);
      setShowQuickUnlock(true);
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Student form fields
  const [name, setName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  // Vendor form fields
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorPassword, setVendorPassword] = useState("");

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const target = redirectTo && /^\/(?!\/)/.test(redirectTo) ? redirectTo : "/";
      const redirectCallback = `${origin}/auth/callback?next=${encodeURIComponent(target)}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectCallback,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initialize Google login.");
      setGoogleLoading(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (studentMode === "signin") {
        const res = await signInWithEmail({
          email: studentEmail,
          password: studentPassword,
          ...(redirectTo ? { redirectTo } : {}),
        });
        if (res.status === "error") {
          setError(res.message);
          setLoading(false);
        }
      } else if (studentMode === "signup") {
        const res = await signUpWithEmail({
          name,
          email: studentEmail,
          password: studentPassword,
          ...(redirectTo ? { redirectTo } : {}),
        });
        if (res.status === "error") {
          setError(res.message);
        } else if (res.status === "success") {
          setSuccessMessage(res.message ?? "Account created successfully!");
        }
        setLoading(false);
      } else if (studentMode === "magic") {
        const res = await sendMagicLink({
          email: studentEmail,
          ...(redirectTo ? { redirectTo } : {}),
        });
        if (res.status === "error") {
          setError(res.message);
        } else if (res.status === "success") {
          setSuccessMessage(res.message ?? "Check your email for the magic login link!");
        }
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication request failed.");
      setLoading(false);
    }
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
      <div className="mt-4">
        <QuickUnlockScreen
          profile={storedProfile}
          redirectTo={redirectTo}
          onSwitchAccount={() => setShowQuickUnlock(false)}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* ── Quick Unlock Banner (if profile exists and switched to standard login) ── */}
      {storedProfile ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-saffron/30 bg-saffron-wash p-3.5 text-xs shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <KeyRound className="size-4 shrink-0 text-saffron" />
            <span className="truncate text-bone">
              Quick PIN is ready for <strong className="text-saffron">{storedProfile.name || storedProfile.email}</strong>
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowQuickUnlock(true)}
            className="shrink-0 text-xs border-saffron/40"
          >
            Use PIN
          </Button>
        </div>
      ) : null}

      {/* ── Primary User Role Switcher (Customer vs Vendor) ───────── */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-surface p-1.5 border border-line">
        <button
          type="button"
          onClick={() => {
            setUserType("student");
            setError(null);
            setSuccessMessage(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
            userType === "student"
              ? "bg-saffron text-ink shadow-md"
              : "text-muted hover:text-bone hover:bg-surface-raised/40"
          }`}
        >
          <GraduationCap className="size-4 shrink-0" />
          <span>Customer</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setUserType("vendor");
            setError(null);
            setSuccessMessage(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
            userType === "vendor"
              ? "bg-saffron text-ink shadow-md"
              : "text-muted hover:text-bone hover:bg-surface-raised/40"
          }`}
        >
          <Store className="size-4 shrink-0" />
          <span>Vendor</span>
        </button>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────── */}
      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-chili/30 bg-chili-wash p-3.5 text-xs text-chili">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-mint/30 bg-mint-wash p-3.5 text-xs text-mint">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {/* ── STUDENT / CUSTOMER VIEW ───────────────────────────────── */}
      {userType === "student" ? (
        <div className="space-y-6">
          {/* Google OAuth */}
          <Button
            type="button"
            variant="secondary"
            block
            size="lg"
            disabled={googleLoading || loading}
            onClick={() => void handleGoogleSignIn()}
            className="relative bg-surface hover:bg-surface-raised border border-line"
          >
            {googleLoading ? (
              <Loader2 className="size-5 animate-spin text-saffron" />
            ) : (
              <GoogleIcon className="size-5 shrink-0" />
            )}
            <span className="font-medium text-bone">Continue with Google</span>
          </Button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-line" />
            <span className="absolute bg-ink px-3 text-xs uppercase tracking-wider text-faint">
              or with email
            </span>
          </div>

          {/* Student Sub-mode Selector */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 border border-line">
            <button
              type="button"
              onClick={() => {
                setStudentMode("signin");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                studentMode === "signin"
                  ? "bg-surface-raised text-bone shadow-sm"
                  : "text-muted hover:text-bone"
              }`}
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
              className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                studentMode === "signup"
                  ? "bg-surface-raised text-bone shadow-sm"
                  : "text-muted hover:text-bone"
              }`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => {
                setStudentMode("magic");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                studentMode === "magic"
                  ? "bg-surface-raised text-bone shadow-sm"
                  : "text-muted hover:text-bone"
              }`}
            >
              Magic link
            </button>
          </div>

          {/* Student Email Form */}
          <form onSubmit={(e) => void handleStudentSubmit(e)} className="space-y-4">
            {studentMode === "signup" ? (
              <div>
                <Label htmlFor="student-name">Your Full Name</Label>
                <Input
                  id="student-name"
                  type="text"
                  placeholder="e.g. Aarav Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                />
              </div>
            ) : null}

            <div>
              <Label htmlFor="student-email">Student / College Email</Label>
              <Input
                id="student-email"
                type="email"
                placeholder="e.g. student@nitp.ac.in"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                required
                disabled={loading || googleLoading}
              />
            </div>

            {studentMode !== "magic" ? (
              <div>
                <Label htmlFor="student-password">Password</Label>
                <Input
                  id="student-password"
                  type="password"
                  placeholder="••••••••"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading || googleLoading}
                />
              </div>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              block
              size="lg"
              disabled={loading || googleLoading}
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : studentMode === "signin" ? (
                <ShieldCheck className="size-5" />
              ) : studentMode === "signup" ? (
                <Sparkles className="size-5" />
              ) : (
                <Mail className="size-5" />
              )}
              <span>
                {loading
                  ? "Please wait..."
                  : studentMode === "signin"
                    ? "Sign in as Customer"
                    : studentMode === "signup"
                      ? "Create Student Account"
                      : "Send Magic Login Link"}
              </span>
            </Button>
          </form>
        </div>
      ) : (
        /* ── VENDOR VIEW ─────────────────────────────────────────── */
        <div className="space-y-5">
          <div className="rounded-xl border border-line bg-surface p-3.5 text-xs text-muted leading-relaxed">
            <p className="font-semibold text-bone mb-1 flex items-center gap-1.5">
              <Store className="size-3.5 text-saffron" />
              Vendor & Partner Console
            </p>
            Sign in using the email and password provided by the campus administrator when your
            restaurant was onboarded.
          </div>

          <form onSubmit={(e) => void handleVendorSubmit(e)} className="space-y-4">
            <div>
              <Label htmlFor="vendor-auth-email">Vendor Email</Label>
              <Input
                id="vendor-auth-email"
                type="email"
                placeholder="e.g. owner@canteen.in"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="vendor-auth-password">Password</Label>
              <Input
                id="vendor-auth-password"
                type="password"
                placeholder="••••••••"
                value={vendorPassword}
                onChange={(e) => setVendorPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              block
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Store className="size-5" />
              )}
              <span>{loading ? "Authenticating..." : "Sign in to Vendor Console"}</span>
            </Button>
          </form>
        </div>
      )}
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
