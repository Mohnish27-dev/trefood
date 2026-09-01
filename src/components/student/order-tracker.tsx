"use client";

import { AlertTriangle, Check, Loader2, Phone, Wallet } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountdownText } from "@/components/shared/countdown";
import { GateCodeDisplay } from "@/components/shared/gate-code-display";
import { Money, MoneyRow } from "@/components/shared/money";
import { StatusBadge, StatusStepper, statusBlurb } from "@/components/shared/status";
import { VegMark } from "@/components/shared/veg-mark";
import { ConnectionBanner } from "@/components/shared/states";
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
  const { data, connectionLost, lastSyncedAt } = usePoll<OrderPollResponse>(
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

  return (
    <>
      <ConnectionBanner visible={connectionLost} lastSyncedAt={lastSyncedAt} />

      {/* ── The gate screen takes over completely at AT_GATE ──── */}
      {order.status === ORDER_STATUS.AT_GATE && order.gateCode !== null ? (
        <GateScreen order={order} />
      ) : (
        <StatusScreen order={order} />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   The gate screen — D4's payoff
   ══════════════════════════════════════════════════════════════════════ */

function GateScreen({ order }: { order: OrderPollResponse }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (): Promise<void> => {
    if (order.gateCode === null) return;
    setSubmitting(true);
    setError(null);

    // The code is already on screen; the student is matching it against the
    // packet by eye. Sending it back proves the screen was actually looked at,
    // and the server verifies it in constant time regardless.
    const result = await confirmReceived({
      orderId: order.orderId,
      enteredCode: order.gateCode,
    });

    if (result.status === "error") {
      setError(result.message);
      setSubmitting(false);
    }
    // On success the page revalidates and the poll picks up DELIVERED.
  };

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col bg-ink-deep px-5 py-8">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-mint">
          Your order is at
        </p>
        <h1 className="mt-2 max-w-xs font-display text-2xl font-bold leading-tight text-bone">
          {order.zoneName}
        </h1>

        <div className="my-10">
          <GateCodeDisplay code={order.gateCode ?? ""} label="Match this on the packet" />
        </div>

        {order.gateDeadline ? (
          <p className="text-sm text-muted">
            <CountdownText
              deadline={new Date(order.gateDeadline)}
              className="font-semibold text-bone"
              expiredLabel="0:00"
            />{" "}
            left to collect
          </p>
        ) : null}

        {/* COD — the exact cash, in the largest type on the screen after the
            code itself. Counting change at a dark gate is how disputes start. */}
        {order.method === PAYMENT_METHOD.HYBRID_COD && order.cashDueOnDeliveryPaise > 0 ? (
          <Card className="mt-8 w-full max-w-sm border-amber/40 bg-amber-wash">
            <div className="flex items-center gap-3 p-4 text-left">
              <Wallet className="size-5 shrink-0 text-amber" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-amber">
                  Hand over in cash
                </p>
                <p className="font-display text-2xl font-bold text-bone">
                  <Money paise={order.cashDueOnDeliveryPaise} />
                </p>
              </div>
            </div>
          </Card>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 flex gap-2.5 rounded-xl border border-chili/30 bg-chili-wash px-3.5 py-3 text-sm text-chili"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="space-y-3">
        <Button
          block
          size="hero"
          variant="success"
          disabled={submitting}
          onClick={() => void confirm()}
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" />
              Closing your order…
            </>
          ) : (
            <>
              <Check />
              Confirm Received
            </>
          )}
        </Button>

        <Button asChild block variant="outline" size="lg">
          <a href={`tel:${order.restaurantPhone}`}>
            <Phone />
            Call {order.restaurantName}
          </a>
        </Button>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-faint">
        Only tap Confirm Received once the food is in your hands. Confirming early releases
        the order.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Everything before, and after, the gate
   ══════════════════════════════════════════════════════════════════════ */

function StatusScreen({ order }: { order: OrderPollResponse }) {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wider text-faint">{order.orderNumber}</p>
          <h1 className="mt-1 font-display text-xl font-semibold text-bone">
            {order.restaurantName}
          </h1>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* ── The honest ETA ────────────────────────────────────── */}
      {order.estimatedArrival && !order.isTerminal ? (
        <Card className="mb-4 border-saffron/25 bg-saffron-wash p-4">
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
            {order.zoneName} · we will alert you the moment it arrives
          </p>
        </Card>
      ) : null}

      {/* F4/F5 — a failed order explains itself and says where the money went. */}
      {isFailure(order.status) ? (
        <Card className="mb-4 border-chili/30 bg-chili-wash p-4">
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
              Refund of <Money paise={order.refundablePaise} className="font-semibold" /> is on its
              way. It takes 3–5 working days.
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* ── Stepper — what replaces a map ─────────────────────── */}
      <Card className="mb-4 p-4">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          Live Order Status
        </h2>
        <StatusStepper status={order.status} />
      </Card>

      {/* ── Items ─────────────────────────────────────────────── */}
      <Card className="mb-4">
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

      <Button asChild block variant="outline" size="lg">
        <a href={`tel:${order.restaurantPhone}`}>
          <Phone />
          Call {order.restaurantName}
        </a>
      </Button>

      {!order.isTerminal ? (
        <p className="mt-4 text-center text-xs leading-relaxed text-faint">
          Your food is delivered by the restaurant&apos;s own staff, so there is no live map.
          You will be alerted the moment it reaches your gate.
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
