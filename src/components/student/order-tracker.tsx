"use client";

import { AlertTriangle, Check, Loader2, Phone, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GateCodeDisplay } from "@/components/shared/gate-code-display";
import { Money, MoneyRow } from "@/components/shared/money";
import { StatusBadge, StatusStepper, statusBlurb } from "@/components/shared/status";
import { VegMark } from "@/components/shared/veg-mark";
import { ConnectionBanner } from "@/components/shared/states";
import { markInstallPromptEarned } from "@/components/shared/pwa";
import { StockoutScreen } from "./stockout-screen";
import { usePoll } from "@/hooks/use-poll";
import { confirmReceived } from "@/server/actions/student";
import { clientEnv } from "@/lib/env";
import { ORDER_STATUS, PAYMENT_METHOD, type OrderStatus } from "@/lib/constants";
import type { OrderPollResponse } from "@/app/api/orders/[orderId]/poll/route";

/**
 * Live Order Status.
 *
 * NOT "live tracking". Riders have no phones, so there is no coordinate to
 * draw and there never will be (DECISIONS section 2). What this shows instead
 * is a stepper of events that genuinely happened, an ETA derived from
 * `acceptedAt + prepMinutes + transitMinutes`, and the restaurant's phone
 * number — which is the actual escalation path when something goes wrong.
 *
 * Polls every 8 seconds, stops at a terminal state, and never caches: a stale
 * "Cooking" screen while the rider stands at the gate is worse than a spinner.
 */
