"use client";

import { BellOff, BellRing, Loader2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { clientEnv } from "@/lib/env";

type PushState = "unsupported" | "unconfigured" | "default" | "granted" | "denied" | "working";

/**
 * F17 — the notification that never arrived.
 *
 * The runbook is blunt about this: a student who swears they got no push
 * almost certainly denied the permission prompt or never installed the PWA.
 * The fix is not to try harder at pushing — it is to be honest that push is a
 * convenience and never the only channel. The order screen polls every eight
 * seconds regardless, and the gate code is on it whether a notification fired
 * or not.
 *
 * On iOS 16.4+ web push only works once the app is installed to the home
 * screen, which is why the denied and default states both point at where the
 * real information lives rather than nagging.
 *
 * Permission state is read through `useSyncExternalStore` rather than an
 * effect, for the same reason the cart and the zone picker are: the browser IS
 * an external store, React renders a server snapshot first, and syncing the
 * two with `useEffect` + `setState` is a cascading render for a value that was
 * available synchronously all along.
 */
export function PushPermissionCard() {
  const permission = useSyncExternalStore(
    subscribeToPermission,
    readPermission,
    () => "working" as const,
  );

  // Only the button press is genuinely transient, and it is set from an event
  // handler rather than a render or an effect.
  const [busy, setBusy] = useState(false);
  const state: PushState = busy ? "working" : permission;

  const enable = async (): Promise<void> => {
    setBusy(true);
    try {
      const granted = await Notification.requestPermission();
      if (granted !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch {
      // A failed subscription is a degraded convenience, never a broken app.
      // The store re-reads the real permission on the next notify anyway.
    } finally {
      setBusy(false);
      notifyPermissionListeners();
    }
  };

  if (state === "working") {
    return (
      <Card className="flex items-center gap-3 p-4">
        <Loader2 className="size-4 animate-spin text-faint" />
        <p className="text-sm text-muted">Checking notifications…</p>
      </Card>
    );
  }

  const granted = state === "granted";

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={
            granted
              ? "flex size-10 shrink-0 items-center justify-center rounded-xl border border-mint/25 bg-mint-wash"
              : "flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised"
          }
        >
          {granted ? (
            <BellRing className="size-5 text-mint" />
          ) : (
            <BellOff className="size-5 text-faint" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-sm font-semibold text-bone">Gate notifications</p>
            {granted ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>}
          </div>

          <p className="mt-1.5 text-sm leading-relaxed text-muted">{blurb(state)}</p>

          {state === "default" ? (
            <Button size="sm" className="mt-3" onClick={() => void enable()}>
              <BellRing />
              Turn on notifications
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* The browser as an external store                                    */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function notifyPermissionListeners(): void {
  for (const listener of listeners) listener();
}

function readPermission(): Exclude<PushState, "working"> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (!clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "unconfigured";
  return Notification.permission;
}

/**
 * The Permissions API fires `change` when a student flips notifications in
 * site settings, which is the one way this can change without us asking. Not
 * every browser exposes it for notifications, so a missing one degrades to
 * "only updates when we ask", which is the common case anyway.
 */
function subscribeToPermission(listener: () => void): () => void {
  listeners.add(listener);

  let status: PermissionStatus | null = null;
  const onChange = (): void => notifyPermissionListeners();

  if ("permissions" in navigator) {
    void navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((result) => {
        status = result;
        result.addEventListener("change", onChange);
      })
      .catch(() => {
        // Firefox and older Safari refuse this query. Nothing to do.
      });
  }

  return () => {
    listeners.delete(listener);
    status?.removeEventListener("change", onChange);
  };
}

function blurb(state: PushState): string {
  switch (state) {
    case "granted":
      return "You will be buzzed the moment your order reaches the gate. The order screen still shows everything even if a notification goes missing.";
    case "denied":
      return "Notifications are blocked in your browser settings. Nothing is lost — keep the order screen open and it updates itself every few seconds.";
    case "unsupported":
      return "This browser cannot show notifications. Keep the order screen open instead; it refreshes on its own.";
    case "unconfigured":
      return "Push is not switched on for this deployment yet. The order screen updates itself every few seconds, which is where the gate code appears.";
    default:
      return "Get a buzz the moment your food reaches your gate, instead of watching the screen. On iPhone this needs the app added to your home screen first.";
  }
}

/**
 * VAPID keys travel as URL-safe base64 and the Push API wants raw bytes.
 * Straight out of the web-push documentation; there is no shorter correct way.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(normalised);

  // Backed by a plain ArrayBuffer rather than the generic ArrayBufferLike, so
  // it satisfies `BufferSource` — a SharedArrayBuffer is not a valid key.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
