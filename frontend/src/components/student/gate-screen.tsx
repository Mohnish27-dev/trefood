"use client";

import { Phone } from "lucide-react";
import { formatINR, type IOrder } from "@trefood/shared";

import { GateCodeDisplay, MoneyDisplay } from "@/components/shared";
import { Countdown } from "@/components/student/countdown";
import { Button } from "@/components/ui/button";

/**
 * The gate screen — the single highest-stakes screen in TREFOOD.
 *
 * It is read outdoors, at 1 AM, at arm's length, on a cracked screen, by someone
 * walking. Everything on it is sized and ordered for that: the four-digit code
 * dominates, the cash amount is second, and the confirm button is last and large.
 *
 * The student compares the code on screen against the digits written in marker on the
 * packet, and only then taps Confirm Received. That inversion — student confirms,
 * rather than rider entering an OTP — is D4, and it is what removes the need for a
 * rider to own a working, charged, connected phone.
 */
export function GateScreen({
  order,
  graceSeconds,
  onConfirm,
}: {
  order: IOrder;
  graceSeconds: number;
  onConfirm: () => void;
}) {
  const isCod = order.payment.method === "HYBRID_COD";
  const atGateAt = order.timestamps.atGateAt;
  const deadline =
    atGateAt === undefined
      ? null
      : new Date(new Date(atGateAt).getTime() + graceSeconds * 1000);

  return (
    <div className="space-y-4">
      <div className="border-status-gate/40 bg-status-gate/5 rounded-xl border-2 p-4">
        <p className="text-status-gate text-center text-sm font-semibold">
          Your order is at {order.deliveryZoneSnapshot.name}
        </p>
        {deadline !== null ? (
          <p className="text-muted-foreground mt-1 text-center text-xs">
            Please collect within <Countdown deadline={deadline} className="tabular-nums" />
          </p>
        ) : null}
      </div>

      <GateCodeDisplay code={order.gateCode ?? "----"} />

      <p className="text-muted-foreground text-center text-sm">
        Check these digits match the ones written on your packet.
      </p>

      {isCod ? (
        /**
         * The exact cash, in large type.
         *
         * Riders carry no change, and this figure IS the vendor's receivable to the
         * rupee — which is what makes a COD order settle itself with nobody owing
         * anybody anything.
         */
        <div className="border-brand/40 bg-brand/5 rounded-xl border-2 p-4 text-center">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Hand over exactly
          </p>
          <p className="text-4xl font-extrabold tabular-nums">
            <MoneyDisplay amountPaise={order.payment.cashDueOnDeliveryPaise} />
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            The rider does not carry change.
          </p>
        </div>
      ) : null}

      <Button className="touch-target h-14 w-full text-base font-semibold" onClick={onConfirm}>
        Confirm Received
      </Button>

      <Button
        variant="outline"
        className="touch-target w-full"
        render={<a href={`tel:${order.restaurantSnapshot.phone}`} />}
      >
        <Phone className="size-4" aria-hidden />
        Call {order.restaurantSnapshot.name}
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        Only tap Confirm Received once the food is in your hands.
        {isCod
          ? " If you cannot pay the cash, tell the rider now rather than at the gate."
          : ` If you do not arrive in time, the packet is left with security at ${order.deliveryZoneSnapshot.name} and you can collect it there.`}
      </p>

      {isCod ? null : (
        <p className="sr-only">
          Prepaid order: after the grace period the packet is handed to the gate
          security desk. {formatINR(order.pricing.grandTotalPaise)} has already been paid.
        </p>
      )}
    </div>
  );
}
