"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Fingerprint,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  generatePinSalt,
  hashPin,
  isBiometricsAvailable,
  isVendorRole,
  registerBiometrics,
  setStoredQuickUnlockProfile,
  type StoredQuickUnlockProfile,
} from "@/lib/quick-unlock";
import type { Role } from "@/lib/constants";
import { saveQuickUnlockSettings } from "@/server/actions/session";

/**
 * Every word this dialog can say.
 *
 * The vendor console is bilingual — the whole point of that dictionary is that
 * canteen staff who do not read English can still run their own shift — so the
 * one screen standing between a vendor and their dashboard cannot be the one
 * screen that is English-only. Callers pass translated strings; the defaults
 * below cover the student app, which is English today.
 */
export interface QuickUnlockModalCopy {
  setTitle: string;
  confirmTitle: string;
  biometricsTitle: string;
  successTitle: string;
  setDescription: string;
  confirmDescription: string;
  biometricsDescription: string;
  successDescription: string;
  biometricsHeadline: string;
  biometricsBody: string;
  enableBiometrics: string;
  pinOnly: string;
  skip: string;
  successHeadline: string;
  mismatch: string;
  failed: string;
}

interface QuickUnlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Overrides any of the defaults. Anything omitted keeps the English text. */
  copy?: Partial<QuickUnlockModalCopy>;
  user: {
    _id: string;
    name: string;
    email: string;
    /**
     * Drives the wording only. A vendor is setting up a counter tablet, not
     * locking a personal phone, and "1-tap checkout" is not a thing they do.
     */
    role?: Role | null;
  };
  onComplete?: () => void;
}

/** The English wording, in the two flavours the app ships today. */
function defaultCopy(forVendor: boolean): QuickUnlockModalCopy {
  return {
    setTitle: "Set a 4-Digit Quick PIN",
    confirmTitle: "Confirm your 4-Digit PIN",
    biometricsTitle: "Enable Biometric Unlock",
    successTitle: "Quick Unlock Enabled!",
    setDescription: forVendor
      ? "Choose a 4-digit code. From now on this device opens the dashboard with the PIN instead of an email and password."
      : "Choose a 4-digit code so you can quickly unlock TREFOOD on this phone without passwords.",
    confirmDescription: "Re-enter the same 4-digit code to verify.",
    biometricsDescription: forVendor
      ? "Use the fingerprint sensor or Face ID to open the dashboard without typing anything at all."
      : "Use your device Fingerprint, Face ID, or Touch ID for instant 1-tap ordering.",
    successDescription: forVendor
      ? "Next time, enter your PIN and you are straight on the dashboard."
      : "Next time you open TREFOOD, you can unlock immediately.",
    biometricsHeadline: forVendor ? "1-Tap Dashboard Access" : "1-Tap Biometric Checkout",
    biometricsBody: forVendor
      ? "Enable Fingerprint or Face ID to reach the orders board in under a second."
      : "Enable Fingerprint or Face ID to open TREFOOD and confirm orders in under a second.",
    enableBiometrics: "Enable Biometrics & Finish",
    pinOnly: "Use 4-Digit PIN Only",
    skip: "Skip for now",
    successHeadline: "Quick Unlock Ready!",
    mismatch: "PINs do not match. Please try again.",
    failed: "Failed to configure quick unlock.",
  };
}

