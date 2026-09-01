import { formatINR, type Paise } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The ONLY way money reaches the screen.
 *
 * MONEY_AND_SETTLEMENT.md rule 1 says money is integer paise and rupees exist
 * only at the render boundary. This component IS that boundary. A raw number
 * in a currency position anywhere else in the codebase is a review failure.
 *
 * Tabular figures throughout, so a total does not jitter horizontally when a
 * poll updates it.
 */
export function Money({
  paise,
  exact = false,
  className,
  strike = false,
}: {
  paise: Paise;
  /** Show paise. Use on ledger rows and settlement statements, not on student totals. */
  exact?: boolean;
  className?: string;
  /** For a struck-through original price beside a discounted one. */
  strike?: boolean;
}) {
  return (
    <span
      className={cn("tabular", strike && "line-through text-faint", className)}
      // The machine-readable value, for copy-paste and for screen readers that
      // announce the currency correctly.
      data-paise={paise}
    >
      {formatINR(paise, { exact })}
    </span>
  );
}

/** A labelled row in a bill breakdown. Negative amounts render in mint, as a saving. */
export function MoneyRow({
  label,
  paise,
  hint,
  emphasis = false,
  negative = false,
}: {
  label: string;
  paise: Paise;
  hint?: string;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5", emphasis && "pt-3")}>
      <div className="min-w-0">
        <span className={cn("text-sm", emphasis ? "font-semibold text-bone" : "text-muted")}>
          {label}
        </span>
        {hint ? <p className="text-xs text-faint mt-0.5">{hint}</p> : null}
      </div>
      <span
        className={cn(
          "tabular shrink-0",
          emphasis ? "text-lg font-semibold text-bone" : "text-sm text-bone",
          negative && "text-mint",
        )}
      >
        {negative ? "-" : ""}
        <Money paise={paise} />
      </span>
    </div>
  );
}
