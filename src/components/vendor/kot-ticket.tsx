"use client";

import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadKotTicketImage } from "@/lib/kot-canvas";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface KotItemAddOn {
  name: string;
  pricePaise?: number;
}

export interface KotOrderItem {
  name: string;
  isVeg: boolean;
  quantity: number;
  unitPricePaise?: number;
  lineTotalPaise?: number;
  addOns: (KotItemAddOn | string)[];
}

export interface KotPricingBreakdown {
  subtotalPaise: number;
  packagingFeePaise?: number;
  deliveryFeePaise?: number;
  discountPaise?: number;
  grandTotalPaise?: number;
}

export interface KotOrder {
  orderNumber: string;
  placedAtLabel: string;
  customerName: string;
  customerPhone: string;
  restaurantName: string;
  zoneName: string;
  zoneInstructions: string;
  prepMinutes: number | null;
  /** What the delivery partner must come back with. Every order is cash. */
  cashDuePaise: number;
  gateCode: string | null;
  description?: string | null;
  items: KotOrderItem[];
  pricing?: KotPricingBreakdown | null;
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
  const [isSavingImage, setIsSavingImage] = useState(false);

  const handleSaveImage = async (): Promise<void> => {
    try {
      setIsSavingImage(true);
      await downloadKotTicketImage(order, width);
      toast.success("Ticket saved as image!");
    } catch (err) {
      console.error("Failed to save ticket image", err);
      toast.error("Could not save ticket image. You can use Print / Save PDF instead.");
    } finally {
      setIsSavingImage(false);
    }
  };

  return (
    <div className="min-h-dvh bg-ink print:min-h-0 print:bg-white print:text-black print:p-0 print:m-0">
      {/* ── Controls. Never printed. ─────────────────────────────── */}
      <div className="no-print print:hidden mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-4">
        <Link
          href="/vendor/orders"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm text-muted hover:text-bone"
        >
          <ArrowLeft className="size-4" />
          Back to the board
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-2">
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

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSaveImage()}
            disabled={isSavingImage}
            className="border-line text-bone hover:bg-surface-raised"
          >
            {isSavingImage ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            <span className="hidden sm:inline">Save Image</span>
            <span className="sm:hidden">Save</span>
          </Button>

          <Button type="button" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span>Print / Save PDF</span>
          </Button>
        </div>
      </div>

      {/* ── The ticket ───────────────────────────────────────────── */}
      <div className="mx-auto px-4 pb-10 print:p-0 print:m-0 print:w-auto">
        <div
          id="kot-ticket-paper"
          className="mx-auto bg-white p-3.5 sm:p-4 font-mono text-[13px] leading-snug text-black shadow-xl print:m-0 print:p-3 print:shadow-none print:border-none"
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

          {order.items.map((item, index) => {
            const hasLineTotal = typeof item.lineTotalPaise === "number";
            const hasUnitPrice = typeof item.unitPricePaise === "number";
            const displayTotalPaise = hasLineTotal
              ? item.lineTotalPaise
              : hasUnitPrice && typeof item.unitPricePaise === "number"
              ? item.unitPricePaise * item.quantity
              : null;

            return (
              <div key={`${item.name}-${index}`} className="mb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-1.5">
                    <span className="w-5 shrink-0 font-bold">{item.quantity}x</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold uppercase break-words leading-tight">
                        {item.name}
                        <span className="ml-1 font-normal text-[11px]">
                          [{item.isVeg ? "VEG" : "NON-VEG"}]
                        </span>
                      </p>
                      {item.quantity > 1 && typeof item.unitPricePaise === "number" ? (
                        <p className="mt-0.5 text-[11px] font-normal text-neutral-600">
                          {formatINR(item.unitPricePaise)} each
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {typeof displayTotalPaise === "number" ? (
                    <span className="shrink-0 font-bold tabular-nums text-right">
                      {formatINR(displayTotalPaise)}
                    </span>
                  ) : null}
                </div>

                {item.addOns.length > 0 ? (
                  <div className="ml-6.5 mt-0.5 space-y-0.5 text-[11px]">
                    {item.addOns.map((addOn, addOnIdx) => {
                      const isObj = typeof addOn === "object" && addOn !== null;
                      const name = isObj ? addOn.name : addOn;
                      const price =
                        isObj && typeof addOn.pricePaise === "number" && addOn.pricePaise > 0
                          ? addOn.pricePaise
                          : null;
                      return (
                        <div
                          key={addOnIdx}
                          className="flex justify-between gap-1 text-neutral-700 leading-tight"
                        >
                          <span className="break-words">+ {name}</span>
                          {price !== null ? (
                            <span className="shrink-0 tabular-nums">+{formatINR(price)}</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}

          {order.description ? (
            <div className="my-2 border border-black p-1.5">
              <p className="text-[10px] font-bold uppercase">Customer Note / Special Instructions:</p>
              <p className="text-[12px] font-bold uppercase whitespace-pre-wrap">{order.description}</p>
            </div>
          ) : null}

          {order.pricing ? (
            <>
              <Rule />
              <div className="space-y-0.5">
                <Row label="Item Total" value={formatINR(order.pricing.subtotalPaise)} />
                {order.pricing.packagingFeePaise && order.pricing.packagingFeePaise > 0 ? (
                  <Row label="Packaging Fee" value={formatINR(order.pricing.packagingFeePaise)} />
                ) : null}
                {order.pricing.deliveryFeePaise && order.pricing.deliveryFeePaise > 0 ? (
                  <Row label="Delivery Fee" value={formatINR(order.pricing.deliveryFeePaise)} />
                ) : null}
                {order.pricing.discountPaise && order.pricing.discountPaise > 0 ? (
                  <Row label="Coupon Discount" value={`-${formatINR(order.pricing.discountPaise)}`} />
                ) : null}
                {order.pricing.grandTotalPaise &&
                order.cashDuePaise < order.pricing.grandTotalPaise ? (
                  <Row
                    label="Stockout / Adjustment"
                    value={`-${formatINR(order.pricing.grandTotalPaise - order.cashDuePaise)}`}
                  />
                ) : null}
              </div>
            </>
          ) : null}

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

          <div className="border-2 border-black p-2 text-center">
            <p className="text-[11px] font-bold uppercase">Collect cash</p>
            <p className="text-2xl font-bold">{formatINR(order.cashDuePaise ?? 0)}</p>
            <p className="text-[11px]">Exact amount. No change expected.</p>
          </div>

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
          <p className="text-center text-[10px] font-bold uppercase tracking-wide">
            CAMPUS SAFETY PROTOCOL
          </p>
          <p className="mt-0.5 text-center text-[10px] leading-tight">
            Deliveries after 7:00 PM must be handled personally by the owner or co-owner to maintain security inside campus premises.
          </p>
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
      <span className={cn("text-[12px] tabular-nums", bold && "text-[14px] font-bold")}>{value}</span>
    </div>
  );
}
