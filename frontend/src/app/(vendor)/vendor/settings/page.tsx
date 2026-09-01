"use client";

import { useState } from "react";
import { nitPatnaCampus, nitCanteen } from "@trefood/shared";

import { MoneyDisplay } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

/**
 * Vendor settings.
 *
 * The two controls at the top are the release valves taught on day one
 * (docs/FAILURES_AND_EDGE_CASES.md §5.4): during an exam-week surge, a vendor either
 * raises their prep time or switches themselves offline for twenty minutes. Both are
 * one tap, and both are far better than a cascade of F4 expiries and auto-refunds.
 * That is why they are first on this page rather than buried under bank details.
 */
export default function VendorSettingsPage() {
  const [isOpen, setIsOpen] = useState(nitCanteen.isOpen);
  const [prepMinutes, setPrepMinutes] = useState(nitCanteen.defaultPrepMinutes);
  const [servedZones, setServedZones] = useState<string[]>(nitCanteen.servedZoneIds);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">{isOpen ? "Accepting orders" : "Not accepting orders"}</p>
            <p className="text-muted-foreground text-xs">
              Switch off when the kitchen is swamped. Better a pause than orders you
              cannot answer — an unanswered order auto-cancels after four minutes and
              refunds the student.
            </p>
          </div>
          <Button
            variant={isOpen ? "outline" : "default"}
            className="touch-target shrink-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? "Go offline" : "Go online"}
          </Button>
        </div>

        <Separator />

        <div className="space-y-1">
          <Label htmlFor="prep" className="text-sm font-medium">
            Default prep time
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="prep"
              type="number"
              inputMode="numeric"
              min={5}
              max={60}
              value={prepMinutes}
              onChange={(event) => setPrepMinutes(Number(event.target.value))}
              className="touch-target w-24"
            />
            <span className="text-muted-foreground text-sm">minutes</span>
          </div>
          <p className="text-muted-foreground text-xs">
            Raise this during a rush. It sets the student&rsquo;s countdown and decides
            whether their hostel gate is still open when the rider arrives.
          </p>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">Gates you deliver to</h2>
        <p className="text-muted-foreground text-xs">
          Students only see you if you serve their gate. Unticking one removes you from
          those students&rsquo; lists entirely.
        </p>

        <ul className="space-y-1 pt-1">
          {nitPatnaCampus.zones.map((zone) => (
            <li key={zone.zoneId} className="touch-target flex items-center gap-3">
              <Checkbox
                id={zone.zoneId}
                checked={servedZones.includes(zone.zoneId)}
                onCheckedChange={() =>
                  setServedZones((current) =>
                    current.includes(zone.zoneId)
                      ? current.filter((id) => id !== zone.zoneId)
                      : [...current, zone.zoneId],
                  )
                }
              />
              <Label htmlFor={zone.zoneId} className="flex-1 text-sm font-normal">
                {zone.name}
                {zone.curfewMinutes === undefined ? (
                  <span className="text-muted-foreground"> · 24×7</span>
                ) : null}
              </Label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-lg border p-4 text-sm">
        <h2 className="font-medium">Charges</h2>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Packaging fee (you set)</span>
          <MoneyDisplay amountPaise={nitCanteen.packagingFeePaise} />
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Minimum order</span>
          <MoneyDisplay amountPaise={nitCanteen.minOrderPaise} />
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Delivery fee (set by campus)</span>
          <MoneyDisplay amountPaise={nitPatnaCampus.settings.deliveryFeePaise} />
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Platform commission</span>
          <span>{nitPatnaCampus.settings.commissionPct}%</span>
        </div>
        <p className="text-muted-foreground pt-1 text-xs">
          The delivery fee is collected from the student and paid to you. Commission is
          charged on food, packaging and delivery together.
        </p>
      </section>

      <p className="text-muted-foreground text-xs">
        Saving is wired in Phase 7. These controls are not persisted yet.
      </p>
    </main>
  );
}
