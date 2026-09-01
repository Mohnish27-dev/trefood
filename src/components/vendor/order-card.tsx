"use client";

import {
  AlertTriangle,
  Ban,
  Banknote,
  Check,
  ChefHat,
  Loader2,
  MapPin,
  Phone,
  Printer,
  Shield,
  TriangleAlert,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CountdownRing, CountdownText } from "@/components/shared/countdown";
import { GateCodeDisplay } from "@/components/shared/gate-code-display";
import { Money } from "@/components/shared/money";
import { VegMark } from "@/components/shared/veg-mark";
import {
  acceptOrder,
  confirmCashCollected,
  dispatchRider,
  leaveWithSecurity,
  markReady,
  raiseStockoutForOrder,
  rejectOrder,
  reportNoShow,
  rerouteToFallbackGate,
  riderAtGate,
} from "@/server/actions/vendor";
import { DEFAULTS, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { VendorBoardOrder } from "@/server/services/vendor";

/**
 * One order on the live board.
 *
 * The card is deliberately loud at the top of the funnel and quiet at the
 * bottom: a new order flashes chili and counts down, while an order already at
 * the gate is a calm row waiting on the student. The single most important
 * control in the whole product — "Rider at gate" — gets the largest button on
 * the screen, because that one tap is what reveals the code, sends the push
 * and starts the grace timer.
 */
export function VendorOrderCard({
  order,
  onChanged,
}: {
  order: VendorBoardOrder;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const isNew = order.status === ORDER_STATUS.PLACED;
  const isCod = order.method === PAYMENT_METHOD.HYBRID_COD;

  const run = async (fn: () => Promise<{ status: string; message?: string }>): Promise<void> => {
    setBusy(true);
    const result = await fn();
    if (result.status === "error") toast.error(result.message ?? "That did not work");
    else if (result.message) toast.success(result.message);
    setBusy(false);
    onChanged();
  };

  return (
    <Card
      className={cn(
        "flex flex-col",
        // F4 defence one of three: the card itself is impossible to ignore.
        isNew && "alarm-card border-chili animate-alarm-flash",
        order.needsAtGateNag && "border-amber",
      )}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 border-b border-line p-3.5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] tracking-wider text-faint">{order.orderNumber}</p>
          <p className="mt-0.5 truncate font-display text-sm font-semibold text-bone">
            {order.customerName}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <MapPin className="size-3 shrink-0 text-faint" />
            <span className="truncate">{order.zoneName}</span>
          </p>
        </div>

        {isNew && order.ackDeadline ? (
          <CountdownRing
            deadline={new Date(order.ackDeadline)}
            totalSeconds={order.ackWindowSeconds}
            label="Accept within"
          />
        ) : (
          <Badge tone={isCod ? "warning" : "neutral"}>{isCod ? "Cash" : "Prepaid"}</Badge>
        )}
      </div>

      {/* ── Items ────────────────────────────────────────────────── */}
      <ul className="divide-y divide-line px-3.5">
        {order.items.map((item) => (
          <li key={item.itemId} className="flex items-start gap-2.5 py-2.5">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-raised text-xs font-bold tabular text-bone">
              {item.quantity}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "flex items-center gap-1.5 text-sm text-bone",
                  !item.isAvailable && "text-faint line-through",
                )}
              >
                <VegMark isVeg={item.isVeg} />
                <span className="truncate">{item.name}</span>
              </p>
              {item.addOns.length > 0 ? (
                <p className="mt-0.5 text-xs text-muted">+ {item.addOns.join(", ")}</p>
              ) : null}
            </div>

            {/* One tap to 86 a line mid-cook. Only while the kitchen still has
                the order — after READY the packet is already closed. */}
            {(order.status === ORDER_STATUS.ACCEPTED ||
              order.status === ORDER_STATUS.PREPARING) &&
            order.stockout === null ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    raiseStockoutForOrder({ orderId: order.orderId, itemId: item.itemId }),
                  )
                }
                className="shrink-0 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-muted hover:border-chili/40 hover:text-chili"
                title="Tell the student this ran out"
              >
                86
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {/* ── F6 — waiting on the student ──────────────────────────── */}
      {order.stockout ? (
        <div className="mx-3.5 mb-3 flex items-start gap-2 rounded-xl border border-amber/30 bg-amber-wash p-3 text-xs text-amber">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">{order.stockout.itemName} ran out</p>
            <p className="mt-0.5 leading-relaxed">
              The student is choosing what to do.{" "}
              <CountdownText
                deadline={new Date(order.stockout.expiresAt)}
                expiredLabel="deciding for them now"
              />{" "}
              left, then we remove the item and keep the rest of the order.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Money ────────────────────────────────────────────────── */}
      <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-line px-3.5 py-2.5 text-xs">
        <span className="text-muted">
          {isCod ? "Collect at the gate" : "Your share"}
        </span>
        <Money
          paise={isCod ? order.cashDueOnDeliveryPaise : order.vendorReceivablePaise}
          className="text-sm font-semibold text-bone"
        />
      </div>

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div className="border-t border-line p-3">
        {isNew ? (
          <div className="flex gap-2">
            <AcceptDialog orderId={order.orderId} busy={busy} onDone={onChanged} />
            <RejectDialog orderId={order.orderId} busy={busy} onDone={onChanged} />
          </div>
        ) : null}

        {order.status === ORDER_STATUS.ACCEPTED || order.status === ORDER_STATUS.PREPARING ? (
          <div className="space-y-2">
            <Button
              block
              size="lg"
              disabled={busy}
              onClick={() => void run(() => markReady({ orderId: order.orderId }))}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ChefHat />}
              Mark packed
            </Button>
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span>
                {order.prepMinutes} min promised
                {order.acceptedAt ? (
                  <>
                    {" · "}
                    <CountdownText
                      deadline={
                        new Date(
                          new Date(order.acceptedAt).getTime() + (order.prepMinutes ?? 0) * 60_000,
                        )
                      }
                      expiredLabel="over"
                    />
                  </>
                ) : null}
              </span>
              <Link
                href={`/vendor/orders/${order.orderId}/kot`}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:text-bone"
              >
                <Printer className="size-3.5" />
                KOT
              </Link>
            </div>
          </div>
        ) : null}

        {order.status === ORDER_STATUS.READY && order.gateCode ? (
          <div className="space-y-3">
            {/* The write-it-down moment. The student cannot see this yet. */}
            <GateCodeDisplay
              code={order.gateCode}
              size="board"
              label="Write this on the packet"
            />
            <Button
              block
              size="lg"
              disabled={busy}
              onClick={() => void run(() => dispatchRider({ orderId: order.orderId }))}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Truck />}
              Rider has left
            </Button>
          </div>
        ) : null}

        {order.status === ORDER_STATUS.OUT_FOR_DELIVERY ? (
          <div className="space-y-2">
            {/* F18 — the tap they forgot. */}
            {order.needsAtGateNag ? (
              <p className="flex items-start gap-2 rounded-lg border border-amber/30 bg-amber-wash px-2.5 py-2 text-xs leading-relaxed text-amber">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  This has been out for a while. The student cannot see their code until you
                  tap below.
                </span>
              </p>
            ) : null}

            <Button
              block
              size="hero"
              disabled={busy}
              onClick={() => void run(() => riderAtGate({ orderId: order.orderId }))}
            >
              {busy ? <Loader2 className="animate-spin" /> : <MapPin />}
              Rider at gate
            </Button>

            <div className="flex items-center justify-between gap-2">
              <a
                href={`tel:${order.customerPhone}`}
                className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs text-muted hover:text-bone"
              >
                <Phone className="size-3.5" />
                Call student
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => rerouteToFallbackGate({ orderId: order.orderId }))}
                className="min-h-11 px-2 text-xs text-muted hover:text-amber"
              >
                Gate is shut — reroute
              </button>
            </div>
          </div>
        ) : null}

        {order.status === ORDER_STATUS.AT_GATE ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
              <span className="text-xs text-muted">Waiting on the student</span>
              {order.gateDeadline ? (
                <CountdownText
                  deadline={new Date(order.gateDeadline)}
                  className="text-sm font-semibold text-bone"
                  expiredLabel="grace over"
                />
              ) : null}
            </div>

            {isCod ? (
              <>
                <Button
                  block
                  variant="success"
                  disabled={busy}
                  onClick={() => void run(() => confirmCashCollected({ orderId: order.orderId }))}
                >
                  <Banknote />
                  Cash collected — <Money paise={order.cashDueOnDeliveryPaise} />
                </Button>
                <div className="flex gap-2">
                  <Button
                    block
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(() => reportNoShow({ orderId: order.orderId, refused: false }))
                    }
                  >
                    <Ban />
                    No-show
                  </Button>
                  <Button
                    block
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(() => reportNoShow({ orderId: order.orderId, refused: true }))
                    }
                  >
                    <Ban />
                    Refused to pay
                  </Button>
                </div>
              </>
            ) : (
              <Button
                block
                variant="secondary"
                disabled={busy}
                onClick={() => void run(() => leaveWithSecurity({ orderId: order.orderId }))}
              >
                <Shield />
                Left with gate security
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Accept — the prep time is the student's whole ETA
   ══════════════════════════════════════════════════════════════════════ */

function AcceptDialog({
  orderId,
  busy,
  onDone,
}: {
  orderId: string;
  busy: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const accept = async (prepMinutes: number): Promise<void> => {
    setSubmitting(true);
    const result = await acceptOrder({ orderId, prepMinutes });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message ?? "Accepted");
    setOpen(false);
    onDone();
  };

  const customMinutes = Number.parseInt(custom, 10);
  const customValid =
    Number.isInteger(customMinutes) &&
    customMinutes >= DEFAULTS.prepMinutesMin &&
    customMinutes <= DEFAULTS.prepMinutesMax;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block size="lg" disabled={busy}>
          <Check />
          Accept
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>How long will this take?</DialogTitle>
          <DialogDescription>
            The student sees this as their arrival time — prep time plus the ride to the gate.
            Be honest rather than optimistic; it is the only estimate they get.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {DEFAULTS.prepMinutesPresets.map((minutes) => (
              <Button
                key={minutes}
                size="hero"
                variant="secondary"
                disabled={submitting}
                onClick={() => void accept(minutes)}
              >
                {minutes} min
              </Button>
            ))}
          </div>

          <div>
            <Label htmlFor={`prep-${orderId}`}>Or something else</Label>
            <div className="flex gap-2">
              <Input
                id={`prep-${orderId}`}
                type="number"
                inputMode="numeric"
                min={DEFAULTS.prepMinutesMin}
                max={DEFAULTS.prepMinutesMax}
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                placeholder={`${DEFAULTS.prepMinutesMin}–${DEFAULTS.prepMinutesMax}`}
              />
              <Button
                disabled={!customValid || submitting}
                onClick={() => void accept(customMinutes)}
              >
                {submitting ? <Loader2 className="animate-spin" /> : null}
                Accept
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Reject — F5. A written reason is mandatory; the student reads it.
   ══════════════════════════════════════════════════════════════════════ */

const REJECT_REASONS = [
  "Kitchen is closing",
  "Too many orders right now",
  "Out of ingredients",
  "Power cut",
];

function RejectDialog({
  orderId,
  busy,
  onDone,
}: {
  orderId: string;
  busy: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    const result = await rejectOrder({ orderId, reason });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message ?? "Rejected");
    setOpen(false);
    setReason("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block size="lg" variant="secondary" disabled={busy}>
          Reject
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why can you not take this order?</DialogTitle>
          <DialogDescription>
            The student sees this sentence, and the refund goes out immediately. The gateway
            fee on the refund is deducted from your next payout, so rejecting is not free.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {REJECT_REASONS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className={cn(
                  "min-h-11 rounded-xl border px-3 text-sm transition-colors",
                  reason === preset
                    ? "border-saffron bg-saffron-wash text-saffron"
                    : "border-line text-muted hover:text-bone",
                )}
              >
                {preset}
              </button>
            ))}
          </div>

          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Or write your own reason"
            maxLength={200}
          />
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep the order
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3 || submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Reject and refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
