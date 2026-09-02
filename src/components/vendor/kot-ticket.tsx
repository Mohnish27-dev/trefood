"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { PAYMENT_METHOD, type PaymentMethod } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface KotOrder {
  orderNumber: string;
  placedAtLabel: string;
  customerName: string;
  customerPhone: string;
  restaurantName: string;
  zoneName: string;
  zoneInstructions: string;
  prepMinutes: number | null;
  method: PaymentMethod;
  cashDueOnDeliveryPaise: number;
  gateCode: string | null;
  items: { name: string; isVeg: boolean; quantity: number; addOns: string[] }[];
}

/**
 * The printable ticket.
 *
 * Two widths, because both printers exist in the wild and a ticket formatted
 * for the wrong one either wastes half the roll or wraps every line. The
 * toggle sets a CSS width that the print stylesheet honours, so what you see
 * on screen is what comes out of the printer.
 *
 * Deliberately plain HTML rather than an image or a PDF: a thermal printer
 * driver renders text far more crisply than a rasterised page, and this has to
 * be legible after the roll has been sitting in a humid kitchen.
 */
export function KotTicket({ order }: { order: KotOrder }) {
  const [width, setWidth] = useState<"58" | "80">("80");
  const isCod = order.method === PAYMENT_METHOD.HYBRID_COD;

  return (
    <div className="min-h-dvh bg-ink">
      {/* ── Controls. Never printed. ─────────────────────────────── */}
      <div className="no-print mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-4">
        <Link
          href="/vendor/orders"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm text-muted hover:text-bone"
        >
          <ArrowLeft className="size-4" />
          Back to the board
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-xl border border-line p-1">
            {(["58", "80"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setWidth(option)}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-sm font-medium transition-colors",
                  width === option ? "bg-surface-raised text-bone" : "text-muted hover:text-bone",
                )}
              >
                {option} mm
              </button>
            ))}
          </div>

          <Button onClick={() => window.print()}>
            <Printer />
            Print
          </Button>
        </div>
      </div>

      {/* ── The ticket ───────────────────────────────────────────── */}
      <div className="mx-auto px-4 pb-10">
        <div
          className="mx-auto bg-white p-3 font-mono text-[13px] leading-snug text-black"
          style={{ width: width === "58" ? "58mm" : "80mm" }}
        >
          <p className="text-center text-base font-bold uppercase tracking-wide">
            {order.restaurantName}
          </p>
          <p className="text-center text-[11px]">TREFOOD kitchen ticket</p>

          <Rule />

          <Row label="Order" value={order.orderNumber} bold />
          <Row label="Time" value={order.placedAtLabel} />
          {order.prepMinutes !== null ? (
            <Row label="Prep" value={`${order.prepMinutes} min`} />
          ) : null}

          <Rule />

          {order.items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="mb-1.5">
              <div className="flex gap-2">
                <span className="w-6 shrink-0 font-bold">{item.quantity}x</span>
                <span className="flex-1 font-bold uppercase">
                  {item.name}
                  <span className="ml-1 font-normal">[{item.isVeg ? "VEG" : "NON-VEG"}]</span>
                </span>
              </div>
              {item.addOns.length > 0 ? (
                <p className="ml-8 text-[12px]">+ {item.addOns.join(", ")}</p>
              ) : null}
            </div>
          ))}

          <Rule />

          {/* The half of the ticket that is not about food. Whoever carries the
              packet reads this at the door. */}
          <p className="text-[11px] font-bold uppercase">Deliver to</p>
          <p className="text-[14px] font-bold uppercase">{order.zoneName}</p>
          <p className="mt-0.5 text-[12px]">{order.zoneInstructions}</p>
          <p className="mt-1.5 text-[12px]">
            {order.customerName} · {order.customerPhone}
          </p>

          <Rule />

          {isCod ? (
            <div className="border-2 border-black p-2 text-center">
              <p className="text-[11px] font-bold uppercase">Collect cash</p>
              <p className="text-2xl font-bold">{formatINR(order.cashDueOnDeliveryPaise)}</p>
              <p className="text-[11px]">Exact amount. No change expected.</p>
            </div>
          ) : (
            <p className="text-center text-[12px] font-bold uppercase">
              Prepaid — collect nothing
            </p>
          )}

          <Rule />

          {order.gateCode ? (
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase">Pickup OTP / Packet Code</p>
              <p className="text-4xl font-bold tracking-[0.3em]">{order.gateCode}</p>
              <p className="mt-1 text-[11px]">
                Write on packet. Student matches OTP to confirm pickup.
              </p>
            </div>
          ) : (
            <p className="text-center text-[11px]">
              Pickup OTP appears here once the order is accepted.
            </p>
          )}

          <Rule />
          <p className="text-center text-[10px]">Handover at the gate, always.</p>
        </div>
      </div>
    </div>
  );
}

function Rule() {
  return <div className="my-2 border-t border-dashed border-black" />;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[12px]">{label}</span>
      <span className={cn("text-[12px]", bold && "text-[14px] font-bold")}>{value}</span>
    </div>
  );
}
