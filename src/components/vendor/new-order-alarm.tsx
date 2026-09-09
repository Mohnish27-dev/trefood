"use client";

import { Bell, BellOff, BellRing, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALARM_AUDIO_PATH = "/audio/alarm_sound.mpeg";

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
 * Autoplay policy means media playback cannot start before a gesture, so when
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCount = useRef(newOrderCount);

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

  const arm = useCallback(async (): Promise<void> => {
    const audio = getAudio();
    if (audio) {
      try {
        if (newOrderCount > 0 && !silenced) {
          audio.currentTime = 0;
          await audio.play();
        } else {
          // Play briefly muted to unlock browser autoplay policy during user gesture
          const prevVolume = audio.volume;
          audio.volume = 0;
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
          audio.volume = prevVolume;
        }
        setArmed(true);
      } catch {
        if (audio) {
          audio.volume = 1;
        }
        setArmed(false);
      }
    }

    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationsOn(permission === "granted");
    } else if ("Notification" in window) {
      setNotificationsOn(Notification.permission === "granted");
    }
  }, [getAudio, newOrderCount, silenced]);

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
      if (armed) {
        const audio = getAudio();
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch((err) => {
            console.warn("[NewOrderAlarm] Playback prevented:", err);
            setArmed(false);
          });
        }
      }
      notifyBackgroundTab(newOrderCount, restaurantName, notificationsOn);
    }
    previousCount.current = newOrderCount;
  }, [newOrderCount, restaurantName, notificationsOn, armed, getAudio]);

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    if (newOrderCount > 0 && !silenced && armed) {
      if (audio.paused) {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("[NewOrderAlarm] Playback prevented:", err);
            setArmed(false);
          });
        }
      }
    } else {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }, [newOrderCount, silenced, armed, getAudio]);

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
