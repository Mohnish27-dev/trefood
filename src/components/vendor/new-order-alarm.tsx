"use client";

import { Bell, BellRing } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALARM_AUDIO_PATH = "/audio/alarm_sound.mpeg";

/** Anything that counts as a user gesture on a tablet, a laptop or a mouse. */
const GESTURE_EVENTS = ["pointerdown", "mousedown", "touchstart", "keydown", "click"] as const;

/** How often a ringing-but-silent alarm retries, in ms. */
const RETRY_MS = 2000;

/**
 * ★ The new-order alarm ★
 *
 * A missed order is lost revenue and a broken promise, so it is defended three
 * ways (ARCH section 5). This component owns two of them — the looping alarm audio
 * and the browser notification — while the card owns the third, the red flash.
 *
 * Uses the alarm audio file located at `public/audio/alarm_sound.mpeg`.
 * Looping is enabled so it keeps ringing until silenced or accepted.
 *
 * It stops only on interaction: not on a timer, not after N repeats. The
 * whole point is that it keeps going until a human touches the tablet — and it
 * starts again the moment the next order lands, even if the last one was
 * silenced.
 *
 * The alarm has no off switch and no arming step. A reload must never leave a
 * vendor quietly deaf, so the component re-primes itself on every mount, on
 * every gesture anywhere on the page and whenever the tab returns to the
 * foreground, and it keeps retrying for as long as an order is waiting. Browser
 * autoplay policy can still hold the very first sound back until the vendor
 * touches the screen, which is why the retry never gives up rather than asking
 * them to switch anything on.
 */
export function NewOrderAlarm({
  newOrderCount,
  restaurantName,
}: {
  newOrderCount: number;
  restaurantName: string;
}) {
  const [silenced, setSilenced] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCount = useRef(newOrderCount);
  const primedRef = useRef(false);
  const notificationsAskedRef = useRef(false);

  const shouldRing = newOrderCount > 0 && !silenced;
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
   * Brings playback in line with what is on the board: ringing while an order
   * waits, silent otherwise. When it is silent and the element has never been
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
    // A newly arrived order un-silences: silencing acknowledges the orders on
    // screen now, never the ones that have not landed yet.
    if (newOrderCount > previousCount.current) {
      setSilenced(false);
      notifyBackgroundTab(newOrderCount, restaurantName);
    }
    previousCount.current = newOrderCount;
  }, [newOrderCount, restaurantName]);

  useEffect(() => {
    shouldRingRef.current = shouldRing;
    void syncPlayback();
  }, [shouldRing, syncPlayback]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  /* ── UI ─────────────────────────────────────────────────────── */

  if (newOrderCount === 0) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-muted">
        <Bell className="size-4 text-mint" />
        Alarm armed
      </span>
    );
  }

  return (
    <Button
      variant={silenced ? "secondary" : "danger"}
      size="lg"
      onClick={() => setSilenced(true)}
      className={cn(!silenced && "animate-alarm-flash")}
    >
      {silenced ? <Bell /> : <BellRing />}
      {silenced
        ? `${newOrderCount} waiting`
        : `Silence — ${newOrderCount} new order${newOrderCount === 1 ? "" : "s"}`}
    </Button>
  );
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
