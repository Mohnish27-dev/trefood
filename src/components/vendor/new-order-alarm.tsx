"use client";

import { Bell, BellOff, BellRing, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVendorAlarm } from "@/context/vendor-alarm-context";

/**
 * ★ The new-order alarm — the indicator ★
 *
 * A missed order is lost revenue and a broken promise, so it is defended three
 * ways (ARCH section 5): the looping alarm audio, a browser notification, and
 * the card's red flash. The first two are owned by `VendorAlarmProvider`, which
 * lives in the vendor layout so it survives navigation between tabs. This
 * component is only the badge that reports what that engine is doing.
 *
 * **There is no silence control, by design.** The alarm rings for as long as an
 * order sits unanswered in the New column and stops only when the order leaves
 * it — accepted, rejected, or auto-expired. A mute button is a button a vendor
 * presses at 23:40 during a rush and forgets, and the next four orders die in
 * silence. Closing the shop does not silence it either: an order that is already
 * placed still owes the student an answer inside the acknowledgement window.
 */
export function NewOrderAlarm() {
  const { newOrderCount, soundReady, unlockSound } = useVendorAlarm();

  // Not a mute state — the browser is holding playback back until it sees a
  // gesture. Say so plainly, because a vendor who thinks they are covered and
  // is not is the worst of the three states.
  if (!soundReady) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber/30 bg-amber-wash px-3 py-2">
        <BellOff className="size-4 shrink-0 text-amber" />
        <p className="text-xs leading-tight text-amber">
          Your browser is blocking sound. New orders will not chime until you tap.
        </p>
        <Button size="sm" variant="secondary" className="ml-1" onClick={unlockSound}>
          <Volume2 />
          Enable sound
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

  // Deliberately not a button. The only way out of this state is answering the
  // order, which happens on the card.
  return (
    <div
      role="status"
      aria-live="assertive"
      className="animate-alarm-flash inline-flex min-h-12 items-center gap-2 rounded-xl border border-chili bg-chili-wash px-4 py-2.5 text-sm font-semibold text-chili"
    >
      <BellRing className="size-5 shrink-0" />
      {newOrderCount} new order{newOrderCount === 1 ? "" : "s"} — accept to stop the alarm
    </div>
  );
}
