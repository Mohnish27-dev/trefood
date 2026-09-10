"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { usePoll } from "@/hooks/use-poll";
import { clientEnv } from "@/lib/env";
import { ORDER_STATUS } from "@/lib/constants";
import type { VendorBoard } from "@/server/services/vendor";

const ALARM_AUDIO_PATH = "/audio/alarm_sound.mpeg";

/** Anything that counts as a user gesture on a tablet, a laptop or a mouse. */
const GESTURE_EVENTS = ["pointerdown", "mousedown", "touchstart", "keydown", "click"] as const;

/** How often a should-be-ringing alarm checks that it is in fact ringing, in ms. */
const RETRY_MS = 2000;

/**
 * The board poll and the new-order alarm, hoisted above the routes.
 *
 * Both used to live inside `<OrderBoard>`, which is a page. A page unmounts on
 * every client-side navigation, and that produced two failures the vendor
 * actually felt: tapping "Menu" tore down the audio element so a waiting order
 * went quiet, and tapping "Orders" again remounted disarmed, so the board came
 * back claiming the browser was blocking sound even though the document had
 * been unlocked minutes earlier.
 *
 * This provider is rendered by the vendor layout, which App Router keeps
 * mounted across every route in the group. So the audio element, the unlock
 * flag and the poll all outlive navigation, and the alarm rings from the moment
 * an order lands until it is accepted, rejected or auto-expired — no matter
 * which vendor screen is on the tablet.
 *
 * It also means one poll instead of two. The board reads its data from here
 * rather than fetching the same endpoint alongside the alarm.
 *
 * **The alarm has no off switch and no arming step.** It re-primes itself on
 * mount, on any gesture anywhere in the console, whenever the tab returns to the
 * foreground, and on a timer for as long as an order is waiting. Autoplay policy
 * can still hold the very first sound back until the vendor touches the screen,
 * which is why the retry never gives up rather than asking them to switch
 * anything on. A reload therefore costs a tap at worst, never a missed order,
 * and the vendor is never shown a control that implies the alarm can be off.
 */

interface VendorAlarmContextValue {
  board: VendorBoard | null;
  connectionLost: boolean;
  lastSyncedAt: Date | null;
  error: Error | null;
  refresh: () => void;
  /** Orders sitting in PLACED — the only thing that makes noise. */
  newOrderCount: number;
}

const VendorAlarmContext = createContext<VendorAlarmContextValue | undefined>(undefined);

export function useVendorAlarm(): VendorAlarmContextValue {
  const value = useContext(VendorAlarmContext);
  if (!value) throw new Error("useVendorAlarm must be used inside <VendorAlarmProvider>");
  return value;
}