export function OrderTracker({ initial }: { initial: OrderPollResponse }) {
  const { data, connectionLost, lastSyncedAt, refresh } = usePoll<OrderPollResponse>(
    async () => {
      const response = await fetch(`/api/orders/${initial.orderId}/poll`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Poll failed: ${response.status}`);
      return (await response.json()) as OrderPollResponse;
    },
    {
      intervalMs: clientEnv.NEXT_PUBLIC_POLL_STUDENT_MS,
      stopWhen: (o) => o.isTerminal,
    },
  );

  const order = data ?? initial;

  // The install prompt is earned, not offered on arrival: a student who has
  // never received an order has no reason to want an icon on their home
  // screen, and a prompt dismissed once is spent for weeks.
  useEffect(() => {
    if (
      order.status === ORDER_STATUS.DELIVERED ||
      order.status === ORDER_STATUS.DELIVERED_TO_SECURITY
    ) {
      markInstallPromptEarned();
    }
  }, [order.status]);

  // F6 — a stockout outranks everything, including the gate screen. The
  // kitchen physically cannot proceed until this is answered, so it is the one
  // place in the student app that genuinely blocks.
  const awaitingStockout = order.stockout !== null && !order.stockout.resolved;

  return (
    <>
      <ConnectionBanner visible={connectionLost} lastSyncedAt={lastSyncedAt} />

      {awaitingStockout && order.stockout ? (
        <StockoutScreen
          orderId={order.orderId}
          itemName={order.stockout.itemName}
          expiresAt={order.stockout.expiresAt}
          onResolved={refresh}
        />
      ) : (
        <StatusScreen order={order} onConfirmed={refresh} />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Unified Live Status & Confirmation Screen
   ══════════════════════════════════════════════════════════════════════ */

function StatusScreen({
  order,
  onConfirmed,
}: {
  order: OrderPollResponse;
  onConfirmed: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAccepted =
    order.status === ORDER_STATUS.ACCEPTED ||
    order.status === ORDER_STATUS.PREPARING ||
    order.status === ORDER_STATUS.READY ||
    order.status === ORDER_STATUS.OUT_FOR_DELIVERY ||
    order.status === ORDER_STATUS.AT_GATE;

  const isDelivered =
    order.status === ORDER_STATUS.DELIVERED ||
    order.status === ORDER_STATUS.DELIVERED_TO_SECURITY ||
    order.status === ORDER_STATUS.SETTLED;

  const handleConfirmPickup = async (): Promise<void> => {
    if (!order.gateCode) return;
    setSubmitting(true);
    setError(null);

    const result = await confirmReceived({
      orderId: order.orderId,
      enteredCode: order.gateCode,
    });

    if (result.status === "error") {
      setError(result.message);
      setSubmitting(false);
    } else {
      onConfirmed();
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wider text-faint">{order.orderNumber}</p>
          <h1 className="mt-1 font-display text-xl font-semibold text-bone">
            {order.restaurantName}
          </h1>
          <p className="mt-0.5 text-xs text-muted">Delivery to: {order.zoneName}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* ── Collection point changed alert ────────────────────── */}
      {order.reroutedFrom !== null && !order.isTerminal ? (
        <Card className="border-amber/40 bg-amber-wash p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber">
            <AlertTriangle className="size-4" />
            Your collection point changed
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-bone/90">
            Your original gate closed before the rider could reach it. Collect from{" "}
            <span className="font-semibold">{order.zoneName}</span> instead — {order.zoneInstructions}
          </p>
        </Card>
      ) : null}

      {/* ── Failed / Cancelled State ──────────────────────────── */}
      {isFailure(order.status) ? (
        <Card className="border-chili/30 bg-chili-wash p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-chili">
            <AlertTriangle className="size-4" />
            {order.status === ORDER_STATUS.EXPIRED_NO_ACK
              ? "The restaurant did not respond"
              : "This order could not be completed"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-bone/90">{statusBlurb(order.status)}</p>
          {order.cancellationReason ? (
            <p className="mt-2 text-xs text-muted">Reason: {order.cancellationReason}</p>
          ) : null}
          {order.refundablePaise > 0 ? (
            <p className="mt-3 text-sm text-bone">
              Refund of{" "}
              <Money
                paise={order.refund?.amountPaise ?? order.refundablePaise}
                className="font-semibold"
              />{" "}
              {order.refund?.status === "PROCESSED" ? "has been sent" : "is on its way"}. It takes
              3–5 working days to appear.
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* ── Accepted / In-Progress: Prominent OTP Display ─────── */}
      {isAccepted && order.gateCode ? (
        <Card className="border-mint/30 bg-mint-wash/10 p-5 text-center shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mint">
            Your Pickup OTP
          </p>
          <div className="my-3">
            <GateCodeDisplay code={order.gateCode} label="Share or match this OTP at pickup" />
          </div>
          <p className="text-xs leading-relaxed text-muted max-w-sm mx-auto">
            The rider will call you upon arriving at <strong className="text-bone">{order.zoneName}</strong>.
            Show or match this OTP to collect your food.
          </p>

          {/* COD Notice */}
          {order.method === PAYMENT_METHOD.HYBRID_COD && order.cashDueOnDeliveryPaise > 0 ? (
            <div className="mt-4 rounded-xl border border-amber/30 bg-amber-wash/30 p-3 text-left flex items-center gap-3">
              <Wallet className="size-5 shrink-0 text-amber" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-amber">
                  Cash to Pay at Gate
                </p>
                <p className="font-display text-lg font-bold text-bone">
                  <Money paise={order.cashDueOnDeliveryPaise} />
                </p>
              </div>
            </div>
          ) : null}

          {/* Confirm Received Action */}
          {error ? (
            <div
              role="alert"
              className="mt-4 flex gap-2.5 rounded-xl border border-chili/30 bg-chili-wash px-3.5 py-2.5 text-xs text-chili text-left"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="mt-5 space-y-2">
            <Button
              block
              size="hero"
              variant="success"
              disabled={submitting}
              onClick={() => void handleConfirmPickup()}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Confirming pickup…
                </>
              ) : (
                <>
                  <Check />
                  Confirm Order Picked Up
                </>
              )}
            </Button>
            <p className="text-[11px] text-faint">
              Tap once you have received your food packet from the rider.
            </p>
          </div>
        </Card>
      ) : null}

      {/* ── ETA Card (when available and active) ────────────────── */}
      {order.estimatedArrival && !order.isTerminal ? (
        <Card className="border-saffron/25 bg-saffron-wash p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-saffron">
            Expected at your gate
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-bone">
            {new Date(order.estimatedArrival).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="mt-1 text-xs text-muted">
            {order.zoneName} · the rider will call you when they reach
          </p>
        </Card>
      ) : null}

      {/* ── Stepper ───────────────────────────────────────────── */}
      <Card className="p-4">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          Live Order Status
        </h2>
        <StatusStepper status={order.status} />
      </Card>

      {/* ── Order Items ───────────────────────────────────────── */}
      <Card>
        <div className="divide-y divide-line">
          {order.items.map((item, i) => (
            <div key={`${item.name}-${i}`} className="flex items-start gap-3 p-3.5">
              <VegMark isVeg={item.isVeg} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-bone">
                  <span className="tabular font-medium">{item.quantity}×</span> {item.name}
                </p>
                {item.addOns.length > 0 ? (
                  <p className="mt-0.5 text-xs text-faint">{item.addOns.join(", ")}</p>
                ) : null}
              </div>
              <Money paise={item.lineTotalPaise} className="shrink-0 text-sm text-muted" />
            </div>
          ))}
        </div>

        <div className="border-t border-line p-4">
          <MoneyRow label="Paid online" paise={order.onlinePaidPaise} />
          {order.cashDueOnDeliveryPaise > 0 ? (
            <MoneyRow
              label="Cash at the gate"
              paise={order.cashDueOnDeliveryPaise}
              hint="Exact amount, please"
            />
          ) : null}
        </div>
      </Card>

      {/* ── Call Restaurant Button ────────────────────────────── */}
      <Button asChild block variant="outline" size="lg">
        <a href={`tel:${order.restaurantPhone}`}>
          <Phone />
          Call {order.restaurantName}
        </a>
      </Button>

      {/* ── Delivered / Dispute Window ────────────────────────── */}
      {order.canDispute ? (
        <Button asChild block variant="ghost" size="lg" className="mt-2">
          <Link href={`/orders/${order.orderId}/dispute`}>
            <AlertTriangle />
            Something was wrong with this order
          </Link>
        </Button>
      ) : null}

      {order.status === ORDER_STATUS.DISPUTED ? (
        <p className="rounded-xl border border-line bg-surface px-3.5 py-3 text-center text-xs leading-relaxed text-muted">
          A person is reviewing your report and the photos you sent. You will see the outcome here.
        </p>
      ) : null}

      {isDelivered ? (
        <p className="text-center text-xs text-mint font-medium">
          Order completed. Thank you!
        </p>
      ) : null}
    </div>
  );
}

function isFailure(status: OrderStatus): boolean {
  return (
    status === ORDER_STATUS.REJECTED_BY_VENDOR ||
    status === ORDER_STATUS.EXPIRED_NO_ACK ||
    status === ORDER_STATUS.CANCELLED_BY_ADMIN ||
    status === ORDER_STATUS.PAYMENT_FAILED ||
    status === ORDER_STATUS.NO_SHOW
  );
}
