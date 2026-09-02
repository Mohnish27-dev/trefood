"use client";

import { useEffect, useState } from "react";
import {
  Fingerprint,
  KeyRound,
  ShieldCheck,
  Smartphone,
  Check,
  ChevronRight,
  RotateCcw,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  getStoredQuickUnlockProfile,
  setStoredQuickUnlockProfile,
  clearStoredQuickUnlockProfile,
  isBiometricsAvailable,
  registerBiometrics,
  type StoredQuickUnlockProfile,
} from "@/lib/quick-unlock";
import { QuickUnlockModal } from "@/components/student/quick-unlock-modal";
import { saveQuickUnlockSettings, resetQuickUnlockSettings } from "@/server/actions/session";

interface AccountQuickUnlockProps {
  user: {
    _id: string;
    name: string;
    email: string;
    quickUnlock?: {
      pinHash?: string | null;
      pinSalt?: string | null;
      biometricEnabled?: boolean;
      credentialId?: string | null;
      requireOnOpen?: boolean;
    } | null;
  };
}

export function AccountQuickUnlock({ user }: AccountQuickUnlockProps) {
  const [profile, setProfile] = useState<StoredQuickUnlockProfile | null>(null);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const stored = getStoredQuickUnlockProfile();
    if (stored) {
      setProfile(stored);
    } else if (user.quickUnlock?.pinHash && user.quickUnlock?.pinSalt) {
      // Rehydrate local storage from server record if user is on a new device
      const synced: StoredQuickUnlockProfile = {
        userId: user._id,
        name: user.name,
        email: user.email,
        pinHash: user.quickUnlock.pinHash,
        pinSalt: user.quickUnlock.pinSalt,
        biometricEnabled: Boolean(user.quickUnlock.biometricEnabled),
        credentialId: user.quickUnlock.credentialId ?? null,
        requireOnOpen: user.quickUnlock.requireOnOpen ?? true,
        updatedAt: Date.now(),
      };
      setStoredQuickUnlockProfile(synced);
      setProfile(synced);
    }

    void isBiometricsAvailable().then((supported) => {
      setBiometricsSupported(supported);
    });
  }, [user]);

  const hasPin = Boolean(profile?.pinHash || user.quickUnlock?.pinHash);
  const isBiometricActive = Boolean(profile?.biometricEnabled);

  const handleToggleBiometrics = async (enabled: boolean) => {
    if (!profile) return;
    setLoadingToggle(true);

    try {
      let credentialId = profile.credentialId ?? null;

      if (enabled && biometricsSupported && !credentialId) {
        const bioRes = await registerBiometrics(user._id, user.name);
        if (bioRes.success && bioRes.credentialId) {
          credentialId = bioRes.credentialId;
        } else {
          setLoadingToggle(false);
          return;
        }
      }

      const updated: StoredQuickUnlockProfile = {
        ...profile,
        biometricEnabled: enabled,
        credentialId,
        updatedAt: Date.now(),
      };

      setStoredQuickUnlockProfile(updated);
      setProfile(updated);

      await saveQuickUnlockSettings({
        biometricEnabled: enabled,
        credentialId,
      });
    } catch (err) {
      console.error("Error toggling biometrics:", err);
    } finally {
      setLoadingToggle(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to turn off Quick PIN & Biometric unlock on this device?")) {
      return;
    }

    setResetting(true);
    try {
      clearStoredQuickUnlockProfile();
      setProfile(null);
      await resetQuickUnlockSettings();
    } catch (err) {
      console.error("Failed to reset quick unlock:", err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-saffron-wash border border-saffron/25">
            <KeyRound className="size-5 text-saffron" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-sm font-semibold text-bone">
                4-Digit PIN & Biometrics
              </p>
              {hasPin ? (
                <Badge tone="success">Active</Badge>
              ) : (
                <Badge tone="neutral">Not configured</Badge>
              )}
            </div>

            <p className="mt-1 text-xs leading-relaxed text-muted">
              {hasPin
                ? "Unlock TREFOOD on this phone instantly with your 4-digit PIN or device biometrics."
                : "Set up a 4-digit PIN to bypass typing your password or logging in with Google every time."}
            </p>

            <div className="mt-4 space-y-3 border-t border-line pt-3">
              {/* PIN row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-bone">
                  <Smartphone className="size-4 text-faint" />
                  <span>4-Digit Quick PIN</span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  className="text-xs"
                >
                  {hasPin ? "Change PIN" : "Set 4-Digit PIN"}
                </Button>
              </div>

              {/* Biometrics Toggle (if supported) */}
              {biometricsSupported && hasPin ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-bone">
                    <Fingerprint className="size-4 text-faint" />
                    <span>Fingerprint / Face ID</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {loadingToggle ? (
                      <Loader2 className="size-4 animate-spin text-saffron" />
                    ) : (
                      <Switch
                        checked={isBiometricActive}
                        onCheckedChange={(checked) => void handleToggleBiometrics(checked)}
                      />
                    )}
                  </div>
                </div>
              ) : null}

              {/* Reset / Turn Off Quick Unlock */}
              {hasPin ? (
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => void handleReset()}
                    className="flex items-center gap-1.5 text-xs text-chili hover:underline disabled:opacity-50"
                  >
                    {resetting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    <span>Turn off Quick Unlock</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <QuickUnlockModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        user={user}
        onComplete={() => {
          const stored = getStoredQuickUnlockProfile();
          setProfile(stored);
        }}
      />
    </>
  );
}
