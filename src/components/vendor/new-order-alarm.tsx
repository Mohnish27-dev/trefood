"use client";

import { Bell, BellOff, BellRing, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ★ The new-order alarm ★
 *
 * A missed order is lost revenue and a broken promise, so it is defended three
 * ways (ARCH section 5). This component owns two of them — the looping chime
 * and the browser notification — while the card owns the third, the red flash.
 *
 * Two decisions worth stating:
 *
 * **The chime is synthesised, not a file.** An MP3 is one more request to fail
 * on canteen wifi, one more asset to cache-bust, and silence at 23:00 if it
 * 404s. Two oscillators and a gain envelope cost nothing, work offline, and
 * cannot go missing.
 *
 * **It stops only on interaction.** Not on a timer, not after N repeats. The
 * whole point is that it keeps going until a human touches the tablet — and it
 * starts again the moment the next order lands, even if the last one was
 * silenced.
 *
 * Autoplay policy means an AudioContext cannot start before a gesture, so when
 * the browser refuses we say so and offer a button rather than pretending the
 * alarm is armed. A vendor who believes they will be alerted and is not is
 * worse off than one who knows they are watching the screen.
 */
export function NewOrderAlarm({
  newOrderCount,
  restaurantName,
}: {
  newOrderCount: number;
  restaurantName: string;
}) {
  const [armed, setArmed] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const previousCount = useRef(newOrderCount);

  /* ── The chime ──────────────────────────────────────────────── */

  const chime = useCallback((): void => {
    const context = audioRef.current;
    if (!context || context.state !== "running") return;

    // Two short rising tones. Pitched around 880/1320 Hz, which cuts through
    // an extractor fan far better than a low tone does.
    const now = context.currentTime;
    for (const [index, frequency] of [880, 1_320].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      const start = now + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    }
  }, []);

  const arm = useCallback(async (): Promise<void> => {
    try {
      audioRef.current ??= new AudioContext();
      await audioRef.current.resume();
      setArmed(audioRef.current.state === "running");
      chime();
    } catch {
      setArmed(false);
    }

    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationsOn(permission === "granted");
    } else if ("Notification" in window) {
      setNotificationsOn(Notification.permission === "granted");
    }
  }, [chime]);

  // Any interaction anywhere counts as arming, so a vendor who taps Accept has
  // already armed the alarm for the next order without being asked twice.
  useEffect(() => {
    if (armed) return;
    const onFirstGesture = (): void => void arm();
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstGesture);
  }, [armed, arm]);

  /* ── Ring while anything is waiting ─────────────────────────── */

  useEffect(() => {
    // A newly arrived order un-silences: silencing acknowledges the orders on
    // screen now, never the ones that have not landed yet.
    if (newOrderCount > previousCount.current) {
      setSilenced(false);
      notifyBackgroundTab(newOrderCount, restaurantName, notificationsOn);
    }
    previousCount.current = newOrderCount;
  }, [newOrderCount, restaurantName, notificationsOn]);

  useEffect(() => {
    if (newOrderCount === 0 || silenced || !armed) return;

    chime();
    const id = setInterval(chime, 2_500);
    return () => clearInterval(id);
  }, [newOrderCount, silenced, armed, chime]);

  useEffect(() => {
    return () => {
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  /* ── UI ─────────────────────────────────────────────────────── */

  if (!armed) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber/30 bg-amber-wash px-3 py-2">
        <BellOff className="size-4 shrink-0 text-amber" />
        <p className="text-xs leading-tight text-amber">
          Sound is off. New orders will not chime.
        </p>
        <Button size="sm" variant="secondary" className="ml-1" onClick={() => void arm()}>
          <Volume2 />
          Turn on
        </Button>
      </div>
    );
  }

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
