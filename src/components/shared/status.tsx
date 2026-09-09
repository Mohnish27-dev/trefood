import { Check, Clock, Flame, ShoppingBag, Truck } from "lucide-react";
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
    label: "Not confirmed",
    tone: "danger",
    // Two things were wrong here. It promised a refund on an order where
    // nothing had been charged, and it made the student the audience for a
    // complaint about the vendor. The kitchen being swamped is both the honest
    // reason and the one a student can act on: order again in a few minutes.
    // The precise "did not respond within 4 minutes" wording still goes to the
    // audit log, which is where an accountability record belongs.
    studentBlurb:
      "The restaurant is busier than usual and could not confirm your order in time. Nothing has been charged — please try again in a few minutes.",
  },
  [ORDER_STATUS.CANCELLED_BY_ADMIN]: {
    label: "Cancelled",
    tone: "danger",
    studentBlurb: "This order was cancelled by TREFOOD. Your refund is on its way.",
  },
  [ORDER_STATUS.SETTLED]: {
    label: "Delivered",
    tone: "success",
    studentBlurb: "Delivered.",
  },
};

/**
 * A status the enum no longer recognises.
 *
 * The type above is exhaustive at compile time, but Mongo is the one boundary
 * the type system does not reach: a row written by an older deploy is cast to
 * `OrderStatus` on the way in and can name a state that has since been
 * removed. Reading it must degrade to a dull badge, never take the page down
 * with it — a stale order is not worth a 500 on the tracker or the radar.
 */
const UNRECOGNISED: StatusPresentation = {
  label: "Closed",
  tone: "neutral",
  studentBlurb: "This order is closed. Contact support if you need anything about it.",
};

function presentation(status: OrderStatus): StatusPresentation {
  return PRESENTATION[status] ?? UNRECOGNISED;
}

export function statusLabel(status: OrderStatus): string {
  return presentation(status).label;
}

export function statusBlurb(status: OrderStatus): string {
  return presentation(status).studentBlurb;
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const p = presentation(status);
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
  on_the_way: Truck,
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
