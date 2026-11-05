"use client";

import {
  BellRing,
  Download,
  Share,
  Smartphone,
  Sparkles,
  SquarePlus,
  WifiOff,
  X,
} from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { useVendorLanguage } from "@/context/vendor-language-context";
import { cn } from "@/lib/utils";

/**
 * Service worker registration, the install prompt, and the offline banner.
 *
 * All three live in one component because they are the same conversation with
 * the browser, and none of them is worth a separate mount.
 */

/* ------------------------------------------------------------------ */
/* Pre-hydration PWA prompt capture script                            */
/* ------------------------------------------------------------------ */

export const pwaInitScript = `
(function() {
  try {
    window.__trefoodInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      window.__trefoodInstallPrompt = e;
      window.dispatchEvent(new CustomEvent('trefood:pwa-prompt-ready'));
    });
    window.addEventListener('appinstalled', function() {
      window.__trefoodInstallPrompt = null;
      window.dispatchEvent(new CustomEvent('trefood:pwa-installed'));
    });
  } catch(e) {}
})();
`;

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __trefoodInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone))
  );
}

export function isIOSDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isApple = /iPad|iPhone|iPod/.test(ua);
  const isMacTouch =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return isApple || isMacTouch;
}

const STUDENT_SESSION_DISMISSED_KEY = "trefood.install.dismissed.session";
const VENDOR_SESSION_DISMISSED_KEY = "trefood.vendor.install.dismissed.session";

/* ------------------------------------------------------------------ */
/* External store subscriptions (React 19 sync architecture)           */
/* ------------------------------------------------------------------ */

function subscribeMounted() {
  return () => {};
}
function getMountedSnapshot(): boolean {
  return true;
}
function getMountedServerSnapshot(): boolean {
  return false;
}
export function useIsMounted(): boolean {
  return useSyncExternalStore(subscribeMounted, getMountedSnapshot, getMountedServerSnapshot);
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  window.addEventListener("trefood:pwa-installed", callback);
  return () => {
    mql.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
    window.removeEventListener("trefood:pwa-installed", callback);
  };
}
function getStandaloneSnapshot(): boolean {
  return isStandaloneMode();
}
function getStandaloneServerSnapshot(): boolean {
  return false;
}
export function useIsStandalone(): boolean {
  return useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getStandaloneServerSnapshot,
  );
}

function subscribePrompt(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("beforeinstallprompt", callback);
  window.addEventListener("trefood:pwa-prompt-ready", callback);
  window.addEventListener("trefood:pwa-installed", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    window.removeEventListener("beforeinstallprompt", callback);
    window.removeEventListener("trefood:pwa-prompt-ready", callback);
    window.removeEventListener("trefood:pwa-installed", callback);
    window.removeEventListener("appinstalled", callback);
  };
}
function getPromptSnapshot(): BeforeInstallPromptEvent | null {
  return typeof window !== "undefined" ? (window.__trefoodInstallPrompt ?? null) : null;
}
function getPromptServerSnapshot(): BeforeInstallPromptEvent | null {
  return null;
}
export function usePromptStore(): BeforeInstallPromptEvent | null {
  return useSyncExternalStore(subscribePrompt, getPromptSnapshot, getPromptServerSnapshot);
}

const dismissedListeners = new Set<() => void>();

function notifyDismissedListeners(): void {
  dismissedListeners.forEach((cb) => cb());
}

function getDismissedSnapshot(isVendor: boolean): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = isVendor ? VENDOR_SESSION_DISMISSED_KEY : STUDENT_SESSION_DISMISSED_KEY;
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function subscribeDismissed(callback: () => void) {
  dismissedListeners.add(callback);
  return () => {
    dismissedListeners.delete(callback);
  };
}

