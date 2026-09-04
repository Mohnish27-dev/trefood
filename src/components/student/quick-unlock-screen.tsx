"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Fingerprint,
  Delete,
  AlertCircle,
  ArrowRightLeft,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearStoredQuickUnlockProfile,
  getStoredQuickUnlockProfile,
  setAppLockState,
  authenticateWithBiometrics,
  isBiometricsAvailable,
  type StoredQuickUnlockProfile,
} from "@/lib/quick-unlock";
import { forgetQuickUnlockDevice, unlockWithQuickUnlock } from "@/server/actions/session";

interface QuickUnlockScreenProps {
  profile?: StoredQuickUnlockProfile | null;
  redirectTo?: string | null;
  onSuccess?: () => void;
  onSwitchAccount?: () => void;
}

/**
 * The lock screen.
 *
 * It used to verify the PIN in the browser and then navigate, which is why a
 * signed-out person could loop here forever: the dots turned green, the page
 * changed, and the very next guarded route bounced them straight back because
 * no session had ever been created. Every unlock now goes through
 * `unlockWithQuickUnlock()`, which checks the PIN against the account on the
 * server and sets the session cookie before this component navigates anywhere.
 */
export function QuickUnlockScreen({
  profile: propProfile,
  redirectTo,
  onSuccess,
  onSwitchAccount,
}: QuickUnlockScreenProps) {
  const [profile, setProfile] = useState<StoredQuickUnlockProfile | null>(propProfile ?? null);
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [authenticatingBiometric, setAuthenticatingBiometric] = useState(false);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [verifying, setVerifying] = useState(false);
  /** Set when the server says this device can no longer quick-unlock at all. */
  const [blocked, setBlocked] = useState(false);

  const biometricAttemptedRef = useRef(false);

  // Load profile from localStorage if not provided via props
  useEffect(() => {
    if (!profile) {
      const stored = getStoredQuickUnlockProfile();
      setProfile(stored);
    }
  }, [profile]);

  // Check hardware biometric capability
  useEffect(() => {
    void isBiometricsAvailable().then((supported) => {
      setBiometricsSupported(supported);
    });
  }, []);

  const handleUnlocked = useCallback(
    (target: string) => {
      setAppLockState(false);
      if (onSuccess) {
        onSuccess();
        return;
      }
      // A full load, not a client transition: the session cookie was just set
      // on this response and every server component has to see it.
      window.location.assign(target);
    },
    [onSuccess],
  );

  /** Stops offering a PIN that cannot work, and hands back to the normal form. */
  const handleDeviceRejected = useCallback(
    (message: string) => {
      setBlocked(true);
      setError(message);
      clearStoredQuickUnlockProfile();
      setTimeout(() => {
        onSwitchAccount?.();
      }, 2500);
    },
    [onSwitchAccount],
  );

  const triggerBiometricUnlock = useCallback(async () => {
    if (!profile?.biometricEnabled || authenticatingBiometric || blocked) return;
    setError(null);
    setAuthenticatingBiometric(true);

    try {
      const res = await authenticateWithBiometrics(profile.credentialId);
      if (!res.success || !res.credentialId) {
        if (res.error && !res.error.toLowerCase().includes("cancel")) {
          setError("Biometric verification failed. Please enter your 4-digit PIN.");
        }
        return;
      }

      const unlocked = await unlockWithQuickUnlock({
        mode: "biometric",
        credentialId: res.credentialId,
        ...(redirectTo ? { redirectTo } : {}),
      });

      if (unlocked.status === "success") {
        handleUnlocked(unlocked.redirectTo);
      } else if (unlocked.reason === "untrusted") {
        handleDeviceRejected(unlocked.message);
      } else {
        setError(unlocked.message);
      }
    } catch {
      setError("Biometric verification failed. Please enter your PIN.");
    } finally {
      setAuthenticatingBiometric(false);
    }
  }, [
    profile,
    authenticatingBiometric,
    blocked,
    redirectTo,
    handleUnlocked,
    handleDeviceRejected,
  ]);

  // Auto-prompt biometrics once on mount if enabled
  useEffect(() => {
    if (profile?.biometricEnabled && !biometricAttemptedRef.current) {
      biometricAttemptedRef.current = true;
      const timer = setTimeout(() => {
        void triggerBiometricUnlock();
      }, 350);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [profile, triggerBiometricUnlock]);

  const handlePinDigit = useCallback(
    async (digit: string) => {
      if (pin.length >= 4 || verifying || blocked) return;
      setError(null);

      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length < 4) return;

      setVerifying(true);
      try {
        const unlocked = await unlockWithQuickUnlock({
          mode: "pin",
          pin: nextPin,
          ...(redirectTo ? { redirectTo } : {}),
        });

        if (unlocked.status === "success") {
          handleUnlocked(unlocked.redirectTo);
          return;
        }

        if (unlocked.reason === "untrusted") {
          handleDeviceRejected(unlocked.message);
          return;
        }

        setShaking(true);
        setError(unlocked.message);
        setTimeout(() => {
          setPin("");
          setShaking(false);
          setVerifying(false);
        }, 600);
      } catch {
        setPin("");
        setVerifying(false);
        setError("Could not reach TREFOOD. Check your connection and try again.");
      }
    },
    [pin, verifying, blocked, redirectTo, handleUnlocked, handleDeviceRejected],
  );

  const handleDeleteDigit = useCallback(() => {
    if (pin.length > 0 && !verifying) {
      setError(null);
      setPin((prev) => prev.slice(0, -1));
    }
  }, [pin, verifying]);

  // Listen to physical keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        void handlePinDigit(e.key);
      } else if (e.key === "Backspace") {
        handleDeleteDigit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePinDigit, handleDeleteDigit]);

  const handleSwitchAccount = useCallback(async () => {
    clearStoredQuickUnlockProfile();
    try {
      await forgetQuickUnlockDevice();
    } catch {
      // The local profile is already gone, so the form shows either way.
    }
    onSwitchAccount?.();
  }, [onSwitchAccount]);

  if (!profile) {
    return null;
  }

  const nameInitial = (profile.name || profile.email || "U").charAt(0).toUpperCase();
  const disabled = verifying || blocked;

  return (
    <div className="flex flex-col items-center justify-between min-h-[520px] w-full max-w-sm mx-auto px-4 py-6">
      {/* ── Profile Header ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="relative">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-saffron-wash border-2 border-saffron/40 font-display text-2xl font-bold text-saffron shadow-lg">
            {nameInitial}
          </span>
          <div className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-surface border border-line shadow-sm">
            <Lock className="size-3.5 text-saffron" />
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-bone">
            {profile.name || "Welcome Back"}
          </h2>
          <p className="text-xs text-muted mt-0.5">{profile.email}</p>
        </div>

        <p className="text-xs font-medium text-faint flex items-center gap-1.5 pt-1">
          <KeyRound className="size-3.5 text-saffron" />
          Enter your 4-digit PIN to unlock
        </p>
      </div>

      {/* ── PIN Indicators (4 Dots) ─────────────────────────────────── */}
      <div className="my-6">
        <div
          className={`flex items-center gap-5 transition-transform duration-200 ${
            shaking ? "animate-shake" : ""
          }`}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`size-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? "bg-saffron scale-125 shadow-[0_0_12px_rgba(245,166,35,0.6)]"
                    : "border-2 border-line bg-surface-raised/50 scale-100"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* ── Error / Status Alert ────────────────────────────────────── */}
      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-chili/30 bg-chili-wash px-3.5 py-2 text-xs text-chili animate-fade-in">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {verifying && !error ? (
        <div className="mb-4 flex items-center gap-2 text-xs text-saffron">
          <Loader2 className="size-4 animate-spin" />
          <span>Unlocking…</span>
        </div>
      ) : null}

      {authenticatingBiometric ? (
        <div className="mb-4 flex items-center gap-2 text-xs text-saffron animate-pulse">
          <Loader2 className="size-4 animate-spin" />
          <span>Touch sensor or look at camera…</span>
        </div>
      ) : null}

      {/* ── Numeric Dialpad ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => void handlePinDigit(digit)}
            className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface/80 font-display text-xl font-semibold text-bone shadow-sm active:scale-95 active:bg-surface-raised transition-all hover:border-saffron/40 hover:bg-surface-raised select-none disabled:opacity-50"
          >
            {digit}
          </button>
        ))}

        {/* Biometrics Key or Blank */}
        {profile.biometricEnabled && biometricsSupported ? (
          <button
            type="button"
            disabled={authenticatingBiometric || disabled}
            onClick={() => void triggerBiometricUnlock()}
            className="flex size-16 items-center justify-center rounded-2xl border border-saffron/40 bg-saffron-wash text-saffron shadow-sm active:scale-95 active:bg-saffron/20 transition-all select-none disabled:opacity-50"
            aria-label="Use Biometrics"
            title="Use Biometric Unlock"
          >
            {authenticatingBiometric ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Fingerprint className="size-6" />
            )}
          </button>
        ) : (
          <div className="size-16" />
        )}

        {/* 0 Key */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => void handlePinDigit("0")}
          className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface/80 font-display text-xl font-semibold text-bone shadow-sm active:scale-95 active:bg-surface-raised transition-all hover:border-saffron/40 hover:bg-surface-raised select-none disabled:opacity-50"
        >
          0
        </button>

        {/* Delete / Backspace Key */}
        <button
          type="button"
          disabled={disabled}
          onClick={handleDeleteDigit}
          className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface/80 text-muted active:scale-95 active:bg-surface-raised active:text-bone transition-all hover:text-bone select-none disabled:opacity-50"
          aria-label="Delete"
        >
          <Delete className="size-5" />
        </button>
      </div>

      {/* ── Fallback Actions ────────────────────────────────────────── */}
      <div className="mt-8 flex flex-col items-center gap-2 text-center w-full">
        {onSwitchAccount ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleSwitchAccount()}
            className="text-xs text-muted hover:text-bone flex items-center gap-2"
          >
            <ArrowRightLeft className="size-3.5" />
            Switch account / Sign in with password or Google
          </Button>
        ) : null}
      </div>
    </div>
  );
}
