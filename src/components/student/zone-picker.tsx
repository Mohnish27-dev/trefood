"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, Clock, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { useDeliveryZone } from "@/hooks/use-delivery-zone";
import { cn } from "@/lib/utils";
import type { ZoneType } from "@/lib/constants";

export interface ZoneOption {
  id: string;
  name: string;
  zoneType: ZoneType;
  /** Pre-formatted "21:30" or null for 24x7 — the server already did the timezone work. */
  curfewLabel: string | null;
  /** Computed server-side by checkCurfew, so this reflects the real clock. */
  available: boolean;
  /** Plain-language reason, fallback included. Shown inline, never hidden behind a tooltip. */
  blockedMessage: string | null;
  instructions: string;
}

const ZONE_LABEL: Record<ZoneType, string> = {
  HOSTEL_BOYS: "Boys hostel",
  HOSTEL_GIRLS: "Girls hostel",
  ACADEMIC: "Academic block",
  MAIN_GATE: "Main gate",
  RESIDENTIAL: "Residential",
};

/**
 * The sticky "Deliver to" header.
 *
 * This is the single most important structural difference from a mainstream
 * food app, so it gets permanent screen real estate rather than living in a
 * settings menu. Changing it changes which restaurants exist.
 */
export function ZonePicker({
  campusSlug,
  campusName,
  zones,
  selectedZoneId,
}: {
  campusSlug: string;
  campusName: string;
  zones: ZoneOption[];
  selectedZoneId: string | null;
}) {
  const [open, setOpen] = useState(selectedZoneId === null);
  const { setZoneId } = useDeliveryZone(campusSlug);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const selected = zones.find((z) => z.id === selectedZoneId) ?? null;

  const choose = (zoneId: string): void => {
    setZoneId(zoneId);
    setOpen(false);
    // The list is server-filtered by zone, so it has to be re-fetched.
    startTransition(() => router.refresh());
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur-lg pt-safe">
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface/60"
          >
            <MapPin className="size-4 shrink-0 text-saffron" />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-faint">
                Deliver to
              </span>
              <span className="block truncate text-sm font-medium text-bone">
                {selected ? selected.name : "Choose your gate"}
              </span>
            </span>
            {selected?.curfewLabel ? (
              <Badge tone="warning" className="shrink-0">
                <Clock className="size-3" />
                {selected.curfewLabel}
              </Badge>
            ) : selected ? (
              <Badge tone="success" className="shrink-0">
                24×7
              </Badge>
            ) : null}
            <ChevronDown
              className={cn("size-4 shrink-0 text-faint transition-transform", isPending && "animate-spin")}
            />
          </button>
        </Dialog.Trigger>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-deep/80 backdrop-blur-sm data-[state=open]:animate-rise" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-safe data-[state=open]:animate-rise">
          <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-surface px-5 pb-4 pt-5">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-bone">
                Where should we deliver?
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Riders hand over at the gate, never at a door. Your gate decides which
                restaurants can reach you.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-raised hover:text-bone"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <ul className="p-3">
            {zones.map((zone) => {
              const isSelected = zone.id === selectedZoneId;
              return (
                <li key={zone.id}>
                  <button
                    type="button"
                    onClick={() => choose(zone.id)}
                    // A blocked zone stays TAPPABLE. Selecting it is how the
                    // student sees why it is blocked and what to do instead —
                    // a disabled row with no explanation is the thing this
                    // product must never ship.
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors",
                      isSelected ? "bg-saffron-wash" : "hover:bg-surface-raised",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border",
                        zone.available
                          ? "border-line bg-surface-raised text-muted"
                          : "border-amber/30 bg-amber-wash text-amber",
                      )}
                    >
                      <MapPin className="size-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-bone">{zone.name}</span>
                        {zone.curfewLabel === null ? (
                          <Badge tone="success">24×7</Badge>
                        ) : (
                          <Badge tone={zone.available ? "neutral" : "warning"}>
                            <Clock className="size-3" />
                            Shuts {zone.curfewLabel}
                          </Badge>
                        )}
                      </span>

                      <span className="mt-0.5 block text-xs text-faint">
                        {ZONE_LABEL[zone.zoneType]}
                      </span>

                      {zone.blockedMessage ? (
                        <span className="mt-2 block rounded-lg border border-amber/25 bg-amber-wash px-2.5 py-2 text-xs leading-relaxed text-amber">
                          {zone.blockedMessage}
                        </span>
                      ) : null}
                    </span>

                    {isSelected ? <Check className="mt-2 size-4 shrink-0 text-saffron" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="px-5 pb-6 text-xs leading-relaxed text-faint">
            {campusName} · Gate times are checked again at checkout, against the
            restaurant&apos;s actual prep time.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
