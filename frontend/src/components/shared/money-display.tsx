import { formatINR, type Paise } from "@trefood/shared";

import { cn } from "@/lib/utils";

interface MoneyDisplayProps {
  /**
   * Integer paise. Not rupees, not a float, not a string.
   *
   * The type is what makes this safe: `Paise` is branded, so passing a rupee value
   * or a raw API number is a compile error rather than a bill that is 100× wrong.
   */
  amountPaise: Paise;
  /** Force the paise to show. Refunds and ledger lines want this. */
  showPaise?: boolean;
  /** Renders a negative amount in the destructive colour — used on vendor statements. */
  signed?: boolean;
  className?: string;
}

/**
 * The only way money is rendered in TREFOOD.
 *
 * Formatting lives in `@trefood/shared` so the backend and frontend round and group
 * identically. A component that formats its own rupees is how a student ends up
 * seeing a total the server never charged.
 */
export function MoneyDisplay({
  amountPaise,
  showPaise,
  signed,
  className,
}: MoneyDisplayProps) {
  const isNegative = amountPaise < 0;

  return (
    <span
      className={cn(
        "tabular-nums",
        signed && isNegative && "text-destructive",
        className,
      )}
    >
      {formatINR(amountPaise, { showPaise: showPaise === true })}
    </span>
  );
}
