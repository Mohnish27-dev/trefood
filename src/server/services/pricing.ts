/**
 * ★ THE ONLY PLACE MONEY IS COMPUTED ★
 *
 * MONEY_AND_SETTLEMENT.md section 2. PROJECT_STRUCTURE.md section 3.
 *
 * A pure function: inputs in, integers out. No DB calls, no session, no
 * side effects, no `import "server-only"` — so it is trivially testable and
 * impossible to accidentally branch on user identity.
 *
 * The cart preview screen and the order-creation path MUST both call
 * `computePricing`. If pricing logic ever appears in a component, the two will
 * drift, and a student will be charged something other than what they were
 * shown. PRD Part 4.3.
 */

import {
  assertNonNegativePaise,
  ceilRupeeOfBps,
  clampToZero,
  type Bps,
  type Paise,
} from "@/lib/money";
import { PAYMENT_METHOD, type PaymentMethod } from "@/lib/constants";
import type { OrderPricing } from "@/types/order";

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

export interface PricingLineInput {
  quantity: number;
  unitPricePaise: Paise;
  /** Add-on prices, per single unit of the item. */
  addOnPricesPaise: readonly Paise[];
}

export interface PricingInput {
  lines: readonly PricingLineInput[];
  /** Restaurant's packaging fee. In the commission base (D6). */
  packagingFeePaise: Paise;
  /** Campus flat delivery fee (D5). In the commission base (D6). */
  deliveryFeePaise: Paise;
  /** Coupon value. Platform-funded (A1), so it is subtracted AFTER the base is fixed. */
  discountPaise: Paise;
  commissionBps: Bps;
  gatewayFeeBps: Bps;
  /** A7 — ships at zero. */
  codHandlingFeePaise: Paise;
  method: PaymentMethod;
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

export interface PricingResult {
  /** Everything that gets frozen onto the order document. */
  pricing: OrderPricing;
  /** Per-line totals, so the caller can build OrderItem[] without recomputing. */
  lineTotalsPaise: Paise[];
  /** What the gateway must charge right now. */
  onlinePaidPaise: Paise;
  /** What the rider collects at the gate. Exactly vendorReceivable for COD, 0 for prepaid. */
  cashDueOnDeliveryPaise: Paise;
  /** A7's lever, surfaced so a statement can show it as its own line. */
  codHandlingFeePaise: Paise;
}

/* ------------------------------------------------------------------ */
/* The function                                                        */
/* ------------------------------------------------------------------ */

export function computePricing(input: PricingInput): PricingResult {
  validate(input);

  /* --- 1. Subtotal ------------------------------------------------ */

  // Add-ons are priced PER UNIT, so two rolls with extra cheese are charged
  // for cheese twice. MONEY section 2 writes this as
  //   SUM(item.unitPrice x qty + SUM(addOns.price))
  // which reads as charging add-ons once regardless of quantity. That is
  // almost certainly shorthand rather than intent — a kitchen adding cheese to
  // both rolls has paid for both — and `OrderItem.lineTotalPaise` in ARCH
  // section 7 implies a per-line total that scales. Resolved as
  //   (unitPrice + sum(addOns)) x qty
  const lineTotalsPaise: Paise[] = [];
  let subtotalPaise = 0;

  for (const line of input.lines) {
    let perUnit = line.unitPricePaise;
    for (const addOn of line.addOnPricesPaise) perUnit += addOn;
    const lineTotal = perUnit * line.quantity;
    lineTotalsPaise.push(lineTotal);
    subtotalPaise += lineTotal;
  }

  /* --- 2. Commission base (D6) ------------------------------------ */

  // Delivery fee is explicitly NOT commission-exempt.
  const commissionBasePaise = subtotalPaise + input.packagingFeePaise + input.deliveryFeePaise;

  /* --- 3. The split that never drifts (A4) ------------------------ */

  // Commission rounds UP; the vendor receivable is the remainder. This is
  // what makes `commission + vendorReceivable === commissionBase` hold
  // exactly, forever, rather than approximately.
  const platformCommissionPaise = ceilRupeeOfBps(commissionBasePaise, input.commissionBps);
  const vendorReceivablePaise = commissionBasePaise - platformCommissionPaise;

  /* --- 4. What the student owes ----------------------------------- */

  // Coupons are platform-funded (A1): the discount comes off AFTER the base is
  // fixed, so the vendor is still paid on the full base and TREFOOD absorbs the
  // coupon out of its own commission.
  const discountPaise = Math.min(input.discountPaise, commissionBasePaise);
  const payableByStudentPaise = clampToZero(commissionBasePaise - discountPaise);

  /* --- 5. The gateway charge and its non-refundable fee ------------ */

  // The convenience fee is charged only on what actually goes through the
  // gateway. For COD that is just the token, which is why COD currently costs
  // the student less than prepaid — the known asymmetry in A7.
  const codHandlingFeePaise =
    input.method === PAYMENT_METHOD.HYBRID_COD ? input.codHandlingFeePaise : 0;

  const onlineChargeBasePaise =
    input.method === PAYMENT_METHOD.ONLINE_100
      ? payableByStudentPaise
      : platformCommissionPaise + codHandlingFeePaise;

  // D2 — never refundable, and never TREFOOD's money. Pass-through to the gateway.
  const convenienceFeePaise = ceilRupeeOfBps(onlineChargeBasePaise, input.gatewayFeeBps);

  const onlinePaidPaise = onlineChargeBasePaise + convenienceFeePaise;

  /* --- 6. The COD invariant (PRD Part 4.12) ----------------------- */

  // codOnlineToken === platformCommission  AND
  // cashDueOnDelivery === vendorReceivable
  //
  // Because the token IS the commission and the cash IS the receivable, a COD
  // order requires zero settlement: TREFOOD already holds exactly what it is
  // owed and the vendor already holds exactly what they are owed. There is no
  // debt in either direction. Do not let a future feature break this.
  const cashDueOnDeliveryPaise =
    input.method === PAYMENT_METHOD.HYBRID_COD ? vendorReceivablePaise : 0;

  const grandTotalPaise = payableByStudentPaise + convenienceFeePaise + codHandlingFeePaise;

  /* --- 7. Refundable amount (D2) ---------------------------------- */

  // MONEY section 7 invariant 4 states `refundableAmount = grandTotal - convenienceFee`,
  // while MONEY section 5 states that a COD refund is limited to the token
  // actually paid online (Example B: 24 paid, 1 convenience, so 23 refundable).
  // Those disagree for COD — grandTotal there is 226, and there is no cash to
  // return because none was ever collected.
  //
  // Resolved as `onlinePaid - convenienceFee`, which satisfies BOTH: for
  // ONLINE_100 onlinePaid IS grandTotal, so invariant 4 holds unchanged; for
  // HYBRID_COD it yields exactly the section 5 figure.
  const refundableAmountPaise = onlinePaidPaise - convenienceFeePaise;

  const pricing: OrderPricing = {
    subtotalPaise,
    packagingFeePaise: input.packagingFeePaise,
    deliveryFeePaise: input.deliveryFeePaise,
    discountPaise,
    commissionBasePaise,
    commissionBps: input.commissionBps,
    platformCommissionPaise,
    vendorReceivablePaise,
    gatewayFeeBps: input.gatewayFeeBps,
    convenienceFeePaise,
    grandTotalPaise,
    refundableAmountPaise,
  };

  assertInvariants(pricing, {
    method: input.method,
    onlinePaidPaise,
    cashDueOnDeliveryPaise,
    codHandlingFeePaise,
  });

  return {
    pricing,
    lineTotalsPaise,
    onlinePaidPaise,
    cashDueOnDeliveryPaise,
    codHandlingFeePaise,
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validate(input: PricingInput): void {
  if (input.lines.length === 0) {
    throw new PricingError("EMPTY_CART", "A cart must contain at least one line.");
  }

  input.lines.forEach((line, i) => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new PricingError("BAD_QUANTITY", `Line ${i} has quantity ${line.quantity}.`);
    }
    assertNonNegativePaise(line.unitPricePaise, `line ${i} unitPricePaise`);
    line.addOnPricesPaise.forEach((p, j) =>
      assertNonNegativePaise(p, `line ${i} addOn ${j} pricePaise`),
    );
  });

  assertNonNegativePaise(input.packagingFeePaise, "packagingFeePaise");
  assertNonNegativePaise(input.deliveryFeePaise, "deliveryFeePaise");
  assertNonNegativePaise(input.discountPaise, "discountPaise");
  assertNonNegativePaise(input.codHandlingFeePaise, "codHandlingFeePaise");

  for (const [label, bps] of [
    ["commissionBps", input.commissionBps],
    ["gatewayFeeBps", input.gatewayFeeBps],
  ] as const) {
    if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10_000) {
      throw new PricingError("BAD_RATE", `${label} must be 0..10000 basis points, got ${bps}.`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Invariants — MONEY_AND_SETTLEMENT.md section 7                      */
/* ------------------------------------------------------------------ */

interface InvariantContext {
  method: PaymentMethod;
  onlinePaidPaise: Paise;
  cashDueOnDeliveryPaise: Paise;
  codHandlingFeePaise: Paise;
}

/**
 * Asserted on every single computation, not only in tests.
 *
 * "Silent rupee drift is how platforms lose money invisibly." The cost of
 * checking is a handful of integer comparisons; the cost of not checking is
 * discovering a systematic loss at the end of a month.
 */
export function assertInvariants(p: OrderPricing, ctx: InvariantContext): void {
  const fail = (n: number, detail: string): never => {
    throw new PricingError("INVARIANT_VIOLATION", `Money invariant ${n} violated: ${detail}`);
  };

  // 1. commissionBase === subtotal + packagingFee + deliveryFee
  const base = p.subtotalPaise + p.packagingFeePaise + p.deliveryFeePaise;
  if (p.commissionBasePaise !== base) {
    fail(1, `commissionBase ${p.commissionBasePaise} !== ${base}`);
  }

  // 2. platformCommission + vendorReceivable === commissionBase
  const split = p.platformCommissionPaise + p.vendorReceivablePaise;
  if (split !== p.commissionBasePaise) {
    fail(2, `commission + receivable ${split} !== base ${p.commissionBasePaise}`);
  }

  // 3. grandTotal === commissionBase - discount + convenienceFee
  //    (plus the A7 handling fee, which ships at zero)
  const expectedGrand =
    p.commissionBasePaise - p.discountPaise + p.convenienceFeePaise + ctx.codHandlingFeePaise;
  if (p.grandTotalPaise !== expectedGrand) {
    fail(3, `grandTotal ${p.grandTotalPaise} !== ${expectedGrand}`);
  }

  // 4. refundableAmount === onlinePaid - convenienceFee
  //    For ONLINE_100 this is identical to `grandTotal - convenienceFee`.
  if (p.refundableAmountPaise !== ctx.onlinePaidPaise - p.convenienceFeePaise) {
    fail(4, `refundable ${p.refundableAmountPaise} !== onlinePaid - convenienceFee`);
  }

  if (ctx.method === PAYMENT_METHOD.HYBRID_COD) {
    // 5. onlinePaid === platformCommission + convenienceFee
    //    cashDue    === vendorReceivable
    const expectedOnline =
      p.platformCommissionPaise + ctx.codHandlingFeePaise + p.convenienceFeePaise;
    if (ctx.onlinePaidPaise !== expectedOnline) {
      fail(5, `COD onlinePaid ${ctx.onlinePaidPaise} !== ${expectedOnline}`);
    }
    if (ctx.cashDueOnDeliveryPaise !== p.vendorReceivablePaise) {
      fail(5, `COD cashDue ${ctx.cashDueOnDeliveryPaise} !== receivable ${p.vendorReceivablePaise}`);
    }
  } else {
    // 6. onlinePaid === grandTotal, cashDue === 0
    if (ctx.onlinePaidPaise !== p.grandTotalPaise) {
      fail(6, `prepaid onlinePaid ${ctx.onlinePaidPaise} !== grandTotal ${p.grandTotalPaise}`);
    }
    if (ctx.cashDueOnDeliveryPaise !== 0) {
      fail(6, `prepaid cashDue ${ctx.cashDueOnDeliveryPaise} !== 0`);
    }
  }

  // 7. All values are integers >= 0. No floats anywhere in the chain.
  for (const [label, value] of Object.entries(p)) {
    if (typeof value !== "number") continue;
    if (!Number.isSafeInteger(value) || value < 0) {
      fail(7, `${label} is ${value}, which is not a non-negative safe integer`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type PricingErrorCode =
  | "EMPTY_CART"
  | "BAD_QUANTITY"
  | "BAD_RATE"
  | "INVARIANT_VIOLATION";

export class PricingError extends Error {
  readonly code: PricingErrorCode;

  constructor(code: PricingErrorCode, message: string) {
    super(message);
    this.name = "PricingError";
    this.code = code;
  }
}
