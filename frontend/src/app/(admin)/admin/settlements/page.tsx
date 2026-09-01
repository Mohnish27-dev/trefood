"use client";

import { useState } from "react";
import { Download, Play } from "lucide-react";
import { addPaise, restaurants, settlements, type ISettlement } from "@trefood/shared";

import { MoneyDisplay } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<ISettlement["status"], string> = {
  PENDING: "text-status-cooking",
  CARRIED_FORWARD: "text-muted-foreground",
  PAID: "text-status-done",
};

/**
 * The settlement screen.
 *
 * Payouts are v1-manual on purpose: the admin downloads a CSV, pays from their own
 * banking app, and marks the batch paid with a UTR. At 10–20 vendors a five-minute
 * nightly CSV is genuinely faster than a RazorpayX integration, which needs a
 * separate current account and its own activation. Automate at 50+.
 *
 * Three rules are visible in the table rather than hidden in the engine, because a
 * vendor will ask about all three:
 *   - COD orders contribute ₹0. They settled themselves at the gate.
 *   - A payout under ₹100 CARRIES FORWARD, so per-transfer fees do not eat it.
 *   - A negative net carries forward as an opening debit and is never clawed back.
 */
export default function SettlementsPage() {
  const [utrDrafts, setUtrDrafts] = useState<Record<string, string>>({});

  const name = (restaurantId: string) =>
    restaurants.find((restaurant) => restaurant._id === restaurantId)?.name ?? restaurantId;

  const payableTotal = addPaise(
    ...settlements
      .filter((row) => row.status === "PENDING")
      .map((row) => row.netPayoutPaise),
  );

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Settlements</h1>
          <p className="text-muted-foreground text-sm">
            Runs nightly at 23:59 campus time. Re-running a day is a no-op.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Play className="size-4" aria-hidden />
            Run now
          </Button>
          <Button size="sm">
            <Download className="size-4" aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Payable in the next batch
        </p>
        <p className="text-2xl font-bold">
          <MoneyDisplay amountPaise={payableTotal} />
        </p>
      </div>

      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-xs uppercase">
          <tr>
            <th className="py-2 text-start font-medium">Date</th>
            <th className="py-2 text-start font-medium">Vendor</th>
            <th className="py-2 text-end font-medium">Prepaid gross</th>
            <th className="py-2 text-end font-medium">Adjustments</th>
            <th className="py-2 text-end font-medium">Net payout</th>
            <th className="py-2 text-center font-medium">Orders</th>
            <th className="py-2 text-start font-medium">Status</th>
            <th className="py-2 text-start font-medium">UTR</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {settlements.map((row) => (
            <tr key={row._id}>
              <td className="py-2 font-mono text-xs">{row.settlementDate}</td>
              <td className="font-medium">{name(row.restaurantId)}</td>
              <td className="text-end">
                <MoneyDisplay amountPaise={row.grossPrepaidPaise} />
              </td>
              <td className="text-end">
                <MoneyDisplay amountPaise={row.adjustmentsPaise} signed />
              </td>
              <td className="text-end font-semibold">
                <MoneyDisplay amountPaise={row.netPayoutPaise} signed />
              </td>
              <td className="text-muted-foreground text-center text-xs">
                {row.prepaidOrderCount} prepaid
                <span className="block">{row.codOrderCount} COD · ₹0</span>
              </td>
              <td>
                <span className={cn("text-xs font-medium", STATUS_TONE[row.status])}>
                  {row.status.replace("_", " ")}
                </span>
                {row.status === "CARRIED_FORWARD" ? (
                  <span className="text-muted-foreground block text-[10px]">
                    under ₹100 — rolls into the next payout
                  </span>
                ) : null}
              </td>
              <td>
                {row.status === "PAID" ? (
                  <span className="font-mono text-xs">{row.utr}</span>
                ) : row.status === "PENDING" ? (
                  <div className="flex gap-1">
                    <Input
                      value={utrDrafts[row._id] ?? ""}
                      onChange={(event) =>
                        setUtrDrafts((current) => ({ ...current, [row._id]: event.target.value }))
                      }
                      placeholder="UTR reference"
                      aria-label={`UTR for ${name(row.restaurantId)}`}
                      className="h-8 w-36 text-xs"
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      // A payout is not marked paid without its bank reference —
                      // that reference is the only way to trace it later.
                      disabled={(utrDrafts[row._id] ?? "").trim() === ""}
                    >
                      Mark paid
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-muted-foreground text-xs">
        The settlement engine arrives in Phase 9. These rows are fixtures.
      </p>
    </main>
  );
}
