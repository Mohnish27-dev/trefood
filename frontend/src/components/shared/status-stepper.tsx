import {
  ORDER_STATUS_LABELS,
  STUDENT_STEPPER_STATUSES,
  type OrderStatus,
  type StepperStatus,
} from "@trefood/shared";

import { cn } from "@/lib/utils";

/**
 * Where a status sits on the visible stepper.
 *
 * ACCEPTED collapses into PREPARING because a student cannot act on the difference —
 * both mean "the restaurant has it". Statuses that leave the happy path entirely
 * (rejected, expired, cancelled, no-show) return null: the stepper is not the right
 * shape for them, and the caller renders a terminal message instead.
 */
function stepperPositionOf(status: OrderStatus): StepperStatus | null {
  switch (status) {
    case "PLACED":
      return "PLACED";
    case "ACCEPTED":
    case "PREPARING":
      return "PREPARING";
    case "READY":
      return "READY";
    case "OUT_FOR_DELIVERY":
      return "OUT_FOR_DELIVERY";
    case "AT_GATE":
      return "AT_GATE";
    case "DELIVERED":
    case "DELIVERED_TO_SECURITY":
    case "DISPUTED":
    case "DISPUTE_UPHELD":
    case "DISPUTE_REJECTED":
    case "SETTLED":
      return "DELIVERED";
    default:
      return null;
  }
}

interface StatusStepperProps {
  status: OrderStatus;
  className?: string;
}

/**
 * The student's order progress.
 *
 * This component IS the tracking experience. There is no map, no route line, and no
 * moving dot, because riders carry no device that could emit a position (D4) — so a
 * screen promising live tracking is a screen that can never be built truthfully.
 *
 * The copy says "Live Order Status". It never says "tracking".
 */
export function StatusStepper({ status, className }: StatusStepperProps) {
  const current = stepperPositionOf(status);

  if (current === null) {
    return (
      <div
        className={cn(
          "border-status-failed/30 bg-status-failed/5 rounded-lg border px-4 py-3",
          className,
        )}
      >
        <p className="text-status-failed text-sm font-medium">
          {ORDER_STATUS_LABELS[status]}
        </p>
      </div>
    );
  }

  const currentIndex = STUDENT_STEPPER_STATUSES.indexOf(current);

  return (
    <ol className={cn("flex items-start", className)} aria-label="Order status">
      {STUDENT_STEPPER_STATUSES.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === STUDENT_STEPPER_STATUSES.length - 1;

        return (
          <li
            key={step}
            className={cn("flex flex-1 flex-col items-center gap-1.5", isLast && "flex-none")}
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors",
                  isComplete && "border-status-done bg-status-done text-background",
                  // The AT_GATE dot pulses: it is the one step that needs the student
                  // to stand up and walk somewhere.
                  isCurrent && step === "AT_GATE"
                    ? "border-status-gate bg-status-gate text-background animate-pulse"
                    : isCurrent
                      ? "border-brand bg-brand text-brand-foreground"
                      : null,
                  !isComplete && !isCurrent && "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {isComplete ? "✓" : index + 1}
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    isComplete ? "bg-status-done" : "bg-muted-foreground/20",
                  )}
                />
              ) : null}
            </div>
            <span
              className={cn(
                "text-center text-[11px] leading-tight",
                isCurrent ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {ORDER_STATUS_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
