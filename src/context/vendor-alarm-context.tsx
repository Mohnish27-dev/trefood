"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { usePoll } from "@/hooks/use-poll";
import { clientEnv } from "@/lib/env";
import { ORDER_STATUS } from "@/lib/constants";
import type { VendorBoard } from "@/server/services/vendor";

const ALARM_AUDIO_PATH = "/audio/alarm_sound.mpeg";

/**
 * The board poll and the new-order alarm, hoisted above the routes.
 *
 * Both used to live inside `<OrderBoard>`, which is a page. A page unmounts on
 * every client-side navigation, and that produced two failures the vendor
 * actually felt: tapping "Menu" tore down the audio element so a waiting order
 * went quiet, and tapping "Orders" again remounted with `armed = false`, so the
 * board came back claiming the browser was blocking sound even though the
 * document had been unlocked minutes earlier.
 *
 * This provider is rendered by the vendor layout, which App Router keeps
 * mounted across every route in the group. So the audio element, the unlock
 * flag and the poll all outlive navigation, and the alarm rings from the moment
 * an order lands until it is accepted, rejected or auto-expired — no matter
 * which vendor screen is on the tablet.
 *
 * It also means one poll instead of two. The board reads its data from here
 * rather than fetching the same endpoint alongside the alarm.
 */

interface VendorAlarmContextValue {
  board: VendorBoard | null;
  connectionLost: boolean;
  lastSyncedAt: Date | null;
  error: Error | null;
  refresh: () => void;
  /** Orders sitting in PLACED — the only thing that makes noise. */
  newOrderCount: number;
  /** False only while the browser is still withholding playback. Never a mute. */
  soundReady: boolean;
  unlockSound: () => void;
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

  const [soundReady, setSoundReady] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCount = useRef(0);

  const newOrderCount = useMemo(
    () => (data?.orders ?? []).filter((order) => order.status === ORDER_STATUS.PLACED).length,
    [data],
  );

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

  const unlock = useCallback(async (): Promise<void> => {
    const audio = getAudio();
    if (audio) {
      try {
        if (newOrderCount > 0) {
          audio.currentTime = 0;
          await audio.play();
        } else {
          // Play briefly muted to satisfy the autoplay policy during the gesture.
          const prevVolume = audio.volume;
          audio.volume = 0;
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
          audio.volume = prevVolume;
        }
        setSoundReady(true);
      } catch {
        audio.volume = 1;
        setSoundReady(false);
      }
    }

    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationsOn(permission === "granted");
    } else if ("Notification" in window) {
      setNotificationsOn(Notification.permission === "granted");
    }
  }, [getAudio, newOrderCount]);

  // Any tap anywhere in the console counts. A vendor who accepts an order has
  // already unlocked the alarm for the next one without being asked twice — and
  // because this listener lives in the layout, a tap on the Menu screen arms it
  // for an order that lands while they are still editing prices.
  useEffect(() => {
    if (soundReady) return;
    const onFirstGesture = (): void => void unlock();
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstGesture);
  }, [soundReady, unlock]);

  /* ── Ring while anything is waiting ─────────────────────────── */

  useEffect(() => {
    if (newOrderCount > previousCount.current) {
      if (soundReady) {
        const audio = getAudio();
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch((err) => {
            console.warn("[VendorAlarm] Playback prevented:", err);
            setSoundReady(false);
          });
        }
      }
      notifyBackgroundTab(newOrderCount, restaurantName, notificationsOn);
    }
    previousCount.current = newOrderCount;
  }, [newOrderCount, restaurantName, notificationsOn, soundReady, getAudio]);

  // The single rule: something is waiting and the browser will let us make
  // noise, so we make noise. Nothing in the UI can stop it.
  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    if (newOrderCount > 0 && soundReady) {
      if (audio.paused) {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("[VendorAlarm] Playback prevented:", err);
            setSoundReady(false);
          });
        }
      }
    } else if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [newOrderCount, soundReady, getAudio]);

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
      soundReady,
      unlockSound: () => void unlock(),
    }),
    [data, connectionLost, lastSyncedAt, error, refresh, newOrderCount, soundReady, unlock],
  );

  return <VendorAlarmContext.Provider value={value}>{children}</VendorAlarmContext.Provider>;
}

/**
 * Defence two: a notification that fires even when the tab is backgrounded,
 * which is the normal state of a tablet showing a video between rushes.
 */
function notifyBackgroundTab(count: number, restaurantName: string, allowed: boolean): void {
  if (!allowed || typeof document === "undefined" || document.visibilityState === "visible") {
    return;
  }
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
