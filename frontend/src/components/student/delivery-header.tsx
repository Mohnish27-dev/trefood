"use client";

import { useEffect, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { getCampus } from "@/lib/fixture-data";
import type { ICampus } from "@trefood/shared";

import { ZonePicker } from "@/components/student/zone-picker";
import { useDelivery } from "@/hooks/use-delivery-context";

/**
 * The sticky delivery-point header.
 *
 * Present on every browsing screen, because the delivery point is chosen BEFORE
 * browsing and filters what is shown — so the student must be able to see it and
 * change it at any moment, not only at checkout. This ordering is the single most
 * important structural difference from a mainstream food app.
 */
export function DeliveryHeader() {
  const { campusSlug, zoneId, setZone, isHydrated } = useDelivery();
  const [campus, setCampus] = useState<ICampus | null>(null);

  useEffect(() => {
    if (campusSlug === null) return;
    let active = true;
    void getCampus(campusSlug).then((result) => {
      if (active) setCampus(result);
    });
    return () => {
      active = false;
    };
  }, [campusSlug]);

  if (!isHydrated || campus === null) {
    return <div className="bg-background h-14 border-b" aria-hidden />;
  }

  const zone = campus.zones.find((candidate) => candidate.zoneId === zoneId);

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <ZonePicker
        campus={campus}
        selectedZoneId={zoneId}
        onSelect={setZone}
        trigger={
          <button
            type="button"
            className="touch-target hover:bg-accent flex w-full items-center gap-2 px-4 py-2 text-left transition-colors"
          >
            <MapPin className="text-brand size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="text-muted-foreground block text-[10px] tracking-wide uppercase">
                Deliver to
              </span>
              <span className="block truncate text-sm font-medium">
                {zone?.name ?? "Choose a delivery point"}
              </span>
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </button>
        }
      />
    </header>
  );
}
