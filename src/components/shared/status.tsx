import { Check, Clock, Flame, ShoppingBag } from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS, STUDENT_STEPPER, type OrderStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Status rendering, driven entirely by the FSM enum.
 *
 * A status string cannot be typed by hand anywhere in the UI: it comes from
 * `OrderStatus`, so an unhandled state is a TypeScript error rather than a
 * blank badge in production.
 *
 * Copy discipline (DECISIONS.md section 2): riders have no phones, so there is
 * no live tracking and there never will be. Nothing here says "track".
 */

interface StatusPresentation {
  label: string;
  tone: "neutral" | "success" | "danger" | "warning" | "accent" | "info";
  /** Student-facing sentence. Plain language, never jargon. */
  studentBlurb: string;
}

const PRESENTATION: Record<OrderStatus, StatusPresentation> = {
  [ORDER_STATUS.PAYMENT_PENDING]: {
    label: "Awaiting payment",
    tone: "warning",
    studentBlurb: "Finishing your payment. This usually takes a few seconds.",
  },
  [ORDER_STATUS.PAYMENT_FAILED]: {
    label: "Payment failed",
    tone: "danger",
    studentBlurb: "The payment did not go through. Nothing was charged.",
  },
  [ORDER_STATUS.PLACED]: {
    label: "Sent to restaurant",
    tone: "info",
    studentBlurb: "Waiting for the restaurant to accept. They have 4 minutes.",
  },
  [ORDER_STATUS.ACCEPTED]: {
    label: "Accepted",
    tone: "accent",
    studentBlurb: "The restaurant accepted your order. The rider will call when at your gate.",
  },
  [ORDER_STATUS.PREPARING]: {
    label: "Preparing",
    tone: "accent",
    studentBlurb: "Your food is being prepared and will be brought to your gate.",
  },
  [ORDER_STATUS.READY]: {
    label: "Packed",
    tone: "accent",
    studentBlurb: "Packed and on the way to your gate.",
  },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: {
    label: "On the way",
    tone: "accent",
    studentBlurb: "On the way to your gate. The rider will call you upon arrival.",
  },
  [ORDER_STATUS.AT_GATE]: {
    label: "At your gate",
    tone: "success",
    studentBlurb: "Your order has arrived at the gate. Match your OTP to collect.",
  },
  [ORDER_STATUS.DELIVERED]: {
    label: "Delivered",
    tone: "success",
    studentBlurb: "Delivered. Enjoy.",
  },
  [ORDER_STATUS.DELIVERED_TO_SECURITY]: {
    label: "Left with security",
    tone: "warning",
    studentBlurb: "Nobody came to the gate, so the packet was left with the guard. Collect it there.",
  },
  [ORDER_STATUS.NO_SHOW]: {
    label: "Not collected",
    tone: "danger",
    studentBlurb: "The order was not collected and has gone back to the restaurant.",
  },
  [ORDER_STATUS.REJECTED_BY_VENDOR]: {
    label: "Rejected",
    tone: "danger",
    studentBlurb: "The restaurant could not take this order. Your refund is on its way.",
  },
  [ORDER_STATUS.EXPIRED_NO_ACK]: {
    label: "No response",
    tone: "danger",
    studentBlurb: "The restaurant did not respond in time. Your refund is on its way.",
  },
  [ORDER_STATUS.CANCELLED_BY_ADMIN]: {
    label: "Cancelled",
    tone: "danger",
    studentBlurb: "This order was cancelled by TREFOOD. Your refund is on its way.",
  },
  [ORDER_STATUS.DISPUTED]: {
    label: "Under review",
    tone: "warning",
    studentBlurb: "We are reviewing your report. You will hear back shortly.",
  },
  [ORDER_STATUS.DISPUTE_UPHELD]: {
    label: "Refund approved",
    tone: "success",
    studentBlurb: "We ruled in your favour. Your refund is on its way.",
  },
  [ORDER_STATUS.DISPUTE_REJECTED]: {
    label: "Report closed",
    tone: "neutral",
    studentBlurb: "We could not uphold this report. Contact support if you disagree.",
  },
  [ORDER_STATUS.SETTLED]: {
    label: "Delivered",
    tone: "success",
    studentBlurb: "Delivered.",
  },
};

export function statusLabel(status: OrderStatus): string {
  return PRESENTATION[status].label;
}

export function statusBlurb(status: OrderStatus): string {
  return PRESENTATION[status].studentBlurb;
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const p = PRESENTATION[status];
  return (
    <Badge tone={p.tone} className={className}>
      {p.label}
    </Badge>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   The stepper — what replaces a map.
   ══════════════════════════════════════════════════════════════════════ */

const STEP_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  placed: ShoppingBag,
  accepted: Flame,
  delivered: Check,
};

/** Which step index a status sits at. -1 when the order left the happy path. */
export function stepIndexFor(status: OrderStatus): number {
  return STUDENT_STEPPER.findIndex((s) => s.statuses.includes(status));
}

/**
 * Six steps, vertical on mobile.
 *
 * This is the entire replacement for live tracking, and it is honest: every
 * step corresponds to a real event somebody actually performed. There is no
 * interpolated progress bar pretending to know where a rider is.
 */
export function StatusStepper({ status }: { status: OrderStatus }) {
  const current = stepIndexFor(status);
  const derailed = current === -1;

  return (
    <ol className="relative" aria-label="Order progress">
      {STUDENT_STEPPER.map((step, i) => {
        const Icon = STEP_ICONS[step.key] ?? Clock;
        const done = !derailed && i < current;
        const active = !derailed && i === current;
        const isLast = i === STUDENT_STEPPER.length - 1;

        return (
          <li key={step.key} className="flex gap-3.5 pb-1" aria-current={active ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  done && "border-mint bg-mint-wash text-mint",
                  active && "border-saffron bg-saffron-wash text-saffron animate-pulse-ring",
                  !done && !active && "border-line bg-surface text-faint",
                )}
              >
                <Icon className="size-4" />
              </span>
              {!isLast ? (
                <span
                  className={cn("w-0.5 flex-1 min-h-7 my-1 rounded-full", done ? "bg-mint" : "bg-line")}
                />
              ) : null}
            </div>

            <div className={cn("pt-1.5 pb-5", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium leading-none",
                  active ? "text-bone" : done ? "text-muted" : "text-faint",
                )}
              >
                {step.label}
              </p>
              {active ? (
                <p className="mt-1.5 text-xs text-muted leading-relaxed">{statusBlurb(status)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
