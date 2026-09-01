"use client";

import { useState } from "react";
import {
  checkCurfew,
  curfewMessage,
  formatClock,
  minutesFromMidnightIn,
  type ICampus,
  type IDeliveryZone,
} from "@trefood/shared";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

interface ZonePickerProps {
  campus: ICampus;
  selectedZoneId: string | null;
  onSelect: (zoneId: string) => void;
  /**
   * The element that opens the sheet. Base UI composes via a `render` prop rather
   * than Radix's `asChild`, so this must be a single element, not a fragment.
   */
  trigger: React.ReactElement;
}

/** The slowest kitchen on campus, used for the picker's advisory curfew check. */
const ADVISORY_PREP_MINUTES = 25;

/**
 * The delivery-point picker.
 *
 * Opened from the sticky header, so it is reachable from any screen — which matters,
 * because changing the delivery point changes which restaurants exist at all.
 *
 * The curfew check shown here is ADVISORY. It uses a pessimistic prep time because no
 * restaurant has been chosen yet, and its job is to warn early rather than to decide.
 * The binding check happens at checkout against the real restaurant's prep time, and
 * again on the server. A zone shown as tight here may still be orderable from a fast
 * kitchen — so it is greyed with a reason, never removed.
 */
export function ZonePicker({ campus, selectedZoneId, onSelect, trigger }: ZonePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  /**
   * The campus clock, re-read every minute.
   *
   * `useNow` returns 0 until mounted, which is how a curfew avoids being baked into
   * server-rendered HTML — a statically rendered "closes in 40 minutes" is wrong the
   * moment it is served.
   */
  const now = useNow(60_000);
  const nowMinutes = now === 0 ? null : minutesFromMidnightIn(new Date(now), campus.timezone);

  const fallbackZone = campus.zones.find(
    (zone) => zone.zoneId === campus.settings.fallbackZoneId,
  );

  function statusFor(zone: IDeliveryZone) {
    if (nowMinutes === null || zone.curfewMinutes === undefined) return null;
    const result = checkCurfew({
      nowMinutes,
      curfewMinutes: zone.curfewMinutes,
      prepMinutes: ADVISORY_PREP_MINUTES,
      transitMinutes: campus.settings.transitMinutes,
    });
    return { result, zone };
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Where should we deliver?</SheetTitle>
          <SheetDescription>
            Riders hand over at the gate — pick the one you can walk to. This decides
            which restaurants can reach you.
          </SheetDescription>
        </SheetHeader>

        <ul className="space-y-2 px-4 pb-6">
          {campus.zones
            .filter((zone) => zone.isActive)
            .map((zone) => {
              const status = statusFor(zone);
              const isBlocked = status?.result.isBlocked === true;
              const isSelected = zone.zoneId === selectedZoneId;

              return (
                <li key={zone.zoneId}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(zone.zoneId);
                      setIsOpen(false);
                    }}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "touch-target w-full rounded-lg border p-3 text-left transition-colors",
                      isSelected ? "border-brand bg-brand/5" : "hover:bg-accent",
                      isBlocked && "opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium">{zone.name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {zone.curfewMinutes === undefined
                          ? "Open 24×7"
                          : `Closes ${formatClock(zone.curfewMinutes)}`}
                      </span>
                    </div>

                    {zone.instructions ? (
                      <p className="text-muted-foreground mt-1 text-xs">{zone.instructions}</p>
                    ) : null}

                    {isBlocked && status !== null && zone.curfewMinutes !== undefined ? (
                      <p className="text-status-failed mt-2 text-xs">
                        {curfewMessage(
                          zone.name,
                          zone.curfewMinutes,
                          status.result,
                          fallbackZone?.name ?? "the main gate",
                        )}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
