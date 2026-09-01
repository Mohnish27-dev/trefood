import type { Bps, Paise } from "@/lib/money";
import type {
  Actor,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ZoneType,
} from "@/lib/constants";

/* ══════════════════════════════════════════════════════════════════════
   Snapshots.

   Copied at creation, NEVER joined at read time. A restaurant renaming
   itself must not rewrite last month's orders, and reading a six-month-old
   order must never depend on a restaurant, zone or user document still
   existing or still holding the same values. ARCH section 7.
   ══════════════════════════════════════════════════════════════════════ */

export interface CustomerSnapshot {
  name: string;
  phone: string;
}

export interface RestaurantSnapshot {
  name: string;
  phone: string;
}

export interface DeliveryZoneSnapshot {
  zoneId: string;
  name: string;
  zoneType: ZoneType;
  curfewMinutes: number | null;
  instructions: string;
}

export interface OrderItemAddOn {
  name: string;
  pricePaise: Paise;
}

export interface OrderItem {
  itemId: string;
  name: string;
  isVeg: boolean;
  quantity: number;
  unitPricePaise: Paise;
  addOns: OrderItemAddOn[];
  /** (unitPrice + sum(addOns)) x quantity. Frozen at creation. */
  lineTotalPaise: Paise;
}

/* ══════════════════════════════════════════════════════════════════════
   Pricing. Every field is integer paise. MONEY_AND_SETTLEMENT.md section 2.
   ══════════════════════════════════════════════════════════════════════ */

export interface OrderPricing {
  subtotalPaise: Paise;
  packagingFeePaise: Paise;
  deliveryFeePaise: Paise;
  discountPaise: Paise;

  /** D6 — subtotal + packaging + delivery. Delivery is NOT commission-exempt. */
  commissionBasePaise: Paise;
  /** Snapshotted, in case the campus rate changes later. */
  commissionBps: Bps;
  /** CEIL to rupee. */
  platformCommissionPaise: Paise;
  /** The remainder. commission + receivable === commissionBase, exactly, forever. */
  vendorReceivablePaise: Paise;

  gatewayFeeBps: Bps;
  /** D2 — NON-REFUNDABLE. Pass-through to Razorpay; never TREFOOD's money. */
  convenienceFeePaise: Paise;

  grandTotalPaise: Paise;
  /** D2 — grandTotal minus the convenience fee. Computed once, never recomputed. */
  refundableAmountPaise: Paise;
}

export interface OrderPayment {
  method: PaymentMethod;
  status: PaymentStatus;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  /** What actually reached the gateway. */
  onlinePaidPaise: Paise;
  /** COD: exactly vendorReceivable. Prepaid: 0. The invariant that self-settles COD. */
  cashDueOnDeliveryPaise: Paise;
  cashCollected: boolean | null;
}

export interface OrderTimestamps {
  createdAt: Date;
  placedAt: Date | null;
  acceptedAt: Date | null;
  readyAt: Date | null;
  dispatchedAt: Date | null;
  atGateAt: Date | null;
  deliveredAt: Date | null;
  settledAt: Date | null;
}

export interface OrderCancellation {
  reason: string;
  by: "VENDOR" | "ADMIN" | "SYSTEM";
  at: Date;
}

export interface OrderRefund {
  razorpayRefundId: string | null;
  amountPaise: Paise;
  status: "PENDING" | "PROCESSED" | "FAILED";
  attempts: number;
  lastError: string | null;
  at: Date;
}

/** F6 — a stockout discovered mid-cook. */
export interface StockoutResolution {
  itemId: string;
  itemName: string;
  raisedAt: Date;
  expiresAt: Date;
  /** Null until the student picks, or the 5-minute timer picks for them. */
  choice: "SUBSTITUTE" | "REMOVE" | "CANCEL" | null;
  substituteItemId: string | null;
  resolvedAt: Date | null;
  /** True when the timer chose REMOVE — the least-bad default. */
  autoResolved: boolean;
}

export interface Order {
  _id: string;
  /** Human-quotable at the gate: "TRF-NITP-8921". */
  orderNumber: string;

  campusId: string;
  restaurantId: string;
  customerId: string;

  customerSnapshot: CustomerSnapshot;
  restaurantSnapshot: RestaurantSnapshot;
  deliveryZoneSnapshot: DeliveryZoneSnapshot;

  items: OrderItem[];
  pricing: OrderPricing;
  payment: OrderPayment;

  status: OrderStatus;

  /**
   * Server-generated, unrelated to the order number, and released to the
   * student ONLY at AT_GATE. Vendor sees it at READY to write on the packet.
   * ARCH section 10.4.
   */
  gateCode: string;
  prepMinutes: number | null;

  /** F12 — client-generated UUID per checkout attempt. Unique index; a double-tap returns the first order. */
  idempotencyKey: string;

  timestamps: OrderTimestamps;
  cancellation: OrderCancellation | null;
  refund: OrderRefund | null;
  stockout: StockoutResolution | null;

  /** F11 — set when a curfew forced a reroute in flight. */
  reroutedFromZoneId: string | null;

  /** Applied coupon code and identifier for audit and receipt */
  couponCode?: string | null;
  couponId?: string | null;
}

/* ══════════════════════════════════════════════════════════════════════
   Audit — append-only. Never updated, never deleted. PRD Part 4.6.
   ══════════════════════════════════════════════════════════════════════ */

export interface AuditLog {
  _id: string;
  orderId: string | null;
  entity: "ORDER" | "RESTAURANT" | "CAMPUS" | "USER" | "SETTLEMENT" | "DISPUTE";
  entityId: string;
  from: string | null;
  to: string;
  actorId: string | null;
  actorRole: Actor;
  reason: string | null;
  at: Date;
}
