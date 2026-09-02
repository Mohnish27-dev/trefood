/**
 * Paise-only arithmetic.
 *
 * MONEY_AND_SETTLEMENT.md section 1:
 *   "All monetary values are stored as integer paise. Never store floats."
 *
 * Nothing in this file produces a fractional number. Every exported function
 * takes integers and returns integers. Rupees exist only in formatINR(), which
 * is the render boundary and nothing else.
 *
 * Percentages are carried as BASIS POINTS (integers), never as decimal
 * percentages. 10% is 1000 bps; 2.36% is 236 bps. This is a deliberate
 * deviation from SYSTEM_ARCHITECTURE_AND_FLOWS.md section 7, which sketches
 * `commissionPct: number`. A rate stored as 2.36 is a float sitting in the
 * middle of a money path — exactly what rule 1 forbids. bpsToPct() exists for
 * display; no calculation ever consumes it.
 */

/** Integer paise. 100 paise = 1 rupee. */
export type Paise = number;

/** Integer basis points. 10000 bps = 100%. */
export type Bps = number;

export const PAISE_PER_RUPEE = 100;
export const BPS_PER_UNIT = 10_000;

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

export function isPaise(value: number): boolean {
  return Number.isSafeInteger(value);
}

/** Throws if a value ever stops being an integer. Cheap insurance on every boundary. */
export function assertPaise(value: number, label: string): Paise {
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${label} must be integer paise, received ${value}. ` +
        `A fractional value here means a float entered a money path.`,
    );
  }
  return value;
}

export function assertNonNegativePaise(value: number, label: string): Paise {
  assertPaise(value, label);
  if (value < 0) throw new Error(`${label} must be >= 0, received ${value}`);
  return value;
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

/** Rupees to paise. Accepts at most 2 decimal places; more is a caller bug. */
export function rupeesToPaise(rupees: number): Paise {
  const scaled = rupees * PAISE_PER_RUPEE;
  const truncated = Math.trunc(scaled);
  // Tolerate binary-float dust from a literal like 20.15, reject real precision.
  if (Math.abs(scaled - truncated) > 1e-6 && Math.abs(scaled - truncated - 1) > 1e-6) {
    throw new Error(`${rupees} has sub-paise precision and cannot be represented`);
  }
  return scaled - truncated > 0.5 ? truncated + 1 : truncated;
}

export function bpsToPct(bps: Bps): number {
  return bps / 100;
}

export function pctToBps(pct: number): Bps {
  const scaled = pct * 100;
  const truncated = Math.trunc(scaled);
  return scaled - truncated >= 0.5 ? truncated + 1 : truncated;
}

/* ------------------------------------------------------------------ */
/* Integer division helpers                                            */
/* ------------------------------------------------------------------ */

/** Ceiling division for non-negative integers. No floats, no Math.round. */
function ceilDiv(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new Error("denominator must be positive");
  return Math.trunc((numerator + denominator - 1) / denominator);
}

/* ------------------------------------------------------------------ */
/* The rounding rule                                                   */
/* ------------------------------------------------------------------ */

/**
 * Round UP to the next whole rupee.
 *
 * DECISIONS.md A4: all student-facing amounts are whole rupees, commission
 * rounds up, and the vendor receivable takes the remainder. That combination
 * is what guarantees `commission + vendorReceivable === commissionBase`
 * exactly, forever, with no drift — and it guarantees clean cash at a dark
 * hostel gate, where nobody is counting out fifty paise.
 */
export function ceilToRupee(paise: Paise): Paise {
  assertNonNegativePaise(paise, "ceilToRupee input");
  return ceilDiv(paise, PAISE_PER_RUPEE) * PAISE_PER_RUPEE;
}

export function floorToRupee(paise: Paise): Paise {
  assertNonNegativePaise(paise, "floorToRupee input");
  return Math.trunc(paise / PAISE_PER_RUPEE) * PAISE_PER_RUPEE;
}

/**
 * `CEIL_TO_RUPEE(base x rate)` in one exact integer step.
 *
 * This is the shape every rate in the system takes — the 10% commission
 * (MONEY section 2) and the 2.36% convenience fee (DECISIONS A3) both use it.
 * Doing it in one step avoids materialising the fractional intermediate, so
 * there is no float to round wrongly at a rupee boundary.
 *
 *   base x bps / 10000, ceiled to a rupee
 *     = ceil( base x bps / 1_000_000 ) x 100
 */
export function ceilRupeeOfBps(basePaise: Paise, bps: Bps): Paise {
  assertNonNegativePaise(basePaise, "ceilRupeeOfBps base");
  if (!Number.isSafeInteger(bps) || bps < 0) {
    throw new Error(`bps must be a non-negative integer, received ${bps}`);
  }
  return ceilDiv(basePaise * bps, BPS_PER_UNIT * PAISE_PER_RUPEE) * PAISE_PER_RUPEE;
}

/**
 * `base x bps`, ceiled to the PAISE rather than to the rupee.
 *
 * Deliberately separate from `ceilRupeeOfBps`. Everything a student or a
 * vendor sees is whole rupees (A4), and that function enforces it. This one
 * exists for the single place sub-rupee amounts are genuinely real: the
 * ledger, where D3 books the gateway fee the provider kept on a refund. That fee
 * is not a rupee figure and rounding it to one would either overcharge or
 * undercharge the vendor every single time.
 */
export function ceilPaiseOfBps(basePaise: Paise, bps: Bps): Paise {
  assertNonNegativePaise(basePaise, "ceilPaiseOfBps base");
  if (!Number.isSafeInteger(bps) || bps < 0) {
    throw new Error(`bps must be a non-negative integer, received ${bps}`);
  }
  return ceilDiv(basePaise * bps, BPS_PER_UNIT);
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export function sumPaise(values: readonly Paise[]): Paise {
  let total = 0;
  for (const v of values) total += assertPaise(v, "sumPaise element");
  return total;
}

/** Clamp to zero. A discount can never make a total negative. */
export function clampToZero(paise: Paise): Paise {
  return paise < 0 ? 0 : paise;
}

/* ------------------------------------------------------------------ */
/* Render boundary — the ONLY place rupees exist                       */
/* ------------------------------------------------------------------ */

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrExact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Paise to a display string. Whole rupees by default, because every
 * student-facing total already is one (A4). Pass `exact` for ledger rows and
 * settlement statements, where sub-rupee gateway recoveries are real.
 */
export function formatINR(paise: Paise, options: { exact?: boolean } = {}): string {
  assertPaise(paise, "formatINR input");
  const rupees = paise / PAISE_PER_RUPEE;
  const exact = options.exact === true || paise % PAISE_PER_RUPEE !== 0;
  return exact ? inrExact.format(rupees) : inrWhole.format(rupees);
}

/** Digits only, no symbol — for inputs and CSV columns. */
export function formatINRPlain(paise: Paise): string {
  assertPaise(paise, "formatINRPlain input");
  const rupees = paise / PAISE_PER_RUPEE;
  return paise % PAISE_PER_RUPEE === 0 ? String(rupees) : rupees.toString();
}
