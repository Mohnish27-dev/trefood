"use client";

import { Clock, Loader2, MapPin, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Money } from "@/components/shared/money";
import { updateVendorSettings } from "@/server/actions/vendor";
import { PAISE_PER_RUPEE } from "@/lib/money";
import { DEFAULTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useVendorLanguage } from "@/context/vendor-language-context";

export interface SettingsZone {
  id: string;
  name: string;
  curfewLabel: string | null;
}

export interface VendorSettingsValues {
  phone: string;
  prepMinutes: number;
  opensMinutes: number;
  closesMinutes: number;
  packagingFeePaise: number;
  minOrderPaise: number;
  servedZoneIds: string[];
}

/**
 * Vendor settings.
 *
 * The zone picker at the bottom is the most consequential control on this
 * screen and the least obvious: a restaurant only appears in a student's list
 * if it has declared that it serves that student's gate. Unticking Kaveri
 * Girls does not hide a button — it removes this restaurant from every Kaveri
 * student's app entirely. The copy says so.
 *
 * Times are edited as HH:MM and stored as minutes from midnight, because a
 * campus-local clock comparison must never go anywhere near a Date.
 */
export function VendorSettingsForm({
  initial,
  zones,
  deliveryFeePaise,
  commissionPct,
}: {
  initial: VendorSettingsValues;
  zones: SettingsZone[];
  /** Campus-set and not editable here — shown so the vendor can see the full bill. */
  deliveryFeePaise: number;
  commissionPct: string;
}) {
  const { t } = useVendorLanguage();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof VendorSettingsValues>(
    key: K,
    value: VendorSettingsValues[K],
  ): void => setValues((prev) => ({ ...prev, [key]: value }));

  const toggleZone = (zoneId: string): void => {
    const next = values.servedZoneIds.includes(zoneId)
      ? values.servedZoneIds.filter((id) => id !== zoneId)
      : [...values.servedZoneIds, zoneId];
    set("servedZoneIds", next);
  };

  const submit = async (): Promise<void> => {
    setSaving(true);
    const result = await updateVendorSettings(values);
    setSaving(false);

    if (result.status === "error") toast.error(result.message);
    else toast.success(result.message ?? t("savedSuccessfully"));
  };

  return (
    <div className="max-w-3xl space-y-5">
      <header className="mb-5">
        <h1 className="font-display text-xl font-semibold text-bone">{t("settingsPageTitle")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("settingsPageSubtitle")}
        </p>
      </header>

      {/* ── Service ──────────────────────────────────────────────── */}
      <Card className="p-4">
        <h2 className="font-display text-sm font-semibold text-bone">{t("serviceSection")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {t("serviceSectionDesc")}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="prep">{t("typicalPrepTime")}</Label>
            <Input
              id="prep"
              type="number"
              inputMode="numeric"
              min={DEFAULTS.prepMinutesMin}
              max={DEFAULTS.prepMinutesMax}
              value={values.prepMinutes}
              onChange={(event) => set("prepMinutes", Number(event.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="phone">{t("phoneStudentsCall")}</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={(event) => set("phone", event.target.value)}
              placeholder="+91…"
            />
          </div>

          <TimeField
            id="opens"
            label={t("opens")}
            minutes={values.opensMinutes}
            onChange={(minutes) => set("opensMinutes", minutes)}
          />
          <TimeField
            id="closes"
            label={t("closes")}
            minutes={values.closesMinutes}
            onChange={(minutes) => set("closesMinutes", minutes)}
          />
        </div>

        {values.closesMinutes < values.opensMinutes ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <Clock className="size-3.5 text-faint" />
            {t("closingAfterMidnight")}
          </p>
        ) : null}
      </Card>

      {/* ── Charges ──────────────────────────────────────────────── */}
      <Card className="p-4">
        <h2 className="font-display text-sm font-semibold text-bone">{t("chargesSection")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {t("chargesSectionDesc").replace("{pct}", commissionPct)}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="packaging">{t("packagingFee")}</Label>
            <Input
              id="packaging"
              type="number"
              inputMode="numeric"
              min={0}
              value={values.packagingFeePaise / 100}
              onChange={(event) =>
                set("packagingFeePaise", wholeRupeesToPaise(event.target.value))
              }
            />
          </div>

          <div>
            <Label htmlFor="minorder">{t("minOrder")}</Label>
            <Input
              id="minorder"
              type="number"
              inputMode="numeric"
              min={0}
              value={values.minOrderPaise / 100}
              onChange={(event) =>
                set("minOrderPaise", wholeRupeesToPaise(event.target.value))
              }
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-muted">
          {t("campusDeliveryFee")}{" "}
          <Money paise={deliveryFeePaise} className="font-semibold text-bone" />
        </p>
      </Card>

      {/* ── Zones ────────────────────────────────────────────────── */}
      <Card className="p-4">
        <h2 className="font-display text-sm font-semibold text-bone">{t("gatesYouDeliverTo")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {t("gatesDesc")}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {zones.map((zone) => {
            const selected = values.servedZoneIds.includes(zone.id);
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => toggleZone(zone.id)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl border px-3.5 text-left transition-colors",
                  selected
                    ? "border-saffron/50 bg-saffron-wash"
                    : "border-line hover:bg-surface-raised",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border-2",
                    selected ? "border-saffron bg-saffron" : "border-line",
                  )}
                >
                  {selected ? <span className="size-2 rounded-sm bg-ink" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-bone">
                    {zone.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {zone.curfewLabel === null ? t("open247") : `${t("shuts")} ${zone.curfewLabel}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {values.servedZoneIds.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-chili/30 bg-chili-wash px-3 py-2 text-xs text-chili">
            <MapPin className="size-3.5 shrink-0" />
            {t("noGatesSelected")}
          </p>
        ) : null}
      </Card>

      {/* ── Campus Delivery Safety Directive ───────────────────────── */}
      <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-400" />
          <div>
            <h2 className="font-display text-sm font-semibold text-bone">Campus Delivery Protocol (After 7:00 PM)</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              For campus security reasons, all deliveries after 7:00 PM must be handled personally by the restaurant owner or verified co-owner (or trusted personnel with the owner&apos;s complete trust) so that safety inside campus premises is guaranteed.
            </p>
          </div>
        </div>
      </Card>

      <Button
        size="lg"
        disabled={saving || values.servedZoneIds.length === 0}
        onClick={() => void submit()}
      >
        {saving ? <Loader2 className="animate-spin" /> : <Save />}
        {saving ? t("saving") : t("saveSettings")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Whole rupees in, integer paise out.
 *
 * Both fields this serves are whole-rupee amounts by rule (A4), so truncating
 * is the correct operation rather than a rounding shortcut — and it keeps a
 * float out of a money path, which is the point of the whole convention.
 */
function wholeRupeesToPaise(input: string): number {
  const rupees = Math.trunc(Number(input));
  return Number.isFinite(rupees) && rupees >= 0 ? rupees * PAISE_PER_RUPEE : 0;
}

/** HH:MM in, minutes-from-midnight out. The storage format never leaks into the UI. */
function TimeField({
  id,
  label,
  minutes,
  onChange,
}: {
  id: string;
  label: string;
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const value = `${String(Math.trunc(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        value={value}
        onChange={(event) => {
          const [hours, mins] = event.target.value.split(":");
          const parsed = Number(hours) * 60 + Number(mins);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
      />
    </div>
  );
}
