"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * The new-order alarm.
 *
 * A missed order is lost revenue and a broken promise, so it is defended three ways
 * (docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §5). This hook is the first: a looping chime
 * that STOPS ONLY ON INTERACTION. Not on a timer, not after N repeats — a canteen
 * during a rush will not notice eight seconds of sound, and an alarm that gives up is
 * the same as no alarm.
 *
 * ── Why the sound is synthesised rather than an audio file ──
 * A file has to load, and a vendor tablet on hostel Wi-Fi during a surge is exactly
 * when it will not. Web Audio needs no network, no asset and no cache, and it lets
 * the tone escalate rather than merely repeat.
 *
 * ── The autoplay problem, which is real and will bite ──
 * Browsers refuse to play audio until the page has been interacted with. A tablet
 * left on the counter after a reload is in exactly that state: silently unable to
 * ring. `isBlocked` exposes it so the board can show an unmissable prompt. Ignoring
 * this would produce the worst possible failure — an alarm everyone believes is armed
 * and which cannot make a sound.
 */

/** One context per tab. Browsers cap how many can exist, and we only need one. */
let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  sharedContext ??= new AudioContext();
  return sharedContext;
}

/**
 * Whether the browser is refusing to play sound.
 *
 * Read through an external store rather than mirrored into state: `AudioContext.state`
 * is browser-owned and changes on its own — the tab is backgrounded, the OS suspends
 * audio, the user finally interacts. `statechange` is the browser telling us, and
 * subscribing to it means the banner is right on the next render instead of stale.
 */
function subscribeToAudioState(onChange: () => void): () => void {
  const context = getAudioContext();
  context?.addEventListener("statechange", onChange);
  return () => context?.removeEventListener("statechange", onChange);
}

const BASE_INTERVAL_MS = 2_500;
/** Past this the tone gets louder and more frequent. Matches the F4 escalation. */
const ESCALATE_AFTER_SECONDS = 90;

interface UseOrderAlarmOptions {
  /** Ring while true. */
  isActive: boolean;
  /** Seconds since the oldest unacknowledged order landed, for escalation. */
  elapsedSeconds: number;
}

export function useOrderAlarm({ isActive, elapsedSeconds }: UseOrderAlarmOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const isBlocked = useSyncExternalStore(
    subscribeToAudioState,
    () => getAudioContext()?.state === "suspended",
    // Server: assume not blocked, so no banner is baked into the HTML.
    () => false,
  );

  /** A two-tone chime. Louder and higher once the ack window is running out. */
  const ring = useCallback((isEscalated: boolean) => {
    const context = getAudioContext();
    if (context === null || context.state === "suspended") return;

    const now = context.currentTime;
    const peak = isEscalated ? 0.45 : 0.25;

    for (const [index, frequency] of (isEscalated ? [1046, 1318] : [784, 988]).entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      const start = now + index * 0.18;
      // Ramped rather than switched: an abrupt gate produces an audible click.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    }
  }, []);

  /** Called from a real user gesture — the only thing that lifts the block. */
  const enableSound = useCallback(() => {
    const context = getAudioContext();
    void context?.resume().then(() => ring(false));
  }, [ring]);

  const isEscalated = elapsedSeconds >= ESCALATE_AFTER_SECONDS;

  useEffect(() => {
    if (!isActive || isMuted) {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    ring(isEscalated);
    const interval = isEscalated ? BASE_INTERVAL_MS / 2 : BASE_INTERVAL_MS;
    timerRef.current = setInterval(() => ring(isEscalated), interval);

    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isActive, isMuted, isEscalated, ring]);

  return { isBlocked, isMuted, setIsMuted, enableSound, isEscalated } as const;
}

/**
 * The third defence: a browser notification, so a backgrounded tab still shouts.
 *
 * Vendors switch tabs — to a supplier's site, to WhatsApp, to a spreadsheet — and a
 * tab that is not visible cannot flash a card at anyone.
 */
export function useBrowserNotification() {
  const shownRef = useRef(new Set<string>());

  return useCallback((orderId: string, title: string, body: string) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    // Only when the tab is actually hidden: an OS notification for a board the vendor
    // is already staring at is noise, and noise is what gets notifications muted.
    if (document.visibilityState === "visible") return;
    if (shownRef.current.has(orderId)) return;

    shownRef.current.add(orderId);
    new Notification(title, { body, tag: orderId, requireInteraction: true });
  }, []);
}
