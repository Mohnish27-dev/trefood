"use client";

import { Check, Clock, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useDeliveryZone } from "@/hooks/use-delivery-zone";
import { cn } from "@/lib/utils";
import type { ZoneOption } from "@/components/student/zone-picker";

/**
 * The gate, chosen from the account screen instead of the browse header.
 *
 * Same cookie, same effect: this is not a second source of truth, it is a
 * second door to the one the zone picker already writes. Changing it here
 * changes which restaurants the feed will show, which is why every row says so
 * rather than reading like a postal address.
 *
 * Gates that are past curfew are still listed and still selectable — a student
 * planning tomorrow's lunch at 2 AM should not be told their own hostel does
 * not exist. The reason is printed on the row instead.
 */
export function PickupLocationPicker({
  campusSlug,
  campusName,
  zones,
}: {
  campusSlug: string;
  campusName: string;
  zones: ZoneOption[];
}) {
  const router = useRouter();
  const { zoneId, setZoneId } = useDeliveryZone(campusSlug);
  const [isPending, startTransition] = useTransition();

  const choose = (id: string): void => {
    setZoneId(id);
    // The restaurant list is filtered server-side by this cookie.
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-sky/25 bg-sky-wash">
            <MapPin className="size-4 text-sky" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-bone">{campusName}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Food is handed over at a gate, never at your room. Restaurants declare which
              gates they deliver to, so the one you pick here decides what you can order.
            </p>
          </div>
        </div>
      </Card>

      <div
        role="radiogroup"
        aria-label="Pickup gate"
        className={cn("space-y-2", isPending && "opacity-70")}
      >
        {zones.map((zone) => {
          const selected = zone.id === zoneId;

          return (
            <button
              key={zone.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(zone.id)}
              className={cn(
                "flex w-full min-h-14 items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                selected
                  ? "border-saffron/50 bg-saffron-wash"
                  : "border-line bg-surface hover:bg-surface-raised",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-saffron bg-saffron" : "border-line-strong",
                )}
              >
                {selected ? <Check className="size-3 text-ink" strokeWidth={3.5} /> : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-bone">{zone.name}</span>
                  {zone.available ? null : <Badge tone="warning">Closed now</Badge>}
                </span>

                {zone.instructions ? (
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {zone.instructions}
                  </span>
                ) : null}

                {zone.curfewLabel ? (
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs text-faint">
                    <Clock className="size-3" />
                    Gate closes at {zone.curfewLabel}
                  </span>
                ) : (
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs text-faint">
                    <Clock className="size-3" />
                    Open around the clock
                  </span>
                )}

                {!zone.available && zone.blockedMessage ? (
                  <span className="mt-1.5 block text-xs leading-relaxed text-amber">
                    {zone.blockedMessage}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-1 text-xs leading-relaxed text-faint">
        Your gate is remembered on this device. Change it any time — from here, or from
        &ldquo;Deliver to&rdquo; at the top of the restaurant list.
      </p>
    </div>
  );
}
