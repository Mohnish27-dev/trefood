"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Store,
  type LucideIcon,
} from "lucide-react";

import { signInWithEmail } from "@/server/actions/session";
import { QuickUnlockScreen } from "@/components/student/quick-unlock-screen";
import {
  clearStoredQuickUnlockProfile,
  getStoredQuickUnlockProfile,
  isVendorRole,
  type QuickUnlockDeviceState,
  type StoredQuickUnlockProfile,
} from "@/lib/quick-unlock";
import { cn } from "@/lib/utils";

interface VendorAuthFormProps {
  redirectTo: string | null;
  quickUnlockDevice?: QuickUnlockDeviceState | null;
  reason?: string | null | undefined;
  children?: ReactNode;
}

const REASONS: Record<string, string> = {
  vendor: "Please sign in with your restaurant partner account to access the vendor console.",
  auth_failed: "Authentication could not be completed. Please try signing in again.",
};

export function VendorAuthForm({
  redirectTo,
  quickUnlockDevice = null,
  reason,
  children,
}: VendorAuthFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [storedProfile, setStoredProfile] = useState<StoredQuickUnlockProfile | null>(null);
  const [showQuickUnlock, setShowQuickUnlock] = useState<boolean>(false);
  const [staleProfile, setStaleProfile] = useState(false);

  const deviceTrusted = Boolean(quickUnlockDevice?.trusted);
  const deviceIsVendor = deviceTrusted && isVendorRole(quickUnlockDevice?.role);
  const quickUnlockDismissedRef = useRef(false);

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
      } else {
        return;
      }

      if (isVendorRole(role) && !reason && !quickUnlockDismissedRef.current) {
        setShowQuickUnlock(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [deviceTrusted, quickUnlockDevice, reason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await signInWithEmail({
        email,
        password,
        ...(redirectTo ? { redirectTo } : {}),
      });

      if (res.status === "error") {
        setError(res.message);
        setLoading(false);
      } else if (res.status === "success") {
        setSuccessMessage(res.message ?? "Signed in successfully.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Vendor sign-in failed.");
      setLoading(false);
    }
  };

  if (showQuickUnlock && storedProfile) {
    return (
      <div className="w-full max-w-md mx-auto min-h-dvh flex flex-col justify-center px-4 py-8 bg-ink text-bone">
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

  return (
    <div className="relative w-full max-w-md mx-auto min-h-dvh flex flex-col justify-between bg-surface/50 border-x border-line/40 text-bone shadow-2xl px-6 py-8 sm:px-8">
      {/* ── Top Header & Branding ── */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-bone transition-colors group"
          >
            <ArrowLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>TreFood Home</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-saffron/30 bg-saffron-wash px-3 py-1 text-[11px] font-semibold text-saffron">
            <Store className="size-3" />
            Partner Portal
          </span>
        </div>

        <div className="space-y-2 text-left mb-6">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-raised border border-line text-saffron shadow-sm mb-1">
            <ChefHat className="size-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-bone">
            Restaurant <span className="text-saffron">Partner Login</span>
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            Manage live orders, prepare KOTs, and update dish availability for campus canteens.
          </p>
        </div>

        {/* ── Status Alerts ── */}
        <div className="space-y-3 mb-6">
          {reason && REASONS[reason] ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber-wash p-3.5 text-xs text-amber leading-relaxed">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{REASONS[reason]}</span>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-chili/40 bg-chili-wash p-3.5 text-xs text-chili leading-relaxed">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-mint/40 bg-mint-wash p-3.5 text-xs text-mint leading-relaxed">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          {staleProfile ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber-wash p-3.5 text-xs text-amber leading-relaxed">
              <KeyRound className="size-4 shrink-0 mt-0.5" />
              <span>Sign in with password once to re-enable your 4-digit PIN for this tablet.</span>
            </div>
          ) : null}

          {/* Quick PIN Banner */}
          {storedProfile && deviceIsVendor ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-saffron/40 bg-surface-raised p-3.5 text-xs shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <KeyRound className="size-4 shrink-0 text-saffron" />
                <span className="truncate text-bone">
                  Quick PIN ready for{" "}
                  <strong className="text-saffron font-semibold">
                    {storedProfile.name || storedProfile.email}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickUnlock(true)}
                className="shrink-0 rounded-lg bg-saffron px-3 py-1.5 font-semibold text-white hover:bg-saffron-glow transition-colors cursor-pointer"
              >
                Enter PIN
              </button>
            </div>
          ) : null}
        </div>

        {/* ── Partner Login Form ── */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="vendor-email" className="block text-xs font-medium text-muted">
              Partner Email ID
            </label>
            <VendorAuthInput
              icon={Mail}
              id="vendor-email"
              type="email"
              placeholder="e.g. canteen@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="vendor-password" className="block text-xs font-medium text-muted">
              Password
            </label>
            <VendorAuthInput
              icon={Lock}
              id="vendor-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your vendor password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
              reveal={{
                shown: showPassword,
                toggle: () => setShowPassword(!showPassword),
              }}
            />
          </div>

          <p className="text-[12px] text-faint leading-relaxed">
            Use the credentials provided by the campus administrator when your restaurant was onboarded.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="relative flex h-13 w-full items-center justify-center rounded-xl bg-saffron text-base font-semibold text-white shadow-lg shadow-saffron/20 hover:bg-saffron-glow active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer mt-2"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <span>Login to Vendor Console</span>
                <ArrowRight className="absolute right-5 size-5" />
              </>
            )}
          </button>
        </form>

        {children}
      </div>

      {/* ── Bottom Footer / Navigation back to student portal ── */}
      <footer className="mt-8 pt-6 border-t border-line/40 text-center">
        <p className="text-xs text-muted">
          Looking to order food?{" "}
          <Link
            href="/signin"
            className="font-semibold text-bone hover:text-saffron transition-colors inline-flex items-center gap-1"
          >
            Student Sign-in
            <ArrowRight className="size-3" />
          </Link>
        </p>
      </footer>
    </div>
  );
}

function VendorAuthInput({
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
        className="absolute left-4 size-4.5 text-muted pointer-events-none"
        strokeWidth={1.75}
      />
      <input
        {...props}
        className={cn(
          "h-12 w-full rounded-xl border border-line bg-surface px-4 pl-12 text-sm text-bone placeholder:text-faint focus:outline-none focus:border-saffron focus:ring-1 focus:ring-saffron disabled:opacity-60 transition-all",
          reveal ? "pr-12" : "pr-4",
          className,
        )}
      />
      {reveal ? (
        <button
          type="button"
          onClick={reveal.toggle}
          aria-label={reveal.shown ? "Hide password" : "Show password"}
          className="absolute right-3 p-1 text-muted hover:text-bone focus:outline-none cursor-pointer"
        >
          {reveal.shown ? (
            <Eye className="size-4.5" strokeWidth={1.75} />
          ) : (
            <EyeOff className="size-4.5" strokeWidth={1.75} />
          )}
        </button>
      ) : null}
    </div>
  );
}

