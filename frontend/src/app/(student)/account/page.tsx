"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import type { ICampus } from "@trefood/shared";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDelivery } from "@/hooks/use-delivery-context";
import { getCampus } from "@/lib/fixture-data";

/** No session until Phase 6. This stands in for the signed-in profile. */
const MOCK_PROFILE = {
  name: "Aditi Raman",
  email: "aditi@nitp.ac.in",
  phone: "+91 98123 45678",
};

export default function AccountPage() {
  const { campusSlug, zoneId } = useDelivery();
  const [campus, setCampus] = useState<ICampus | null>(null);

  useEffect(() => {
    if (campusSlug === null) return;
    void getCampus(campusSlug).then(setCampus);
  }, [campusSlug]);

  /**
   * Notification permission is browser state, not React state, and it can change
   * from outside the app entirely — a student toggling it in site settings. Reading
   * it through an external store means the banner is correct on the next render
   * instead of stale until a reload.
   */
  const [permissionVersion, setPermissionVersion] = useState(0);
  const subscribe = useCallback(() => () => undefined, []);
  const pushPermission = useSyncExternalStore(
    subscribe,
    () => {
      void permissionVersion; // re-read after a request resolves
      return typeof Notification === "undefined"
        ? ("unsupported" as const)
        : Notification.permission;
    },
    () => "default" as const,
  );

  const zone = campus?.zones.find((candidate) => candidate.zoneId === zoneId);
  const isPushOn = pushPermission === "granted";

  return (
    <main className="space-y-6 px-4 py-4">
      <section>
        <h1 className="text-lg font-bold">{MOCK_PROFILE.name}</h1>
        <p className="text-muted-foreground text-sm">{MOCK_PROFILE.email}</p>
        <p className="text-muted-foreground text-sm">{MOCK_PROFILE.phone}</p>
      </section>

      <Separator />

      {/**
       * The push-permission banner.
       *
       * Persistent when permission is not granted, because push is never the ONLY
       * channel for the AT_GATE event (F17) — a student who denied the prompt would
       * otherwise stand in their room while food sits at the gate. The banner is the
       * fallback that makes that survivable.
       */}
      <section
        className={
          isPushOn
            ? "rounded-lg border p-3"
            : "border-status-cooking/40 bg-status-cooking/5 rounded-lg border p-3"
        }
      >
        <div className="flex items-start gap-3">
          {isPushOn ? (
            <Bell className="text-status-done mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <BellOff className="text-status-cooking mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">
              {isPushOn ? "Notifications are on" : "Notifications are off"}
            </p>
            <p className="text-muted-foreground text-xs">
              {isPushOn
                ? "We will ping you the moment your order reaches the gate."
                : "Without notifications you will not be told when your order reaches the gate — you would have to keep the app open."}
            </p>
            {!isPushOn && pushPermission !== "unsupported" ? (
              <Button
                size="sm"
                className="touch-target mt-1"
                onClick={() =>
                  void Notification.requestPermission().then(() =>
                    setPermissionVersion((current) => current + 1),
                  )
                }
              >
                Turn on notifications
              </Button>
            ) : null}
            {pushPermission === "denied" ? (
              <p className="text-muted-foreground text-xs">
                You blocked notifications earlier. Re-enable them in your browser
                settings for this site.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-medium">Delivery</h2>
        <p className="text-muted-foreground text-sm">
          {campus?.name ?? "No campus chosen"}
          {zone !== undefined ? ` · ${zone.name}` : ""}
        </p>
        <p className="text-muted-foreground text-xs">
          Change your delivery point from the header on any browsing screen.
        </p>
      </section>

      <Separator />

      <p className="text-muted-foreground text-xs">
        Sign-in arrives in Phase 6. This profile is placeholder data.
      </p>
    </main>
  );
}
