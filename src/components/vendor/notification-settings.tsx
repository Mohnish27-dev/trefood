"use client";

import { BellOff, BellRing, Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useVendorLanguage } from "@/context/vendor-language-context";
import {
  hasDeviceSubscription,
  readPushSupport,
  subscribeThisDevice,
  type PushSupport,
} from "@/lib/push-client";

/**
 * Order alerts, on the settings screen.
 *
 * Two things live here that the blocking gate cannot cover. First, whether
 * THIS phone is currently registered — a vendor with an owner's phone and a
 * counter tablet needs to know which one is armed. Second, a test alert, which
 * is the only honest way to find out whether the phone's battery saver is
 * eating notifications before a real order does.
 */
export function VendorNotificationSettings() {
  const { t } = useVendorLanguage();

  const [state, setState] = useState<"checking" | "on" | "off">("checking");
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [sending, setSending] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [recheck, setRecheck] = useState(0);

  useEffect(() => {
    let active = true;
    const check = (): void => {
      void hasDeviceSubscription().then((subscribed) => {
        if (!active) return;
        const current = readPushSupport();
        setSupport(current);
        setState(subscribed && current === "granted" ? "on" : "off");
      });
    };

    check();
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", check);
    };
  }, [recheck]);

  /**
   * The way back for a vendor who skipped the gate, or whose subscription was
   * dropped: the gate only blocks while the permission is unanswered.
   */
  const enable = async (): Promise<void> => {
    setEnabling(true);
    await subscribeThisDevice();
    setEnabling(false);
    setRecheck((n) => n + 1);
  };

  const sendTest = async (): Promise<void> => {
    setSending(true);
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (body?.ok) toast.success(t("pushSettingsTestSent"));
      else toast.error(t("pushSettingsTestFailed"));
    } catch {
      toast.error(t("pushSettingsTestFailed"));
    } finally {
      setSending(false);
    }
  };

  // No VAPID keys on this deployment: there is nothing to turn on here.
  if (support === "unconfigured") return null;

  const on = state === "on";
  const canEnable = state === "off" && (support === "default" || support === "granted");

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span
          className={
            on
              ? "flex size-11 shrink-0 items-center justify-center rounded-xl border border-mint/25 bg-mint-wash"
              : "flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface"
          }
        >
          {on ? (
            <BellRing className="size-5 text-mint" />
          ) : (
            <BellOff className="size-5 text-faint" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-sm font-semibold text-bone">{t("pushSettingsTitle")}</p>
            {state === "checking" ? (
              <Loader2 className="size-3.5 animate-spin text-faint" />
            ) : (
              <Badge tone={on ? "success" : "neutral"}>
                {on ? t("pushSettingsOn") : t("pushSettingsOff")}
              </Badge>
            )}
          </div>

          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {on ? t("pushSettingsOnBody") : t("pushSettingsOffBody")}
          </p>

          {state === "off" && support === "denied" ? (
            <p className="mt-1.5 text-sm leading-relaxed text-chili">{t("pushGateBlockedBody")}</p>
          ) : null}

          {canEnable ? (
            <Button size="sm" className="mt-3" disabled={enabling} onClick={() => void enable()}>
              {enabling ? <Loader2 className="animate-spin" /> : <BellRing />}
              {t("pushGateEnable")}
            </Button>
          ) : null}

          {on ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              disabled={sending}
              onClick={() => void sendTest()}
            >
              {sending ? <Loader2 className="animate-spin" /> : <Send />}
              {t("pushSettingsTest")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-xs font-semibold tracking-wide text-bone uppercase">
          {t("pushSettingsTipsTitle")}
        </p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          {(["pushSettingsTip1", "pushSettingsTip2", "pushSettingsTip3"] as const).map((key) => (
            <li key={key} className="flex gap-2">
              <span aria-hidden className="text-saffron">
                •
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
