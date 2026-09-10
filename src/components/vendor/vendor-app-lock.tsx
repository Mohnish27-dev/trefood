"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, KeyRound, Loader2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { QuickUnlockModal } from "@/components/student/quick-unlock-modal";
import { useVendorLanguage } from "@/context/vendor-language-context";
import {
  clearStoredQuickUnlockProfile,
  getStoredQuickUnlockProfile,
  isBiometricsAvailable,
  registerBiometrics,
  setStoredQuickUnlockProfile,
} from "@/lib/quick-unlock";
import type { Role } from "@/lib/constants";
import { resetQuickUnlockSettings, saveQuickUnlockSettings } from "@/server/actions/session";

interface VendorAppLockProps {
  user: {
    _id: string;
    name: string;
    email: string;
    role: Role;
    quickUnlock?: {
      pinHash?: string | null;
      pinSalt?: string | null;
      biometricEnabled?: boolean;
      credentialId?: string | null;
      requireOnOpen?: boolean;
    } | null;
  };
}

/**
 * PIN sign-in for the counter tablet.
 *
 * A vendor signs in at the start of every shift, on a device that never leaves
 * the counter and only ever holds one account. Typing an email and a password
 * to reach a board they are about to stare at for six hours is the friction
 * this removes: four digits, and they are on the orders board.
 *
 * The PIN is not a second password. The server checks it against
 * `users.quickUnlock`, and it only ever unlocks THIS device, because the
 * device cookie naming the account is minted here and nowhere else. A lost
 * tablet costs a PIN reset, not an account.
 *
 * Kept apart from the student app-lock card rather than shared with it: this
 * console is bilingual and tablet-sized, that one is English and phone-sized.
 * The keypad dialog underneath is the same component, given vendor words.
 */
export function VendorAppLock({ user }: VendorAppLockProps) {
  const router = useRouter();
  const { t } = useVendorLanguage();

  /**
   * The server's record is the state, read once at render.
   *
   * Deliberately NOT rehydrated out of localStorage on mount: the PIN is
   * checked against `users.quickUnlock` on every unlock, so the browser's copy
   * is a cache of something this page was already handed. Reading it in an
   * effect only bought a second render and a chance to disagree with Mongo.
   */
  const [settings, setSettings] = useState(() => ({
    hasPin: Boolean(user.quickUnlock?.pinHash),
    biometricEnabled: Boolean(user.quickUnlock?.biometricEnabled),
    credentialId: user.quickUnlock?.credentialId ?? null,
  }));

  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [togglingBiometrics, setTogglingBiometrics] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Whether this tablet has a fingerprint sensor at all. The only thing here
  // that React cannot know without asking the device.
  useEffect(() => {
    void isBiometricsAvailable().then(setBiometricsSupported);
  }, []);

  const hasPin = settings.hasPin;

  const handleToggleBiometrics = async (enabled: boolean) => {
    setTogglingBiometrics(true);

    try {
      let credentialId = settings.credentialId;

      // Registering raises a device prompt that can be declined or dismissed.
      // A refusal leaves the PIN exactly as it was rather than half-applying.
      if (enabled && biometricsSupported && !credentialId) {
        const registered = await registerBiometrics(user._id, user.name);
        if (!registered.success || !registered.credentialId) return;
        credentialId = registered.credentialId;
      }

      await saveQuickUnlockSettings({ biometricEnabled: enabled, credentialId });
      setSettings((current) => ({ ...current, biometricEnabled: enabled, credentialId }));

      // Keep the browser's copy in step, so the sign-in screen offers the
      // fingerprint key on the keypad rather than only the digits.
      const stored = getStoredQuickUnlockProfile();
      if (stored && stored.userId === user._id) {
        setStoredQuickUnlockProfile({
          ...stored,
          biometricEnabled: enabled,
          credentialId,
          updatedAt: Date.now(),
        });
      }
    } finally {
      setTogglingBiometrics(false);
    }
  };

  const handleTurnOff = async () => {
    // The PIN may be the only credential holding this shift up, so turning it
    // off can sign the tablet out where it stands. Say so before doing it.
    if (!confirm(t("appLockTurnOffConfirm"))) return;

    setResetting(true);
    try {
      clearStoredQuickUnlockProfile();
      await resetQuickUnlockSettings();
      setSettings({ hasPin: false, biometricEnabled: false, credentialId: null });
      router.refresh();
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-bone">{t("appLockSection")}</h2>
          <Badge tone={hasPin ? "success" : "neutral"}>
            {hasPin ? t("appLockActive") : t("appLockInactive")}
          </Badge>
        </div>

        <p className="mt-1 text-xs leading-relaxed text-muted">
          {hasPin ? t("appLockDescOn") : t("appLockDescOff")}
        </p>

        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-bone">
              <Smartphone className="size-4 shrink-0 text-faint" />
              {t("appLockPinRow")}
            </span>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(true)}>
              <KeyRound className="size-4" />
              <span>{hasPin ? t("appLockChangePin") : t("appLockSetPin")}</span>
            </Button>
          </div>

          {hasPin && biometricsSupported ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-bone">
                <Fingerprint className="size-4 shrink-0 text-faint" />
                {t("appLockBiometricRow")}
              </span>
              {togglingBiometrics ? (
                <Loader2 className="size-5 animate-spin text-saffron" />
              ) : (
                <Switch
                  checked={settings.biometricEnabled}
                  onCheckedChange={(checked) => void handleToggleBiometrics(checked)}
                />
              )}
            </div>
          ) : null}

          <p className="flex items-start gap-2 pt-1 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-saffron" />
            {t("appLockDeviceOnly")}
          </p>

          {hasPin ? (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={resetting}
                onClick={() => void handleTurnOff()}
                className="flex min-h-11 items-center gap-1.5 text-xs text-chili hover:underline disabled:opacity-50"
              >
                {resetting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                <span>{t("appLockTurnOff")}</span>
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      <QuickUnlockModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        user={user}
        copy={{
          setTitle: t("appLockSetTitle"),
          confirmTitle: t("appLockConfirmTitle"),
          biometricsTitle: t("appLockBiometricsTitle"),
          successTitle: t("appLockSuccessTitle"),
          setDescription: t("appLockSetDesc"),
          confirmDescription: t("appLockConfirmDesc"),
          biometricsDescription: t("appLockBiometricsDesc"),
          successDescription: t("appLockSuccessDesc"),
          biometricsHeadline: t("appLockBiometricsHeadline"),
          biometricsBody: t("appLockBiometricsBody"),
          enableBiometrics: t("appLockEnableBiometrics"),
          pinOnly: t("appLockPinOnly"),
          skip: t("appLockSkip"),
          successHeadline: t("appLockSuccessHeadline"),
          mismatch: t("appLockMismatch"),
          failed: t("appLockFailed"),
        }}
        onComplete={() => {
          // The modal has already written both the account record and this
          // browser's copy; read the local one back so the switch below shows
          // whether the fingerprint prompt was accepted or waved away.
          const stored = getStoredQuickUnlockProfile();
          setSettings({
            hasPin: true,
            biometricEnabled: Boolean(stored?.biometricEnabled),
            credentialId: stored?.credentialId ?? null,
          });
          router.refresh();
        }}
      />
    </>
  );
}
