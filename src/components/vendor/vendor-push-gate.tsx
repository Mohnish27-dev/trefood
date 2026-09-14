"use client";

import { BellRing, Loader2, ShieldAlert, Share, SquarePlus, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { useVendorLanguage } from "@/context/vendor-language-context";
import { readPushSupport, subscribeThisDevice, type PushSupport } from "@/lib/push-client";

import { VendorLanguageToggle } from "./vendor-language-toggle";

/**
 * ★ The console does not open until this phone can ring ★
 *
 * A vendor cannot answer an order they never heard about, and the in-console
 * alarm only rings while the console is open — which is not where a phone
 * spends its evening. So order alerts are not a preference here, in the same
 * way the alarm has no off switch: a console that is usable with alerts off is
 * a console that runs all week with alerts off, and the vendor blames TREFOOD
 * for the orders that quietly expired.
 *
 * This blocks on the two states the vendor can actually fix — never asked, and
 * blocked in browser settings — and tells them which buttons to press. The
 * states nobody can fix from here (a browser with no Push API at all, a push
 * service that refuses to register this device) show the same screen with a
 * way past it, because locking a working kitchen out of its own order board
 * would cost more orders than it saves.
 *
 * It renders nothing when this deployment has no VAPID key, and nothing in
 * development, where the service worker is deliberately unregistered.
 */

const SESSION_BYPASS_KEY = "trefood.vendor.push.bypass";

type GatePhase = "idle" | "working" | "failed";

export function VendorPushGate() {
  const { t } = useVendorLanguage();

  const support = useSyncExternalStore(subscribeToPermission, readPushSupport, serverSnapshot);
  const [phase, setPhase] = useState<GatePhase>("idle");
  const [bypassed, setBypassed] = useState(readBypass);

  const granted = support === "granted";

  /**
   * Keep the server's row for this device current: the vendor signed in on
   * a phone that a colleague used yesterday, or the deployment's VAPID key
   * changed, and in both cases the permission prompt is already answered so
   * nothing would otherwise re-register it.
   *
   * Failures here are deliberately silent. A subscription almost certainly
   * already exists server-side, and a flaky minute of hostel wifi must not
   * throw a full-screen blocker over a working board.
   */
  useEffect(() => {
    if (!granted) return;

    const sync = (): void => {
      if (document.visibilityState === "hidden") return;
      void subscribeThisDevice();
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [granted]);

  const enable = useCallback(async (): Promise<void> => {
    setPhase("working");
    const result = await subscribeThisDevice();
    // A denial is not a failure state: the permission store re-reads itself
    // and the screen switches to the "blocked" instructions on its own.
    setPhase(result.ok || result.reason === "denied" ? "idle" : "failed");
    notifyPermissionListeners();
  }, []);

  const dismissForSession = useCallback((): void => {
    try {
      window.sessionStorage.setItem(SESSION_BYPASS_KEY, "1");
    } catch {
      // Private mode. The bypass then lasts until this page is reloaded,
      // which is the safer direction to fail in.
    }
    setBypassed(true);
  }, []);

  // Nothing to enforce: no keys configured, already on, or checking.
  if (support === "checking" || support === "unconfigured" || support === "granted") return null;
  if (process.env.NODE_ENV !== "production") return null;
  if (bypassed) return null;

  const view = describe(support, phase);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-push-gate-title"
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-ink/97 p-4 backdrop-blur-sm"
    >
      <div className="my-auto w-full max-w-md rounded-2xl border border-line bg-surface-raised p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <span
            className={
              view.tone === "urgent"
                ? "flex size-14 shrink-0 items-center justify-center rounded-2xl border border-chili/30 bg-chili-wash"
                : "flex size-14 shrink-0 items-center justify-center rounded-2xl border border-saffron/30 bg-saffron-wash"
            }
          >
            <view.icon
              className={view.tone === "urgent" ? "size-7 text-chili" : "size-7 text-saffron"}
            />
          </span>
          <VendorLanguageToggle />
        </div>

        <h2
          id="vendor-push-gate-title"
          className="mt-4 font-display text-xl font-bold text-balance text-bone"
        >
          {t(view.title)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t(view.body)}</p>

        {support === "denied" ? (
          <ol className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm text-muted">
            {(["pushGateBlockedStep1", "pushGateBlockedStep2", "pushGateBlockedStep3"] as const).map(
              (key, index) => (
                <li key={key} className="flex items-start gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-surface font-mono text-xs font-bold text-saffron">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{t(key)}</span>
                </li>
              ),
            )}
          </ol>
        ) : null}

        {support === "ios-needs-install" ? (
          <ol className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm text-muted">
            <li className="flex items-start gap-2.5">
              <Share className="mt-0.5 size-4 shrink-0 text-saffron" />
              <span className="leading-relaxed">Safari → Share</span>
            </li>
            <li className="flex items-start gap-2.5">
              <SquarePlus className="mt-0.5 size-4 shrink-0 text-saffron" />
              <span className="leading-relaxed">Add to Home Screen → Add</span>
            </li>
          </ol>
        ) : null}

        <div className="mt-5 space-y-2">
          {support === "default" || phase === "failed" ? (
            <Button
              size="lg"
              block
              onClick={() => void enable()}
              disabled={phase === "working"}
              autoFocus
            >
              {phase === "working" ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t("pushGateWorking")}
                </>
              ) : (
                <>
                  <BellRing />
                  {t(phase === "failed" ? "pushGateRetry" : "pushGateEnable")}
                </>
              )}
            </Button>
          ) : (
            <Button size="lg" block onClick={notifyPermissionListeners}>
              {t("pushGateRecheck")}
            </Button>
          )}

          {/* Only where the vendor genuinely cannot fix it from this screen.
              "default" and "denied" both have a real next step above. */}
          {view.escapable ? (
            <>
              <Button size="md" block variant="ghost" onClick={dismissForSession}>
                {t("pushGateContinue")}
              </Button>
              <p className="text-center text-xs leading-relaxed text-faint">
                {t("pushGateContinueWarning")}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function describe(support: Exclude<PushSupport, "granted" | "unconfigured">, phase: GatePhase) {
  if (phase === "failed") {
    return {
      icon: TriangleAlert,
      tone: "urgent" as const,
      title: "pushGateFailedTitle" as const,
      body: "pushGateFailedBody" as const,
      escapable: true,
    };
  }

  switch (support) {
    case "denied":
      return {
        icon: ShieldAlert,
        tone: "urgent" as const,
        title: "pushGateBlockedTitle" as const,
        body: "pushGateBlockedBody" as const,
        escapable: false,
      };
    case "ios-needs-install":
      return {
        icon: BellRing,
        tone: "neutral" as const,
        title: "pushGateIosTitle" as const,
        body: "pushGateIosBody" as const,
        escapable: true,
      };
    case "unsupported":
      return {
        icon: TriangleAlert,
        tone: "urgent" as const,
        title: "pushGateUnsupportedTitle" as const,
        body: "pushGateUnsupportedBody" as const,
        escapable: true,
      };
    default:
      return {
        icon: BellRing,
        tone: "neutral" as const,
        title: "pushGateTitle" as const,
        body: "pushGateBody" as const,
        escapable: false,
      };
  }
}

/* ------------------------------------------------------------------ */
/* The browser as an external store                                    */
/* ------------------------------------------------------------------ */

/**
 * Read through `useSyncExternalStore` rather than an effect, like the student
 * card and the cart: the browser IS the store, React renders a server
 * snapshot first, and reconciling the two with `useEffect` + `setState` is a
 * cascading render for a value that was available synchronously.
 */
const listeners = new Set<() => void>();

function notifyPermissionListeners(): void {
  for (const listener of listeners) listener();
}

function serverSnapshot(): "checking" {
  return "checking";
}

function readBypass(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_BYPASS_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeToPermission(listener: () => void): () => void {
  listeners.add(listener);

  let status: PermissionStatus | null = null;
  const onChange = (): void => notifyPermissionListeners();

  // Fires when the vendor flips notifications in site settings and comes back,
  // which is exactly the journey the "blocked" screen sends them on.
  if ("permissions" in navigator) {
    void navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((result) => {
        status = result;
        result.addEventListener("change", onChange);
      })
      .catch(() => {
        // Firefox and older Safari refuse this query. "Check again" still works.
      });
  }

  window.addEventListener("focus", onChange);

  return () => {
    listeners.delete(listener);
    status?.removeEventListener("change", onChange);
    window.removeEventListener("focus", onChange);
  };
}
