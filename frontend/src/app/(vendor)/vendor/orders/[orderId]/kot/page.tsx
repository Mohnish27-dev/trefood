"use client";

import { use, useEffect, useState } from "react";
import { formatINR, type IOrder } from "@trefood/shared";

import { ErrorState, Skeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { getVendorOrder } from "@/lib/vendor-store";

/**
 * The Kitchen Order Ticket, formatted for thermal paper.
 *
 * Thermal printers are not normal printers. The paper is 58mm or 80mm wide, there is
 * no colour, no greyscale worth relying on, and a background fill wastes the ribbon-
 * less thermal coating. So: pure black on white, monospace, and every measurement in
 * millimetres rather than pixels.
 *
 * The DELIVERY ZONE AND ITS HANDOVER INSTRUCTIONS are on the ticket on purpose. The
 * rider carries no device — this printed slip is the only thing that tells them which
 * gate to walk to and what to do when they get there.
 */
const WIDTHS = [
  { id: "58mm", label: "58 mm", mm: 58 },
  { id: "80mm", label: "80 mm", mm: 80 },
] as const;

export default function KotPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<IOrder | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[1]);

  useEffect(() => {
    getVendorOrder(orderId)
      .then(setOrder)
      .catch(() => setHasFailed(true));
  }, [orderId]);

  if (hasFailed) {
    return (
      <main className="p-8">
        <ErrorState title="We could not load this ticket" />
      </main>
    );
  }

  if (order === null) {
    return (
      <main className="space-y-2 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-72" />
      </main>
    );
  }

  const isCod = order.payment.method === "HYBRID_COD";

  return (
    <>
      {/**
       * Print rules.
       *
       * `@page` sets the physical paper width and removes margins — thermal rolls have
       * no margin to give. Everything except the ticket is hidden, so the on-screen
       * controls never appear on paper.
       */}
      <style>{`
        @media print {
          @page { size: ${width.mm}mm auto; margin: 0; }
          body { margin: 0; }
          .kot-screen-only { display: none !important; }
          .kot-ticket { width: ${width.mm}mm; padding: 3mm; box-shadow: none; border: 0; }
        }
      `}</style>

      <div className="kot-screen-only flex items-center gap-3 border-b p-4">
        <span className="text-sm font-medium">Paper width</span>
        {WIDTHS.map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant={option.id === width.id ? "default" : "outline"}
            className="touch-target"
            onClick={() => setWidth(option)}
          >
            {option.label}
          </Button>
        ))}
        <Button size="sm" className="touch-target ms-auto" onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <main className="kot-screen-only-p flex justify-center p-6">
        <article
          className="kot-ticket border bg-white p-3 font-mono text-[11px] leading-tight text-black shadow-sm"
          style={{ width: `${width.mm}mm` }}
        >
          <header className="text-center">
            <p className="text-sm font-bold">{order.restaurantSnapshot.name}</p>
            <p>KITCHEN ORDER TICKET</p>
            <p className="text-lg font-bold">{order.orderNumber}</p>
          </header>

          <Rule />

          {/**
           * The zone block, boxed and given the most visual weight after the order
           * number. It is the only instruction the rider gets.
           */}
          <section className="border-2 border-black p-1.5 text-center">
            <p className="text-[10px]">DELIVER TO</p>
            <p className="text-sm font-bold uppercase">{order.deliveryZoneSnapshot.name}</p>
            {order.deliveryZoneSnapshot.instructions !== undefined ? (
              <p className="text-[10px]">{order.deliveryZoneSnapshot.instructions}</p>
            ) : null}
          </section>

          <Rule />

          <section>
            {order.items.map((item) => (
              <div key={item.itemId} className="mb-1">
                <p className="font-bold">
                  {item.quantity} x {item.name.toUpperCase()}
                  {item.isVeg ? "" : "  [NON-VEG]"}
                </p>
                {item.addOns.map((addOn) => (
                  <p key={addOn.name} className="ps-3">
                    + {addOn.name}
                  </p>
                ))}
              </div>
            ))}
          </section>

          <Rule />

          <section>
            <Row label="Items" value={formatINR(order.pricing.subtotalPaise)} />
            <Row label="Packaging" value={formatINR(order.pricing.packagingFeePaise)} />
            <Row label="Delivery" value={formatINR(order.pricing.deliveryFeePaise)} />
            <Row label="TOTAL" value={formatINR(order.pricing.grandTotalPaise)} bold />
          </section>

          <Rule />

          {/**
           * The payment block. For COD this is the single most important line on the
           * ticket: the rider must collect this exact amount, and it equals the
           * vendor's receivable to the rupee.
           */}
          <section className={isCod ? "border-2 border-black p-1.5 text-center" : "text-center"}>
            {isCod ? (
              <>
                <p className="text-[10px]">COLLECT CASH</p>
                <p className="text-xl font-bold">
                  {formatINR(order.payment.cashDueOnDeliveryPaise)}
                </p>
                <p className="text-[10px]">NO CHANGE CARRIED</p>
              </>
            ) : (
              <p className="font-bold">*** PREPAID — COLLECT NOTHING ***</p>
            )}
          </section>

          <Rule />

          <section className="text-center">
            <p className="text-[10px]">WRITE THE GATE CODE HERE</p>
            <p className="text-2xl font-bold tracking-[0.3em]">
              {order.gateCode ?? "_ _ _ _"}
            </p>
            <p className="text-[10px]">Student checks this before taking the food</p>
          </section>

          <Rule />

          <p className="text-center text-[10px]">
            {order.customerSnapshot.phone} ·{" "}
            {new Date(order.timestamps.placedAt ?? order.timestamps.createdAt).toLocaleString(
              "en-IN",
            )}
          </p>
        </article>
      </main>
    </>
  );
}

function Rule() {
  // A dashed rule prints reliably on thermal paper, where a solid fill can smear.
  return <p className="my-1.5 overflow-hidden whitespace-nowrap">{"-".repeat(64)}</p>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <p className={`flex justify-between ${bold === true ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
}
