"use client";

import { AlertTriangle, Phone, Truck, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { toast } from "sonner";
import { cancelPendingOrder } from "@/server/actions/student";

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
import { clientEnv } from "@/lib/env";
import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";
import type { OrderPollResponse } from "@/app/api/orders/[orderId]/poll/route";
import { OrderFeedbackCard, OrderFeedbackDialog } from "./order-feedback-form";

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
    if (order.status === ORDER_STATUS.DELIVERED) {
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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);

  const isAccepted =
    order.status === ORDER_STATUS.ACCEPTED ||
    order.status === ORDER_STATUS.PREPARING ||
    order.status === ORDER_STATUS.READY ||
    order.status === ORDER_STATUS.OUT_FOR_DELIVERY ||
    order.status === ORDER_STATUS.AT_GATE;

  const isOut =
    order.status === ORDER_STATUS.OUT_FOR_DELIVERY ||
    order.status === ORDER_STATUS.AT_GATE;

  const isDelivered =
    order.status === ORDER_STATUS.DELIVERED || order.status === ORDER_STATUS.SETTLED;

  // Prompt for feedback automatically once delivery is complete
  useEffect(() => {
    if (isDelivered && !order.feedback && !feedbackDismissed) {
      const timer = setTimeout(() => {
        setShowFeedbackModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isDelivered, order.feedback, feedbackDismissed]);

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

      {order.status === ORDER_STATUS.PENDING_CONFIRMATION && order.cancelUntil ? (
        <CancellationWindow key={`${order.orderId}:${order.serverTime}`} order={order} onChanged={onConfirmed} />
      ) : null}

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

      {/* ── On the way banner ─────────────────────────────────── */}
      {isOut ? (
        <Card className="border-saffron/40 bg-saffron-wash/20 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-saffron/15 text-saffron">
              <Truck className="size-5" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-bone">
                Your order is on the way!
              </p>
              <p className="mt-0.5 text-xs text-muted">
                The delivery rider is heading to {order.zoneName}. They will call you when they reach the gate.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ── Failed / Cancelled State ──────────────────────────── */}
      {isFailure(order.status) ? (
        <Card className="border-chili/30 bg-chili-wash p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-chili">
            <AlertTriangle className="size-4" />
            {order.status === ORDER_STATUS.CANCELLED_BY_STUDENT
              ? "Order cancelled"
              : order.status === ORDER_STATUS.EXPIRED_NO_ACK
              ? "The restaurant could not take this order"
              : "This order could not be completed"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-bone/90">{statusBlurb(order.status)}</p>
          {/* The stored reason is an operational record written for admins and
              disputes — for an auto-expiry it reads "X did not respond within 4
              minutes", which restates the blurb in a tone aimed at the vendor.
              A vendor's or admin's own reason for cancelling is genuinely new
              information, so that one still shows. */}
          {order.cancellationReason && order.status !== ORDER_STATUS.EXPIRED_NO_ACK ? (
            <p className="mt-2 text-xs text-muted">Reason: {order.cancellationReason}</p>
          ) : null}
          <p className="mt-3 text-sm text-bone">
            You have not been charged anything. Nothing is paid until the food reaches you.
          </p>
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
            {isOut ? (
              <>
                The rider is on the way to <strong className="text-bone">{order.zoneName}</strong> and will call you upon arrival. Show or match this OTP to collect your food.
              </>
            ) : (
              <>
                Your food is being prepared. Keep this OTP ready for when the rider calls at <strong className="text-bone">{order.zoneName}</strong>.
              </>
            )}
          </p>

          {/* The one number that matters at the gate. Every order is cash. */}
          {order.cashDuePaise > 0 ? (
            <div className="mt-4 rounded-xl border border-amber/30 bg-amber-wash/30 p-3 text-left flex items-center gap-3">
              <Wallet className="size-5 shrink-0 text-amber" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-amber">
                  Cash to pay at gate
                </p>
                <p className="font-display text-lg font-bold text-bone">
                  <Money paise={order.cashDuePaise} />
                </p>
              </div>
            </div>
          ) : null}
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
          {order.paymentStatus === "COLLECTED" ? (
            <MoneyRow label="Paid in cash" paise={order.cashDuePaise} emphasis />
          ) : (
            <MoneyRow
              label={isFailure(order.status) ? "Nothing to pay" : "Cash at the gate"}
              paise={isFailure(order.status) ? 0 : order.cashDuePaise}
              hint={isFailure(order.status) ? "Order closed" : "Exact amount, please"}
              emphasis
            />
          )}
        </div>
      </Card>

      {/* ── Call Restaurant Button ────────────────────────────── */}
      <Button asChild block variant="outline" size="lg">
        <a href={`tel:${order.restaurantPhone}`}>
          <Phone />
          Call {order.restaurantName}
        </a>
      </Button>

      {isDelivered ? (
        <div className="space-y-3 pt-1">
          <OrderFeedbackCard
            orderId={order.orderId}
            orderNumber={order.orderNumber}
            restaurantName={order.restaurantName}
            existingFeedback={order.feedback}
            onUpdateFeedback={onConfirmed}
          />
          <OrderFeedbackDialog
            isOpen={showFeedbackModal}
            onClose={() => {
              setShowFeedbackModal(false);
              setFeedbackDismissed(true);
            }}
            orderId={order.orderId}
            orderNumber={order.orderNumber}
            restaurantName={order.restaurantName}
            existingFeedback={order.feedback}
            onSuccess={() => {
              setShowFeedbackModal(false);
              onConfirmed();
            }}
          />
          <p className="text-center text-xs text-mint font-medium">
            Order completed. Thank you!
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CancellationWindow({ order, onChanged }: {
  order: OrderPollResponse;
  onChanged: () => void;
}) {
  const initialRemaining = Math.max(0, new Date(order.cancelUntil ?? order.serverTime).getTime() - new Date(order.serverTime).getTime());
  const [remaining, setRemaining] = useState(initialRemaining);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    const started = performance.now();
    const timer = setInterval(() => {
      const left = Math.max(0, initialRemaining - (performance.now() - started));
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        onChanged();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [initialRemaining, onChanged]);

  async function cancel(): Promise<void> {
    setCancelling(true);
    try {
      const result = await cancelPendingOrder({ orderId: order.orderId });
      if (result.status === "error") toast.error(result.message);
      else {
        setCancelled(true);
        toast.success("Order cancelled. It was not sent to the restaurant.");
      }
      onChanged();
    } catch {
      toast.error("Could not confirm cancellation. Please try again.");
      onChanged();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Card className="border-amber/40 bg-amber-wash p-4 space-y-3">
      <p className="font-semibold text-bone">
        {cancelled ? "Order cancelled" : remaining > 0 ? `Sending to the restaurant in ${Math.ceil(remaining / 1_000)} seconds` : "Sending your order to the restaurant…"}
      </p>
      <p className="text-sm text-muted">
        {cancelled ? "The restaurant never received this order." : "Changed your mind? Cancel before the countdown ends."}
      </p>
      {!cancelled ? (
        <Button block variant="outline" disabled={remaining <= 0 || cancelling} onClick={() => void cancel()}>
          {cancelling ? "Cancelling…" : "Cancel order"}
        </Button>
      ) : null}
    </Card>
  );
}

function isFailure(status: OrderStatus): boolean {
  return (
    status === ORDER_STATUS.REJECTED_BY_VENDOR ||
    status === ORDER_STATUS.EXPIRED_NO_ACK ||
    status === ORDER_STATUS.CANCELLED_BY_ADMIN ||
    status === ORDER_STATUS.CANCELLED_BY_STUDENT ||
    status === ORDER_STATUS.NO_SHOW
  );
}
