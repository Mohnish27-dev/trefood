import type { Paise } from "../money.js";
import type { OrderStatus, PaymentMethod, PaymentStatus, ZoneType } from "../constants.js";
import type { Id, IsoDateTime, MinutesFromMidnight } from "./common.js";

/**
 * Snapshots.
 *
 * Every `*Snapshot` field exists so an order is a self-contained historical record.
 * Reading a six-month-old order must never depend on a restaurant, zone, or user
 * document still existing or still holding the same values. A restaurant renaming
 * itself must not rewrite last month's orders.
 */
export interface ICustomerSnapshot {
  name: string;
  phone: string;
}

export interface IRestaurantSnapshot {
  name: string;
  phone: string;
}

export interface IDeliveryZoneSnapshot {
  zoneId: string;
  name: string;
  zoneType: ZoneType;
  curfewMinutes?: MinutesFromMidnight;
  /** Printed on the KOT so the rider knows exactly where to stand. */
  instructions?: string;
}

export interface IOrderItemAddOn {
  name: string;
  pricePaise: Paise;
}

export interface IOrderItem {
  itemId: Id;
  /** Snapshotted: a menu rename must not rewrite history. */
  name: string;
  isVeg: boolean;
  quantity: number;
  unitPricePaise: Paise;
  addOns: IOrderItemAddOn[];
  lineTotalPaise: Paise;
}

/**
 * The frozen price snapshot. Every field is integer paise.
 *
 * Computed once by `backend/src/services/pricing.ts` at order creation and never
 * recomputed. A menu price change must never retroactively alter a placed order.
 */
export interface IOrderPricing {
  subtotalPaise: Paise;
  packagingFeePaise: Paise;
  deliveryFeePaise: Paise;
  discountPaise: Paise;

  /** D6 — subtotal + packaging + delivery. Delivery is NOT commission-exempt. */
  commissionBasePaise: Paise;
  /** Snapshotted in case the campus rate changes later. */
  commissionPct: number;
  /** Rounds UP. */
  platformCommissionPaise: Paise;
  /** The remainder, so commission + receivable === base exactly, forever. */
  vendorReceivablePaise: Paise;

  /**
   * NON-REFUNDABLE (D2). This is Razorpay's cut plus GST on that cut — pass-through,
   * never TREFOOD revenue. Razorpay does not return it on a refund, so TREFOOD cannot.
   */
  convenienceFeePaise: Paise;

  /** What the student is out of pocket in total, across online and cash. */
  grandTotalPaise: Paise;

  /**
   * What a vendor-fault refund returns.
   *
   * Defined as `onlinePaid − convenienceFee`, which is D2 read literally: "the amount
   * paid, minus the non-refundable convenience fee". For ONLINE_100 that equals
   * `grandTotal − convenienceFee`; for HYBRID_COD it equals the ₹23 token alone,
   * because no cash was ever collected and there is nothing else to give back.
   *
   * Stored at creation and NEVER recomputed (D2).
   */
  refundableAmountPaise: Paise;
}

export interface IOrderPayment {
  method: PaymentMethod;
  status: PaymentStatus;

  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  /** ONLINE_100: the grand total. HYBRID_COD: commission + convenience fee. */
  onlinePaidPaise: Paise;
  /**
   * HYBRID_COD: exactly `vendorReceivable`. ONLINE_100: zero.
   *
   * That equality is the invariant that makes COD self-settling: TREFOOD already
   * holds what it is owed and the vendor already holds what they are owed, so a COD
   * order requires zero settlement. Do not let a feature break it.
   */
  cashDueOnDeliveryPaise: Paise;
  /** Set at handoff, COD only. */
  cashCollected?: boolean;
}

export interface IOrderTimestamps {
  createdAt: IsoDateTime;
  placedAt?: IsoDateTime;
  acceptedAt?: IsoDateTime;
  readyAt?: IsoDateTime;
  dispatchedAt?: IsoDateTime;
  atGateAt?: IsoDateTime;
  deliveredAt?: IsoDateTime;
  settledAt?: IsoDateTime;
}

export interface IOrderCancellation {
  reason: string;
  by: "VENDOR" | "ADMIN" | "SYSTEM";
  at: IsoDateTime;
}

export interface IOrderRefund {
  razorpayRefundId: string;
  amountPaise: Paise;
  status: string;
  at: IsoDateTime;
}

export interface IOrder {
  _id: Id;
  /** "TRF-NITP-8921" — human-quotable at a gate, out loud, at 1 AM. */
  orderNumber: string;

  campusId: Id;
  restaurantId: Id;
  customerId: Id;

  customerSnapshot: ICustomerSnapshot;
  restaurantSnapshot: IRestaurantSnapshot;
  deliveryZoneSnapshot: IDeliveryZoneSnapshot;

  items: IOrderItem[];
  pricing: IOrderPricing;
  payment: IOrderPayment;

  status: OrderStatus;

  /**
   * Four digits, server-generated, unrelated to and underivable from the order number.
   *
   * Digits only by design — no letters, so there is no 0/O ambiguity in a code written
   * in marker under a hostel light.
   *
   * ON THE WIRE: the API omits this field entirely from the student's payload until
   * `status === AT_GATE`. Not masked, not hidden with CSS — ABSENT. That is the whole
   * anti-fraud property of D4: a student cannot pre-confirm from their room, because
   * until the vendor taps "Rider at gate" the code does not exist for them.
   */
  gateCode?: string;

  prepMinutes?: number;
  timestamps: IOrderTimestamps;

  cancellation?: IOrderCancellation;
  refund?: IOrderRefund;
}

/**
 * What the student's tracker actually receives.
 *
 * `gateCode` is present only at AT_GATE, and the vendor's bank details, the customer
 * id and the commission split never appear at all. Phase 9 builds the serialiser;
 * this type is the contract it must satisfy.
 */
export type StudentOrderView = Omit<IOrder, "gateCode"> & {
  gateCode?: string;
};