export function dismissInstallPrompt(isVendor = false): void {
  if (typeof window !== "undefined") {
    try {
      const key = isVendor ? VENDOR_SESSION_DISMISSED_KEY : STUDENT_SESSION_DISMISSED_KEY;
      window.sessionStorage.setItem(key, "1");
    } catch {}
  }
  notifyDismissedListeners();
}

export function openInstallPrompt(): void {
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STUDENT_SESSION_DISMISSED_KEY);
      window.sessionStorage.removeItem(VENDOR_SESSION_DISMISSED_KEY);
    } catch {}
  }
  notifyDismissedListeners();
}

export function useIsDismissed(isVendor = false): boolean {
  return useSyncExternalStore(
    subscribeDismissed,
    () => getDismissedSnapshot(isVendor),
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Service workers should only run in production builds.
    // In development (next dev / Turbopack), HMR and dev chunks conflict with SW caching.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) {
            void caches.delete(key);
          }
        });
      }
      return;
    }

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
      className="no-print print:hidden fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber px-4 py-2 text-xs font-medium text-ink"
    >
      <WifiOff className="size-3.5 shrink-0" />
      You are offline — any order you have placed is safe.
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Install prompt                                                      */
/* ------------------------------------------------------------------ */

/**
 * Immediate, mobile-responsive PWA install popup.
 *
 * Appears immediately when a user opens the website via link, unless they
 * are already running in standalone PWA mode or have dismissed it for the
 * current session.
 *
 * Works across Android/Chromium (native prompt), iOS Safari (interactive visual guide),
 * and desktop browsers.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const isMounted = useIsMounted();
  const isInstalled = useIsStandalone();
  const isVendorRoute = pathname.startsWith("/vendor");
  const isDismissed = useIsDismissed(isVendorRoute);
  const prompt = usePromptStore();
  const { lang } = useVendorLanguage();
  const isHindi = isVendorRoute && lang === "hi";

  const [showGuide, setShowGuide] = useState(false);

  const isExcludedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/courier") ||
    pathname.startsWith("/print") ||
    pathname.endsWith("/kot");

  if (!isMounted || isInstalled || isDismissed || isExcludedRoute) return null;

  const isIOS = isIOSDevice();
  const hasBottomNav =
    pathname.startsWith("/c/") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/account");

  const handleInstallClick = async (): Promise<void> => {
    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") {
          dismissInstallPrompt(isVendorRoute);
          return;
        }
      } catch {
        // Fall through to visual guide if prompt threw
      }
    }
    setShowGuide(true);
  };

  const handleDismiss = (): void => {
    setShowGuide(false);
    dismissInstallPrompt(isVendorRoute);
  };

  return (
    <div
      role="region"
      aria-label={
        isVendorRoute
          ? isHindi
            ? "TREFOOD वेंडर ऐप इंस्टॉल करें"
            : "Install TREFOOD Vendor Console"
          : "Install TREFOOD App"
      }
      className={cn(
        "no-print print:hidden fixed z-50 transition-all duration-300 animate-rise",
        // Mobile layout: centered floating bottom card with safe area margin
        "inset-x-3 mx-auto max-w-md",
        hasBottomNav ? "bottom-20 sm:bottom-6" : "bottom-4 sm:bottom-6",
        // Desktop layout: docked at bottom-right
        "sm:inset-x-auto sm:right-6 sm:w-[400px]",
        "rounded-2xl border border-saffron/40 bg-surface-raised/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl ring-1 ring-saffron/25 pb-safe",
      )}
    >
      {!showGuide ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-saffron/30 bg-surface shadow-md">
              <Image
                src="/icons/icon-192.png"
                alt="TREFOOD"
                width={48}
                height={48}
                className="size-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-sm font-bold text-bone">
                  {isVendorRoute
                    ? isHindi
                      ? "TREFOOD वेंडर कंसोल"
                      : "TREFOOD Vendor Console"
                    : "Install TREFOOD"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-saffron/30 bg-saffron-wash px-1.5 py-0.5 text-[0.625rem] font-semibold text-saffron">
                  <span className="size-1 rounded-full bg-saffron animate-pulse" />
                  {isVendorRoute ? (isHindi ? "वेंडर PWA" : "Vendor PWA") : "PWA"}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {isVendorRoute
                  ? isHindi
                    ? "लाइव किचन ऑर्डर संभालें, तुरंत आवाज़ का अलर्ट पाएं, और काउंटर तेज़ी से चलाएं।"
                    : "Manage live kitchen orders, receive instant order chimes, and run the counter smoothly."
                  : "Order directly from campus vendors with zero markup and live gate arrival alerts."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-faint transition-colors hover:bg-surface hover:text-bone active:scale-95"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-[0.6875rem] text-faint">
            {isVendorRoute ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <BellRing className="size-3 text-saffron" />{" "}
                  {isHindi ? "तुरंत ऑर्डर अलर्ट" : "Instant order chimes"}
                </span>
                <span className="text-faint/40">·</span>
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="size-3 text-mint" />{" "}
                  {isHindi ? "टैबलेट और फोन तैयार" : "Tablet & counter ready"}
                </span>
                <span className="text-faint/40">·</span>
                <span className="inline-flex items-center gap-1">
                  <Download className="size-3 text-sky" />{" "}
                  {isHindi ? "तेज़ और हल्का" : "Fast & lightweight"}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-3 text-saffron" /> 1-tap ordering
                </span>
                <span className="text-faint/40">·</span>
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="size-3 text-mint" /> No app store needed
                </span>
                <span className="text-faint/40">·</span>
                <span className="inline-flex items-center gap-1">
                  <Download className="size-3 text-sky" /> Fast &amp; lightweight
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="md"
              className="flex-1 font-semibold text-xs sm:text-sm"
              onClick={() => void handleInstallClick()}
            >
              <Download className="size-4" />
              {isIOS
                ? isHindi
                  ? "iPhone पर कैसे जोड़ें"
                  : "How to install on iPhone"
                : isHindi
                  ? "ऐप इंस्टॉल करें"
                  : "Install App"}
            </Button>
            <Button
              size="md"
              variant="ghost"
              onClick={handleDismiss}
              className="px-3 text-xs sm:text-sm text-muted hover:text-bone"
            >
              {isHindi ? "अभी नहीं" : "Not now"}
            </Button>
          </div>
        </div>
      ) : (
        /* Step-by-step guide */
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-saffron" />
              <h3 className="font-display text-sm font-bold text-bone">
                {isIOS
                  ? isHindi
                    ? "iPhone / iPad पर जोड़ें"
                    : "Install on iPhone / iPad"
                  : isHindi
                    ? "ब्राउज़र में इंस्टॉल करें"
                    : "Install in Your Browser"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="flex size-8 items-center justify-center rounded-lg text-faint transition-colors hover:text-bone"
              aria-label="Back to prompt"
            >
              <X className="size-4" />
            </button>
          </div>

          {isIOS ? (
            <ol className="space-y-2 text-xs text-muted">
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-saffron/20 font-mono text-[0.65rem] font-bold text-saffron">
                  1
                </span>
                <span className="leading-relaxed">
                  {isHindi ? (
                    <>
                      Safari में नीचे <strong className="text-bone">Share बटन</strong>{" "}
                      <Share className="inline size-3.5 text-saffron align-text-bottom" /> पर टैप करें।
                    </>
                  ) : (
                    <>
                      Tap the <strong className="text-bone">Share button</strong>{" "}
                      <Share className="inline size-3.5 text-saffron align-text-bottom" /> in Safari&apos;s bottom toolbar.
                    </>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-saffron/20 font-mono text-[0.65rem] font-bold text-saffron">
                  2
                </span>
                <span className="leading-relaxed">
                  {isHindi ? (
                    <>
                      नीचे स्क्रॉल करके{" "}
                      <strong className="text-bone">&quot;Add to Home Screen&quot;</strong>{" "}
                      <SquarePlus className="inline size-3.5 text-saffron align-text-bottom" /> चुनें।
                    </>
                  ) : (
                    <>
                      Scroll down and tap{" "}
                      <strong className="text-bone">&quot;Add to Home Screen&quot;</strong>{" "}
                      <SquarePlus className="inline size-3.5 text-saffron align-text-bottom" />.
                    </>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-saffron/20 font-mono text-[0.65rem] font-bold text-saffron">
                  3
                </span>
                <span className="leading-relaxed">
                  {isHindi ? (
                    <>
                      ऊपर दाईं तरफ <strong className="text-bone">&quot;Add&quot;</strong> पर टैप करें।
                    </>
                  ) : (
                    <>
                      Tap <strong className="text-bone">&quot;Add&quot;</strong> in the top-right corner.
                    </>
                  )}
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-2 text-xs text-muted">
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-saffron/20 font-mono text-[0.65rem] font-bold text-saffron">
                  1
                </span>
                <span className="leading-relaxed">
                  {isHindi ? (
                    <>
                      ब्राउज़र मेन्यू <strong className="text-bone font-mono">⋮</strong> (तीन बिंदु) या एड्रेस बार के इंस्टॉल आइकन पर टैप करें।
                    </>
                  ) : (
                    <>
                      Tap the browser menu <strong className="text-bone font-mono">⋮</strong> (three dots) or the install icon in the address bar.
                    </>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-saffron/20 font-mono text-[0.65rem] font-bold text-saffron">
                  2
                </span>
                <span className="leading-relaxed">
                  {isHindi ? (
                    <>
                      <strong className="text-bone">&quot;Install app&quot;</strong> या{" "}
                      <strong className="text-bone">&quot;Add to Home screen&quot;</strong> चुनें।
                    </>
                  ) : (
                    <>
                      Select <strong className="text-bone">&quot;Install app&quot;</strong> or{" "}
                      <strong className="text-bone">&quot;Add to Home screen&quot;</strong>.
                    </>
                  )}
                </span>
              </li>
            </ol>
          )}

          <div className="flex justify-end gap-2 border-t border-line/60 pt-2">
            <Button size="sm" variant="ghost" onClick={() => setShowGuide(false)}>
              {isHindi ? "पीछे" : "Back"}
            </Button>
            <Button size="sm" onClick={handleDismiss}>
              {isHindi ? "समझ गए" : "Got it"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sleek header CTA button to install the app or reopen the installation guide.
 */
export function InstallHeaderButton({ className }: { className?: string } = {}) {
  const pathname = usePathname();
  const isMounted = useIsMounted();
  const isInstalled = useIsStandalone();
  const isVendorRoute = pathname.startsWith("/vendor");
  const { lang } = useVendorLanguage();
  const isHindi = isVendorRoute && lang === "hi";

  if (!isMounted || isInstalled) return null;

  return (
    <button
      type="button"
      onClick={openInstallPrompt}
      className={cn(
        "no-print print:hidden inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-saffron/35 bg-saffron-wash px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-saffron transition-all hover:bg-saffron hover:text-white active:scale-95",
        className,
      )}
      aria-label={
        isVendorRoute
          ? isHindi
            ? "TREFOOD वेंडर ऐप इंस्टॉल करें"
            : "Install TREFOOD Vendor App"
          : "Install TREFOOD App"
      }
    >
      <Download className="size-3.5 shrink-0" />
      <span className="sm:hidden">{isHindi ? "इंस्टॉल" : "Install"}</span>
      <span className="hidden sm:inline">
        {isHindi ? "ऐप इंस्टॉल करें" : "Install App"}
      </span>
    </button>
  );
}

/** Preserved for backward compatibility with order-tracker */
export function markInstallPromptEarned(): void {
  // Retained so callers do not error
}