export function VendorAlarmProvider({
  children,
  restaurantName,
}: {
  children: ReactNode;
  restaurantName: string;
}) {
  const { data, connectionLost, lastSyncedAt, error, refresh } = usePoll<VendorBoard>(
    async () => {
      const response = await fetch("/api/vendor/orders/poll", { cache: "no-store" });
      if (!response.ok) throw new Error(`Board poll failed: ${response.status}`);
      return (await response.json()) as VendorBoard;
    },
    { intervalMs: clientEnv.NEXT_PUBLIC_POLL_VENDOR_MS },
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCount = useRef(0);
  const primedRef = useRef(false);
  const notificationsAskedRef = useRef(false);

  const newOrderCount = useMemo(
    () => (data?.orders ?? []).filter((order) => order.status === ORDER_STATUS.PLACED).length,
    [data],
  );

  const shouldRing = newOrderCount > 0;
  const shouldRingRef = useRef(shouldRing);

  /* ── The alarm audio element ───────────────────────────────── */

  const getAudio = useCallback((): HTMLAudioElement | null => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const audio = new Audio(ALARM_AUDIO_PATH);
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  /**
   * The single rule, applied: something is waiting, so we make noise; nothing is
   * waiting, so we do not. When it is quiet and the element has never been
   * allowed to play, it takes the chance to prime it muted, so the next order
   * does not need a gesture of its own.
   */
  const syncPlayback = useCallback(async (): Promise<void> => {
    const audio = getAudio();
    if (!audio) return;

    if (shouldRingRef.current) {
      audio.volume = 1;
      if (audio.paused) {
        audio.currentTime = 0;
        try {
          await audio.play();
          primedRef.current = true;
        } catch {
          // Autoplay refused. The gesture listeners and the retry timer are
          // still live, so the next touch or the next tick starts the sound.
          primedRef.current = false;
        }
      }
      return;
    }

    if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }

    if (primedRef.current) return;

    try {
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      primedRef.current = true;
    } catch {
      primedRef.current = false;
    } finally {
      audio.volume = 1;
    }
  }, [getAudio]);

  const askForNotifications = useCallback((): void => {
    if (notificationsAskedRef.current) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    notificationsAskedRef.current = true;
    void Notification.requestPermission();
  }, []);

  /* ── Keep the alarm armed, always ───────────────────────────── */

  // Any tap anywhere in the console counts, and because this listener lives in
  // the layout, a tap on the Menu screen arms it for an order that lands while
  // the vendor is still editing prices.
  useEffect(() => {
    // A reload lands here: try straight away, since a browser that already
    // trusts this site allows it with no gesture at all.
    void syncPlayback();
    askForNotifications();

    const onGesture = (): void => {
      void syncPlayback();
      askForNotifications();
    };

    for (const eventName of GESTURE_EVENTS) {
      window.addEventListener(eventName, onGesture, { capture: true, passive: true });
    }
    window.addEventListener("focus", onGesture);
    document.addEventListener("visibilitychange", onGesture);

    // A tablet that sleeps, or another app that grabs audio focus, can pause us
    // mid-ring. Nothing tells us that happened, so we check.
    const retry = window.setInterval(() => {
      if (shouldRingRef.current) void syncPlayback();
    }, RETRY_MS);

    return () => {
      for (const eventName of GESTURE_EVENTS) {
        window.removeEventListener(eventName, onGesture, { capture: true });
      }
      window.removeEventListener("focus", onGesture);
      document.removeEventListener("visibilitychange", onGesture);
      window.clearInterval(retry);
    };
  }, [syncPlayback, askForNotifications]);

  /* ── Ring while anything is waiting ─────────────────────────── */

  useEffect(() => {
    shouldRingRef.current = shouldRing;
    void syncPlayback();
  }, [shouldRing, syncPlayback]);

  useEffect(() => {
    if (newOrderCount > previousCount.current) {
      notifyBackgroundTab(newOrderCount, restaurantName);
    }
    previousCount.current = newOrderCount;
  }, [newOrderCount, restaurantName]);

  // Only on a real teardown — signing out or leaving the console entirely.
  // Navigating between vendor tabs does not reach here, which is the point.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const value = useMemo<VendorAlarmContextValue>(
    () => ({
      board: data,
      connectionLost,
      lastSyncedAt,
      error,
      refresh,
      newOrderCount,
    }),
    [data, connectionLost, lastSyncedAt, error, refresh, newOrderCount],
  );

  return <VendorAlarmContext.Provider value={value}>{children}</VendorAlarmContext.Provider>;
}

/**
 * Defence two: a notification that fires even when the tab is backgrounded,
 * which is the normal state of a tablet showing a video between rushes.
 */
function notifyBackgroundTab(count: number, restaurantName: string): void {
  if (typeof document === "undefined" || document.visibilityState === "visible") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  try {
    new Notification(`${count} new order${count === 1 ? "" : "s"}`, {
      body: `${restaurantName} — accept within 4 minutes or it cancels itself.`,
      tag: "trefood-new-order",
      requireInteraction: true,
    });
  } catch {
    // Some browsers refuse constructor notifications outside a service worker.
    // The chime and the flashing card still stand.
  }
}
