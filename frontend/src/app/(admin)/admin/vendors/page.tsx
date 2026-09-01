"use client";

import { useState } from "react";
import { nitPatnaCampus, restaurants } from "@trefood/shared";

import { MoneyDisplay } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** The campus commission floor. An override below this is refused, in UI and again on the server. */
const COMMISSION_FLOOR = 8;

/**
 * Vendor KYC and configuration.
 *
 * The commission override is the sensitive control here: an ADMIN may lower a
 * vendor's rate for a launch promotion, but not below the campus floor — only a
 * SUPER_ADMIN can do that. Every override is audit-logged with the actor and a
 * written reason, because it is the one field that silently changes what TREFOOD
 * earns on every future order from that vendor.
 */
export default function VendorsPage() {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Vendors</h1>
        <p className="text-muted-foreground text-sm">
          KYC, commission and bank details. {restaurants.length} on this campus.
        </p>
      </div>

      <ul className="space-y-3">
        {restaurants.map((restaurant) => {
          const draft = overrides[restaurant._id] ?? "";
          const parsed = Number(draft);
          const isBelowFloor = draft !== "" && parsed < COMMISSION_FLOOR;

          return (
            <li key={restaurant._id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{restaurant.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {restaurant.cuisine.join(", ")} · {restaurant.phone}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Serves {restaurant.servedZoneIds.length} of {nitPatnaCampus.zones.length}{" "}
                    gates · min <MoneyDisplay amountPaise={restaurant.minOrderPaise} /> ·
                    packaging <MoneyDisplay amountPaise={restaurant.packagingFeePaise} />
                  </p>
                </div>

                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    restaurant.kycStatus === "APPROVED"
                      ? "bg-status-done/10 text-status-done"
                      : restaurant.kycStatus === "PENDING"
                        ? "bg-status-cooking/10 text-status-cooking"
                        : "bg-status-failed/10 text-status-failed",
                  )}
                >
                  {restaurant.kycStatus}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`commission-${restaurant._id}`}>Commission override %</Label>
                  <Input
                    id={`commission-${restaurant._id}`}
                    type="number"
                    inputMode="decimal"
                    value={draft}
                    onChange={(event) =>
                      setOverrides((current) => ({
                        ...current,
                        [restaurant._id]: event.target.value,
                      }))
                    }
                    placeholder={`${nitPatnaCampus.settings.commissionPct} (campus default)`}
                  />
                  {isBelowFloor ? (
                    <p className="text-status-failed text-xs">
                      Below the {COMMISSION_FLOOR}% campus floor — needs a super admin.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`bank-${restaurant._id}`}>Account number</Label>
                  <Input id={`bank-${restaurant._id}`} placeholder="Not captured" />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`upi-${restaurant._id}`}>UPI ID</Label>
                  <Input id={`upi-${restaurant._id}`} placeholder="vendor@upi" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Reject
                </Button>
                <Button size="sm" disabled={isBelowFloor}>
                  Save and approve
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
