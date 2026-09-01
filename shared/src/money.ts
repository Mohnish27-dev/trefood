/**
 * Paise arithmetic. The only place in TREFOOD where money is added, multiplied, or
 * rounded.
 *
 * Two rules from docs/MONEY_AND_SETTLEMENT.md §1 shape everything here:
 *
 *   1. All monetary values are integer paise. ₹202.50 is 20250. Never a float.
 *   2. All student-facing totals are whole rupees. Rounding happens once, at cart
 *      computation, never at display time.
 *
 * Lives in `shared` because the backend computes with these functions and the
 * frontend formats with them. If the two halves rounded differently, a student would
 * see a total the server never charged.
 */

declare const paiseBrand: unique symbol;

/**
 * Integer paise.
 *
 * The brand is not decoration. A plain `number` lets you write
 * `order.subtotalPaise + restaurant.packagingFee` where the second value is rupees,
 * and nothing complains. With the brand, every value must be constructed through
 * `paise()` or `rupees()`, and arithmetic must go through the helpers below — so the
 * unit is checked by the compiler rather than by whoever reviews the diff.
 */
export type Paise = number & { readonly [paiseBrand]: true };

/** Thrown when a value that must be integer paise is not. */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/**
 * Constructs a `Paise` value, rejecting anything that is not a finite integer.
 *
 * This is the choke point. A float that reaches money — from a bad JSON parse, a
 * division, or a hand-written fixture — dies here with a loud error instead of
 * surviving as ₹22.499999999999996 until it reaches a settlement report.
 */
export function paise(value: number): Paise {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`Money must be finite, received ${String(value)}`);
  }
  if (!Number.isInteger(value)) {
    throw new MoneyError(
      `Money must be integer paise, received ${value}. ` +
        `A fractional paise means a float entered the chain — find the division that produced it.`,
    );
  }
  return value as Paise;
}

/** Constructs `Paise` from whole rupees. `rupees(225)` is ₹225. */
export function rupees(value: number): Paise {
  if (!Number.isInteger(value)) {
    throw new MoneyError(
      `rupees() takes whole rupees, received ${value}. For ₹22.50 use paise(2250).`,
    );
  }
  return paise(value * 100);
}

/** Exactly ₹0. */
export const ZERO_PAISE: Paise = paise(0);

// ── Arithmetic ────────────────────────────────────────────────────────────
// These exist so that adding two Paise yields Paise. Plain `a + b` on branded
// values collapses to `number`, which is what forces money math through this module.

export function addPaise(...values: Paise[]): Paise {
  return paise(values.reduce<number>((sum, value) => sum + value, 0));
}

export function subtractPaise(minuend: Paise, subtrahend: Paise): Paise {
  return paise(minuend - subtrahend);
}

/** Multiplies by a whole count — a line total, never a rate. */
export function multiplyPaise(value: Paise, quantity: number): Paise {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError(`Quantity must be a non-negative integer, received ${quantity}`);
  }
  return paise(value * quantity);
}

export function negatePaise(value: Paise): Paise {
  return paise(-value);
}

// ── Rounding ──────────────────────────────────────────────────────────────

/**
 * Rounds UP to the next whole rupee.
 *
 * Used for the platform commission and the convenience fee. Rounding commission up
 * and giving the vendor the remainder is what guarantees
 * `commission + vendorReceivable === commissionBase` exactly, forever, with no drift
 * (docs/MONEY_AND_SETTLEMENT.md §1 rule 3).
 *
 * Whole-rupee amounts are also what makes cash work at a dark hostel gate.
 */
export function ceilToRupee(value: Paise): Paise {
  return paise(Math.ceil(value / 100) * 100);
}

/** True when the amount is a whole number of rupees — no paise remainder. */
export function isWholeRupees(value: Paise): boolean {
  return value % 100 === 0;
}

/**
 * Converts a percentage to integer basis points. 10% -> 1000. 2.36% -> 236.
 *
 * Percentages arrive as decimals from admin config, and `2.36` is not exactly
 * representable in binary — `22500 * 2.36` can land on 53100.000000000004. Converting
 * to basis points first keeps every subsequent step in integer arithmetic.
 */
export function percentToBasisPoints(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new MoneyError(`Percentage must be finite and non-negative, received ${percent}`);
  }
  const basisPoints = Math.round(percent * 100);
  if (Math.abs(percent * 100 - basisPoints) > 1e-6) {
    throw new MoneyError(
      `Percentage ${percent} has more precision than basis points allow (max 2 decimal places).`,
    );
  }
  return basisPoints;
}

/**
 * `CEIL_TO_RUPEE(base × percent)` — the shape every rate in TREFOOD is applied with.
 *
 * Both the 10% commission and the 2.36% convenience fee go through here. The whole
 * computation stays in integers until the final divide:
 *
 *   ₹225 base at 10%    -> 22500 × 1000 / 1_000_000 = 22.5   -> ceil 23 -> ₹23
 *   ₹225 base at 2.36%  -> 22500 ×  236 / 1_000_000 =  5.31  -> ceil  6 -> ₹6
 *   ₹23  base at 2.36%  ->  2300 ×  236 / 1_000_000 =  0.54  -> ceil  1 -> ₹1
 *
 * Those are exactly the three numbers in docs/MONEY_AND_SETTLEMENT.md §3 and §4.
 */
export function ceilPercentToRupee(base: Paise, percent: number): Paise {
  const basisPoints = percentToBasisPoints(percent);
  // base(paise) × bps / 10_000 gives paise; / 100 more gives rupees. Hence 1_000_000.
  return paise(Math.ceil((base * basisPoints) / 1_000_000) * 100);
}

// ── Formatting ────────────────────────────────────────────────────────────

/** Rupees as a plain number. For display and charts only — never for arithmetic. */
export function paiseToRupees(value: Paise): number {
  return value / 100;
}

/**
 * Groups an integer the Indian way: last three digits, then pairs.
 * 1234567 -> "12,34,567"
 */
function groupIndian(value: number): string {
  const digits = String(value);
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}`;
}

/**
 * Renders paise as rupees for a human. `₹231`, `₹3.18`, `₹12,34,567`.
 *
 * Whole amounts drop the decimals on purpose: almost every student-facing total in
 * TREFOOD is a whole rupee, and "₹231.00" reads like a machine wrote it. The paise
 * are shown only when they exist — which in practice means refund amounts and ledger
 * adjustments, where the exact figure matters.
 *
 * Built from integer arithmetic rather than `toFixed`, which takes a float and is
 * how a rounding bug enters a money path.
 */
export function formatINR(value: Paise, options: { showPaise?: boolean } = {}): string {
  const isNegative = value < 0;
  const absolute = Math.abs(value);
  const wholeRupees = Math.trunc(absolute / 100);
  const remainder = absolute % 100;

  const showDecimals = options.showPaise === true || remainder !== 0;
  const decimals = showDecimals ? `.${String(remainder).padStart(2, "0")}` : "";

  return `${isNegative ? "−" : ""}₹${groupIndian(wholeRupees)}${decimals}`;
}
