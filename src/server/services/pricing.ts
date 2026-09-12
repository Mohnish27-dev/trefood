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
 *
 * There is one payment method and one direction of travel: the student hands
 * `grandTotalPaise` in cash to the delivery partner at the gate, and that is
 * the only moment money moves. No gateway, no token, no convenience fee.
 */

import { assertNonNegativePaise, ceilRupeeOfBps, type Bps, type Paise } from "@/lib/money";
import type { OrderPricing } from "@/types/order";

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

export interface PricingLineInput {
  quantity: number;
  unitPricePaise: Paise;
  /** Add-on prices, per single unit of the item. */
  addOnPricesPaise: readonly Paise[];
  /**
   * The item's own packing fee, per single unit. Omitted or 0 when the vendor
   * has packing switched off for that item.
   *
   * It is NOT part of the line total: packing is billed as its own line, so it
   * lands in `packagingFeePaise` alongside the restaurant-wide fee rather than
   * hiding inside the price of the food.
   */
  packingFeePaise?: Paise | undefined;
}

export interface PricingInput {
  lines: readonly PricingLineInput[];
  /** Restaurant-wide packaging fee, charged once. In the commission base (D6). */
  packagingFeePaise: Paise;
  /** Campus flat delivery fee (D5). In the commission base (D6). */
  deliveryFeePaise: Paise;
  /**
   * Coupon value. Vendor-absorbed: it comes off the cash collected but never
   * off the commission base, so the promotion costs the vendor and not TREFOOD.
   */
  discountPaise: Paise;
  commissionBps: Bps;
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

export interface PricingResult {
  /** Everything that gets frozen onto the order document. */
  pricing: OrderPricing;
  /** Per-line totals, so the caller can build OrderItem[] without recomputing. */
  lineTotalsPaise: Paise[];
  /** Per-line packing, `packingFeePaise x quantity`. Sums into `pricing.packagingFeePaise`. */
  linePackingFeesPaise: Paise[];
  /** The per-item part of the packaging fee — the rest is the restaurant-wide one. */
  itemPackingFeePaise: Paise;
  /** What the delivery partner collects at the gate. Always the grand total. */
  cashDuePaise: Paise;
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
  const linePackingFeesPaise: Paise[] = [];
  let subtotalPaise = 0;
  let itemPackingFeePaise = 0;

  for (const line of input.lines) {
    let perUnit = line.unitPricePaise;
    for (const addOn of line.addOnPricesPaise) perUnit += addOn;
    const lineTotal = perUnit * line.quantity;
    lineTotalsPaise.push(lineTotal);
    subtotalPaise += lineTotal;

    // Packing scales with quantity for the same reason add-ons do: three
    // portions go into three containers. It stays OUT of the subtotal, so the
    // restaurant's minimum order is still measured on food alone and a packing
    // fee can never push a cart over the line on its own.
    const linePacking = (line.packingFeePaise ?? 0) * line.quantity;
    linePackingFeesPaise.push(linePacking);
    itemPackingFeePaise += linePacking;
  }

  /* --- 2. Commission base (D6) ------------------------------------ */

  // Packaging is the restaurant-wide fee plus every item's own, charged as one
  // line on the bill. Delivery fee is explicitly NOT commission-exempt.
  const packagingFeePaise = input.packagingFeePaise + itemPackingFeePaise;
  const commissionBasePaise = subtotalPaise + packagingFeePaise + input.deliveryFeePaise;

  /* --- 3. The split that never drifts (A4) ------------------------ */

  // Commission rounds UP; the vendor's share is the remainder. This is what
  // makes `commission + vendorReceivable === commissionBase` hold exactly,
  // forever, rather than approximately.
  //
  // It is computed on the PRE-DISCOUNT base, and that is precisely what makes
  // a coupon vendor-funded: the vendor collects less cash at the gate but owes
  // the same commission, so the promotion comes out of their share.
  const platformCommissionPaise = ceilRupeeOfBps(commissionBasePaise, input.commissionBps);
  const vendorReceivablePaise = commissionBasePaise - platformCommissionPaise;

  /* --- 4. What the student hands over ----------------------------- */

  // Capped at the vendor's own share. A coupon may wipe out everything the
  // vendor would have kept, but it must never leave them owing TREFOOD more
  // than they collected — that would be cooking at a loss to fund our
  // promotion. The coupon validator's 10%-of-base ceiling means this never
  // binds in practice; it is here so it cannot start binding silently.
  const discountPaise = Math.min(input.discountPaise, vendorReceivablePaise);
  const grandTotalPaise = commissionBasePaise - discountPaise;

  const pricing: OrderPricing = {
    subtotalPaise,
    packagingFeePaise,
    deliveryFeePaise: input.deliveryFeePaise,
    discountPaise,
    commissionBasePaise,
    commissionBps: input.commissionBps,
    platformCommissionPaise,
    vendorReceivablePaise,
    grandTotalPaise,
  };

  assertInvariants(pricing, { cashDuePaise: grandTotalPaise });

  return {
    pricing,
    lineTotalsPaise,
    linePackingFeesPaise,
    itemPackingFeePaise,
    cashDuePaise: grandTotalPaise,
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
    if (line.packingFeePaise !== undefined) {
      assertNonNegativePaise(line.packingFeePaise, `line ${i} packingFeePaise`);
    }
  });

  assertNonNegativePaise(input.packagingFeePaise, "packagingFeePaise");
  assertNonNegativePaise(input.deliveryFeePaise, "deliveryFeePaise");
  assertNonNegativePaise(input.discountPaise, "discountPaise");

  const bps = input.commissionBps;
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10_000) {
    throw new PricingError("BAD_RATE", `commissionBps must be 0..10000 basis points, got ${bps}.`);
  }
}

/* ------------------------------------------------------------------ */
/* Invariants — MONEY_AND_SETTLEMENT.md section 7                      */
/* ------------------------------------------------------------------ */

interface InvariantContext {
  cashDuePaise: Paise;
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

  // 3. grandTotal === commissionBase - discount. Nothing is added to a bill
  //    any more: the menu price plus fees, minus the coupon, is the cash.
  const expectedGrand = p.commissionBasePaise - p.discountPaise;
  if (p.grandTotalPaise !== expectedGrand) {
    fail(3, `grandTotal ${p.grandTotalPaise} !== ${expectedGrand}`);
  }

  // 4. The cash collected at the gate IS the grand total. There is no other
  //    moment money can move, so any gap here is money nobody ever collects.
  if (ctx.cashDuePaise !== p.grandTotalPaise) {
    fail(4, `cashDue ${ctx.cashDuePaise} !== grandTotal ${p.grandTotalPaise}`);
  }

  // 5. The vendor is never underwater: the cash they collect always covers
  //    the commission they will owe us on it.
  if (p.grandTotalPaise < p.platformCommissionPaise) {
    fail(5, `grandTotal ${p.grandTotalPaise} < commission ${p.platformCommissionPaise}`);
  }

  // 6. All values are integers >= 0. No floats anywhere in the chain.
  for (const [label, value] of Object.entries(p)) {
    if (typeof value !== "number") continue;
    if (!Number.isSafeInteger(value) || value < 0) {
      fail(6, `${label} is ${value}, which is not a non-negative safe integer`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type PricingErrorCode = "EMPTY_CART" | "BAD_QUANTITY" | "BAD_RATE" | "INVARIANT_VIOLATION";

export class PricingError extends Error {
  readonly code: PricingErrorCode;

  constructor(code: PricingErrorCode, message: string) {
    super(message);
    this.name = "PricingError";
    this.code = code;
  }
}
