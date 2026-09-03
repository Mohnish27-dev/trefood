"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Fingerprint,
  Delete,
  ShieldCheck,
  AlertCircle,
  ArrowRightLeft,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getStoredQuickUnlockProfile,
  setAppLockState,
  verifyPin,
  authenticateWithBiometrics,
  isBiometricsAvailable,
  type StoredQuickUnlockProfile,
} from "@/lib/quick-unlock";
import { resolveLandingPath } from "@/lib/routes";

interface QuickUnlockScreenProps {
  profile?: StoredQuickUnlockProfile | null;
  redirectTo?: string | null;
  onSuccess?: () => void;
  onSwitchAccount?: () => void;
}

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

  const handleUnlockSuccess = useCallback(() => {
    setAppLockState(false);
    if (onSuccess) {
      onSuccess();
    } else {
      const target = resolveLandingPath(redirectTo, null);
      window.location.href = target;
    }
  }, [redirectTo, onSuccess]);

  const triggerBiometricUnlock = useCallback(async () => {
    if (!profile?.biometricEnabled || authenticatingBiometric) return;
    setError(null);
    setAuthenticatingBiometric(true);

    try {
      const res = await authenticateWithBiometrics(profile.credentialId);
      if (res.success) {
        handleUnlockSuccess();
      } else if (res.error && !res.error.toLowerCase().includes("cancelled")) {
        setError("Biometric verification failed. Please enter your 4-digit PIN.");
      }
    } catch {
      setError("Biometric verification failed. Please enter your PIN.");
    } finally {
      setAuthenticatingBiometric(false);
    }
  }, [profile, authenticatingBiometric, handleUnlockSuccess]);

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
      if (pin.length >= 4 || verifying) return;
      setError(null);

      const nextPin = pin + digit;
      setPin(nextPin);

      if (nextPin.length === 4) {
        setVerifying(true);
        if (!profile) {
          setError("Quick unlock profile not found. Please sign in with email/password.");
          setVerifying(false);
          return;
        }

        const valid = await verifyPin(nextPin, profile.pinHash, profile.pinSalt);
        if (valid) {
          handleUnlockSuccess();
        } else {
          setShaking(true);
          setError("Incorrect PIN. Please try again.");
          setTimeout(() => {
            setPin("");
            setShaking(false);
            setVerifying(false);
          }, 600);
        }
      }
    },
    [pin, verifying, profile, handleUnlockSuccess],
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

  if (!profile) {
    return null;
  }

  const nameInitial = (profile.name || profile.email || "U").charAt(0).toUpperCase();

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
            disabled={verifying}
            onClick={() => void handlePinDigit(digit)}
            className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface/80 font-display text-xl font-semibold text-bone shadow-sm active:scale-95 active:bg-surface-raised transition-all hover:border-saffron/40 hover:bg-surface-raised select-none"
          >
            {digit}
          </button>
        ))}

        {/* Biometrics Key or Blank */}
        {profile.biometricEnabled && biometricsSupported ? (
          <button
            type="button"
            disabled={authenticatingBiometric || verifying}
            onClick={() => void triggerBiometricUnlock()}
            className="flex size-16 items-center justify-center rounded-2xl border border-saffron/40 bg-saffron-wash text-saffron shadow-sm active:scale-95 active:bg-saffron/20 transition-all select-none"
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
          disabled={verifying}
          onClick={() => void handlePinDigit("0")}
          className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface/80 font-display text-xl font-semibold text-bone shadow-sm active:scale-95 active:bg-surface-raised transition-all hover:border-saffron/40 hover:bg-surface-raised select-none"
        >
          0
        </button>

        {/* Delete / Backspace Key */}
        <button
          type="button"
          disabled={verifying}
          onClick={handleDeleteDigit}
          className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface/80 text-muted active:scale-95 active:bg-surface-raised active:text-bone transition-all hover:text-bone select-none"
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
            onClick={onSwitchAccount}
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
