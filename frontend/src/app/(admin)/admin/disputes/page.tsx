"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import {
  ORDER_STATUS_LABELS,
  disputes,
  formatINR,
  ordersByStatus,
  rupees,
  type IDispute,
} from "@trefood/shared";

import { MoneyDisplay } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * The dispute queue.
 *
 * These get a human, not an algorithm. At campus volume a person is faster, cheaper
 * and fairer than the logic automating it would need to be — and the evidence is a
 * photograph, which no rule can weigh.
 *
 * Two constraints are enforced by the UI, because both protect the vendor as much as
 * the student:
 *   - A WRITTEN REASON is mandatory before any ruling. It goes into the append-only
 *     audit log, and it is what a vendor sees when money leaves their payout.
 *   - Upholding a dispute debits the vendor's ledger. The screen says so before the
 *     button is pressed, not after.
 */
export default function DisputeQueuePage() {
  const [selected, setSelected] = useState<IDispute | null>(disputes[0] ?? null);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState("");

  const order = selected === null ? null : ordersByStatus.DELIVERED;
  const canRule = reason.trim().length >= 10;

  return (
    <main className="flex h-full">
      <div className="w-80 shrink-0 border-e">
        <h1 className="border-b px-4 py-3 font-semibold">
          Disputes
          <span className="text-muted-foreground ms-2 text-sm font-normal">
            {disputes.filter((d) => d.status === "OPEN").length} open
          </span>
        </h1>

        <ul className="divide-y">
          {disputes.map((dispute) => (
            <li key={dispute._id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(dispute);
                  setReason("");
                  setRefund("");
                }}
                className={cn(
                  "hover:bg-accent w-full px-4 py-3 text-start transition-colors",
                  selected?._id === dispute._id && "bg-accent",
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{dispute.reason}</span>
                  <span
                    className={cn(
                      "text-xs",
                      dispute.status === "OPEN"
                        ? "text-status-cooking font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {dispute.status}
                  </span>
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {dispute.note}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected === null || order === null ? (
        <p className="text-muted-foreground p-8 text-sm">Select a dispute.</p>
      ) : (
        <div className="min-w-0 flex-1 space-y-5 p-6">
          <div>
            <h2 className="font-semibold">{selected.reason}</h2>
            <p className="text-muted-foreground text-sm">{selected.note}</p>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Evidence</h3>
            <div className="flex gap-2">
              {selected.photoUrls.map((url) => (
                <div
                  key={url}
                  className="bg-muted text-muted-foreground flex size-32 flex-col items-center justify-center gap-1 rounded-md border text-[10px]"
                >
                  <ImageIcon className="size-6" aria-hidden />
                  photo
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              A photo is mandatory to raise a dispute — no photo, no dispute.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Order timeline</h3>
            <ol className="space-y-1 text-sm">
              {Object.entries(order.timestamps)
                .filter(([, value]) => value !== undefined)
                .map(([key, value]) => (
                  <li key={key} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono text-xs">
                      {new Date(String(value)).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
            </ol>
            <p className="text-muted-foreground text-xs">
              Gate code {order.gateCode ?? "—"} · {ORDER_STATUS_LABELS[order.status]} ·{" "}
              {formatINR(order.pricing.grandTotalPaise)} paid ·{" "}
              {formatINR(order.pricing.refundableAmountPaise)} refundable
            </p>
          </section>

          {selected.status !== "OPEN" ? (
            <section className="rounded-lg border p-4 text-sm">
              <h3 className="font-medium">Already ruled: {selected.status}</h3>
              <p className="text-muted-foreground mt-1 text-xs">{selected.ruling?.reason}</p>
              {selected.ruling !== undefined ? (
                <p className="mt-1">
                  Refunded <MoneyDisplay amountPaise={selected.ruling.refundAmountPaise} />
                </p>
              ) : null}
            </section>
          ) : (
            <section className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-medium">Rule on this dispute</h3>

              <div className="space-y-1">
                <Label htmlFor="ruling-reason">
                  Written reason <span className="text-status-failed">required</span>
                </Label>
                <textarea
                  id="ruling-reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="What the evidence shows, and why this ruling follows from it."
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                />
                <p className="text-muted-foreground text-xs">
                  Written into the audit log, and shown to the vendor beside the debit.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="refund-amount">Refund amount (₹)</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  inputMode="numeric"
                  value={refund}
                  onChange={(event) => setRefund(event.target.value)}
                  placeholder={String(order.pricing.refundableAmountPaise / 100)}
                  className="w-40"
                />
                <p className="text-muted-foreground text-xs">
                  Maximum{" "}
                  <MoneyDisplay amountPaise={order.pricing.refundableAmountPaise} /> — the
                  convenience fee is never refundable, and the gateway keeps it.
                </p>
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={!canRule}>
                  Reject the claim
                </Button>
                <Button disabled={!canRule || refund.trim() === ""}>
                  Uphold and refund{" "}
                  {refund.trim() === "" ? "" : formatINR(rupees(Number(refund) || 0))}
                </Button>
              </div>

              {!canRule ? (
                <p className="text-muted-foreground text-xs">
                  Write at least a sentence explaining the ruling before deciding.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Upholding debits the vendor&rsquo;s next payout by the refunded amount.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