export function QuickUnlockModal({
  open,
  onOpenChange,
  user,
  onComplete,
  copy: copyOverrides,
}: QuickUnlockModalProps) {
  const [step, setStep] = useState<"enter_pin" | "confirm_pin" | "biometrics" | "success">(
    "enter_pin",
  );
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [enableBiometric, setEnableBiometric] = useState(true);

  const forVendor = isVendorRole(user.role);
  const copy: QuickUnlockModalCopy = { ...defaultCopy(forVendor), ...copyOverrides };

  // Check hardware biometric capability
  useEffect(() => {
    void isBiometricsAvailable().then((supported) => {
      setBiometricsSupported(supported);
      setEnableBiometric(supported);
    });
  }, []);

  const resetState = () => {
    setStep("enter_pin");
    setPin("");
    setConfirmPin("");
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handlePinDigit = (digit: string) => {
    setError(null);
    if (step === "enter_pin") {
      if (pin.length < 4) {
        const next = pin + digit;
        setPin(next);
        if (next.length === 4) {
          setTimeout(() => setStep("confirm_pin"), 200);
        }
      }
    } else if (step === "confirm_pin") {
      if (confirmPin.length < 4) {
        const next = confirmPin + digit;
        setConfirmPin(next);
        if (next.length === 4) {
          if (next !== pin) {
            setError(copy.mismatch);
            setTimeout(() => {
              setConfirmPin("");
            }, 600);
          } else {
            if (biometricsSupported) {
              setTimeout(() => setStep("biometrics"), 250);
            } else {
              void finalizeSetup(false);
            }
          }
        }
      }
    }
  };

  const handleDelete = () => {
    setError(null);
    if (step === "enter_pin") {
      setPin((prev) => prev.slice(0, -1));
    } else if (step === "confirm_pin") {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const finalizeSetup = async (withBiometrics: boolean) => {
    setLoading(true);
    setError(null);

    try {
      let credentialId: string | null = null;
      let biometricRegistered = false;

      if (withBiometrics && biometricsSupported) {
        const bioRes = await registerBiometrics(user._id, user.name);
        if (bioRes.success && bioRes.credentialId) {
          credentialId = bioRes.credentialId;
          biometricRegistered = true;
        } else if (bioRes.error && !bioRes.error.toLowerCase().includes("cancel")) {
          // If biometric was rejected, proceed with PIN only
          biometricRegistered = false;
        }
      }

      const salt = generatePinSalt();
      const pinHash = await hashPin(pin, salt);

      const profile: StoredQuickUnlockProfile = {
        userId: user._id,
        name: user.name,
        email: user.email,
        pinHash,
        pinSalt: salt,
        biometricEnabled: biometricRegistered,
        credentialId,
        requireOnOpen: true,
        role: user.role ?? null,
        updatedAt: Date.now(),
      };

      // 1. Save to local storage for instant mobile unlock
      setStoredQuickUnlockProfile(profile);

      // 2. Sync to MongoDB database
      await saveQuickUnlockSettings({
        pinHash,
        pinSalt: salt,
        biometricEnabled: biometricRegistered,
        credentialId,
        requireOnOpen: true,
      });

      setStep("success");
      setTimeout(() => {
        handleClose();
        if (onComplete) onComplete();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.failed);
    } finally {
      setLoading(false);
    }
  };

  const currentPinLength = step === "enter_pin" ? pin.length : confirmPin.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border-line bg-surface p-6 sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-saffron-wash border border-saffron/30 text-saffron">
            {step === "biometrics" ? (
              <Fingerprint className="size-7" />
            ) : step === "success" ? (
              <CheckCircle2 className="size-7 text-mint" />
            ) : (
              <KeyRound className="size-7" />
            )}
          </div>

          <DialogTitle className="font-display text-lg font-bold text-bone">
            {step === "enter_pin"
              ? copy.setTitle
              : step === "confirm_pin"
                ? copy.confirmTitle
                : step === "biometrics"
                  ? copy.biometricsTitle
                  : copy.successTitle}
          </DialogTitle>

          <DialogDescription className="text-xs text-muted">
            {step === "enter_pin"
              ? copy.setDescription
              : step === "confirm_pin"
                ? copy.confirmDescription
                : step === "biometrics"
                  ? copy.biometricsDescription
                  : copy.successDescription}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-chili/30 bg-chili-wash p-2.5 text-xs text-chili">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* ── Steps 1 & 2: PIN Setup ───────────────────────────────── */}
        {(step === "enter_pin" || step === "confirm_pin") && (
          <div className="mt-4 flex flex-col items-center">
            {/* 4 Dots */}
            <div className="my-3 flex items-center gap-4">
              {[0, 1, 2, 3].map((idx) => {
                const filled = currentPinLength > idx;
                return (
                  <div
                    key={idx}
                    className={`size-3.5 rounded-full transition-all duration-150 ${
                      filled
                        ? "bg-saffron scale-110 shadow-[0_0_8px_rgba(245,166,35,0.5)]"
                        : "border border-line bg-surface-raised"
                    }`}
                  />
                );
              })}
            </div>

            {/* Numeric Keypad */}
            <div className="mt-4 grid grid-cols-3 gap-2.5 w-full max-w-[240px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinDigit(digit)}
                  className="flex size-14 items-center justify-center rounded-2xl border border-line bg-surface-raised font-display text-lg font-semibold text-bone active:scale-95 active:bg-surface transition-all select-none hover:border-saffron/40"
                >
                  {digit}
                </button>
              ))}

              <div className="size-14" />

              <button
                type="button"
                onClick={() => handlePinDigit("0")}
                className="flex size-14 items-center justify-center rounded-2xl border border-line bg-surface-raised font-display text-lg font-semibold text-bone active:scale-95 active:bg-surface transition-all select-none hover:border-saffron/40"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="flex size-14 items-center justify-center rounded-2xl border border-line bg-surface-raised text-muted active:scale-95 active:text-bone transition-all select-none hover:text-bone"
              >
                <X className="size-4" />
              </button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="mt-5 text-xs text-muted hover:text-bone"
            >
              {copy.skip}
            </Button>
          </div>
        )}

        {/* ── Step 3: Biometrics Option ─────────────────────────────── */}
        {step === "biometrics" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-line bg-surface-raised/40 p-4 text-xs leading-relaxed text-muted space-y-2">
              <p className="font-semibold text-bone flex items-center gap-1.5">
                <Sparkles className="size-4 text-saffron" />
                {copy.biometricsHeadline}
              </p>
              <p>{copy.biometricsBody}</p>
            </div>

            <div className="flex flex-col gap-2.5">
              <Button
                type="button"
                variant="primary"
                size="lg"
                block
                disabled={loading}
                onClick={() => void finalizeSetup(true)}
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Fingerprint className="size-5" />
                )}
                <span>{copy.enableBiometrics}</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="md"
                block
                disabled={loading}
                onClick={() => void finalizeSetup(false)}
                className="text-xs text-muted hover:text-bone"
              >
                {copy.pinOnly}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Success ───────────────────────────────────────── */}
        {step === "success" && (
          <div className="mt-4 flex flex-col items-center py-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-mint-wash text-mint border border-mint/30 animate-bounce">
              <CheckCircle2 className="size-8" />
            </div>
            <p className="mt-3 text-sm font-semibold text-bone">{copy.successHeadline}</p>
            <p className="mt-1 text-xs text-muted">{copy.successDescription}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
