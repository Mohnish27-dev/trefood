"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Check, ChevronDown, Clock, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useDeliveryZone } from "@/hooks/use-delivery-zone";
import { cn } from "@/lib/utils";
import type { ZoneType } from "@/lib/constants";

export interface ZoneOption {
  id: string;
  name: string;
  zoneType: ZoneType;
  curfewLabel: string | null;
  available: boolean;
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
 * Top maroon campus header with TreFood brand wordmark, gate picker pill,
 * and notification access.
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
    startTransition(() => router.refresh());
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-30 border-b border-[#6e001b] bg-tf-maroon text-white shadow-md pt-safe">
        <div className="mx-auto flex max-w-lg items-center justify-between px-3.5 py-2.5">
          {/* 1. Left: TreFood Brand Wordmark */}
          <Link
            href={`/c/${campusSlug}`}
            className="flex items-center gap-1.5 hover:opacity-95 transition-opacity"
          >
            <BrandLogo
              variant="on-maroon"
              size="sm"
              showText
              showTagline
            />
          </Link>

          {/* 2. Right: Location Pill + Bell Notification + Theme */}
          <div className="flex items-center gap-2">
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="group flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 hover:bg-white/25 active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                <MapPin className="size-3.5 shrink-0 text-tf-yellow" />
                <div className="flex flex-col text-left leading-none">
                  <span className="text-[8.5px] uppercase tracking-wider text-white/70 font-bold">
                    Deliver to
                  </span>
                  <span className="max-w-[105px] sm:max-w-[130px] truncate font-bold text-white text-[11px] sm:text-xs">
                    {selected ? selected.name : "Choose gate"}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "size-3 shrink-0 text-white/80 transition-transform group-hover:translate-y-0.5",
                    isPending && "animate-spin",
                  )}
                />
              </button>
            </Dialog.Trigger>

            {/* Notification Bell */}
            <Link
              href="/account/notifications"
              className="relative flex size-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-tf-yellow ring-1 ring-tf-maroon" />
            </Link>

            {/* Theme Toggle */}
            <ThemeToggle className="size-8 shrink-0 border-0 bg-white/10 text-white hover:bg-white/20" />
          </div>
        </div>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-rise" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-safe data-[state=open]:animate-rise shadow-2xl">
          <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-surface px-5 pb-4 pt-5">
            <div>
              <Dialog.Title className="font-display text-lg font-bold text-bone flex items-center gap-2">
                <MapPin className="size-5 text-tf-maroon" />
                <span>Select Your Campus Gate</span>
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted leading-relaxed">
                Riders deliver to your campus gate. Selecting your gate shows kitchens that deliver directly to you.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-raised hover:text-bone cursor-pointer"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <ul className="p-3.5 space-y-1.5">
            {zones.map((zone) => {
              const isSelected = zone.id === selectedZoneId;
              return (
                <li key={zone.id}>
                  <button
                    type="button"
                    onClick={() => choose(zone.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-all cursor-pointer border",
                      isSelected
                        ? "border-tf-maroon/30 bg-tf-maroon/5 ring-1 ring-tf-maroon"
                        : "border-line bg-surface hover:bg-surface-raised",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border",
                        isSelected
                          ? "border-tf-maroon bg-tf-maroon text-white"
                          : zone.available
                            ? "border-line bg-surface-raised text-muted"
                            : "border-amber/30 bg-amber-wash text-amber",
                      )}
                    >
                      <MapPin className="size-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-bone">{zone.name}</span>
                        {zone.curfewLabel === null ? (
                          <Badge tone="success">24×7</Badge>
                        ) : (
                          <Badge tone={zone.available ? "neutral" : "warning"}>
                            <Clock className="size-3" />
                            Shuts {zone.curfewLabel}
                          </Badge>
                        )}
                      </span>

                      <span className="mt-0.5 block text-xs text-muted">
                        {ZONE_LABEL[zone.zoneType]}
                      </span>

                      {zone.blockedMessage ? (
                        <span className="mt-2 block rounded-xl border border-amber/25 bg-amber-wash px-2.5 py-2 text-xs leading-relaxed text-amber">
                          {zone.blockedMessage}
                        </span>
                      ) : null}
                    </span>

                    {isSelected ? (
                      <span className="mt-2 flex size-5 shrink-0 items-center justify-center rounded-full bg-tf-maroon text-white text-xs">
                        <Check className="size-3 stroke-[3]" />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="px-5 pb-6 text-xs leading-relaxed text-faint">
            {campusName} · Gate times and curfews are checked in real-time.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
