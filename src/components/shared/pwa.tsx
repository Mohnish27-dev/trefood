"use client";

import { Download, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Service worker registration, the install prompt, and the offline banner.
 *
 * All three live in one component because they are the same conversation with
 * the browser, and none of them is worth a separate mount.
 */

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // After load, not during: registration competes with the first paint for
    // bandwidth, and on campus wifi that is a real cost.
    const register = (): void => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A failed registration degrades the app to a normal website, which
        // works fine. It is never worth surfacing to a student.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

/* ------------------------------------------------------------------ */
/* Offline banner                                                      */
/* ------------------------------------------------------------------ */

/**
 * "You are offline — your placed orders are safe."
 *
 * The second half of that sentence is the whole point. A student who loses
 * signal after paying needs to know the order still exists; an offline
 * indicator alone invites them to pay again.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = (): void => setOffline(!navigator.onLine);
    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber px-4 py-2 text-xs font-medium text-ink"
    >
      <WifiOff className="size-3.5 shrink-0" />
      You are offline — any order you have placed is safe.
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Install prompt                                                      */
/* ------------------------------------------------------------------ */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DEFERRED_KEY = "trefood.install.dismissed";
const EARNED_KEY = "trefood.install.earned";

/**
 * The install prompt, deliberately deferred.
 *
 * Not on first visit — a student who has never ordered has no reason to want
 * an icon on their home screen, and a dismissed prompt is spent for weeks.
 * `markInstallPromptEarned()` is called once an order is delivered, when
 * intent peaks, and only then does this render.
 *
 * On iOS 16.4+ this is load-bearing rather than cosmetic: web push only works
 * once the app is installed, so the students who most need a gate notification
 * are exactly the ones who have to install first.
 */
export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event): void => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);

      try {
        const dismissed = window.localStorage.getItem(DEFERRED_KEY) === "1";
        const earned = window.localStorage.getItem(EARNED_KEY) === "1";
        setVisible(earned && !dismissed);
      } catch {
        // Private windows and storage-blocked browsers: skip the prompt rather
        // than showing it on every single page load.
        setVisible(false);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = (): void => {
    setVisible(false);
    try {
      window.localStorage.setItem(DEFERRED_KEY, "1");
    } catch {
      // Nothing to do; it simply asks again next time.
    }
  };

  const install = async (): Promise<void> => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    dismiss();
  };

  if (!visible || !prompt) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-24 z-40 mx-auto max-w-lg animate-rise",
        "rounded-2xl border border-saffron/30 bg-surface-raised p-4 shadow-2xl",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-saffron text-lg font-bold text-ink">
          T
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-bone">Add TREFOOD to your phone</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Opens straight to your order, and lets us buzz you the moment food reaches your gate.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void install()}>
              <Download />
              Add to home screen
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-faint hover:text-bone"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Called when an order reaches the student — the moment intent peaks. */
export function markInstallPromptEarned(): void {
  try {
    window.localStorage.setItem(EARNED_KEY, "1");
  } catch {
    // Storage is a convenience here, never a requirement.
  }
}
