"use client";

import { Bell, BellRing } from "lucide-react";

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
 * **There is no silence control and no enable control, by design.** The alarm
 * rings for as long as an order sits unanswered in the New column and stops only
 * when the order leaves it — accepted, rejected, or auto-expired. A mute button
 * is a button a vendor presses at 23:40 during a rush and forgets, and the next
 * four orders die in silence. Closing the shop does not silence it either: an
 * order that is already placed still owes the student an answer inside the
 * acknowledgement window.
 *
 * An enable button is the same trap wearing a different hat. It turns a
 * browser's autoplay delay into a setting the vendor believes they own, and a
 * reload into a decision. The provider re-arms itself on every gesture instead,
 * so this badge only ever has two things to say: armed, or ringing.
 */
export function NewOrderAlarm() {
  const { newOrderCount } = useVendorAlarm();

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
