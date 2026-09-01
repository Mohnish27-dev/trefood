import { ORDER_STATUSES, type OrderStatus, type PaymentMethod } from "../constants.js";
import {
  ZERO_PAISE,
  addPaise,
  ceilPercentToRupee,
  rupees,
  subtractPaise,
  type Paise,
} from "../money.js";
import type { IOrder, IOrderPricing, IOrderPayment } from "../types/index.js";
import { GANGA_BOYS_ZONE_ID, nitPatnaCampus } from "./campus.js";
import { nitCanteen } from "./restaurants.js";

/**
 * The canonical cart, chosen to reproduce the worked examples in
 * docs/MONEY_AND_SETTLEMENT.md §3 and §4 exactly:
 *
 *   Paneer Roll      ₹80
 *   Veg Fried Rice  ₹120
 *   ────────────────────
 *   Subtotal        ₹200   packaging ₹10   delivery ₹15
 *
 * Every number below is DERIVED with the money helpers, never typed by hand. That is
 * deliberate: a fixture with a hand-typed total is a second source of truth, and it
 * would drift from `pricing.ts` the moment a rate changes. Phase 8 asserts the real
 * engine reproduces these same figures.
 */
const SUBTOTAL = rupees(200);
const PACKAGING = rupees(10);
const DELIVERY = rupees(15);
const DISCOUNT = ZERO_PAISE;

const COMMISSION_PCT = nitPatnaCampus.settings.commissionPct; // 10
const GATEWAY_FEE_PCT = nitPatnaCampus.settings.gatewayFeePct; // 2.36

/** D6 — food + packaging + delivery. Delivery is not commission-exempt. */
const COMMISSION_BASE = addPaise(SUBTOTAL, PACKAGING, DELIVERY); // ₹225
/** Rounds UP. */
const PLATFORM_COMMISSION = ceilPercentToRupee(COMMISSION_BASE, COMMISSION_PCT); // ₹23
/** The remainder, so commission + receivable === base, exactly. */
const VENDOR_RECEIVABLE = subtractPaise(COMMISSION_BASE, PLATFORM_COMMISSION); // ₹202
const PAYABLE_BY_STUDENT = subtractPaise(COMMISSION_BASE, DISCOUNT); // ₹225

function buildPricing(method: PaymentMethod): IOrderPricing {
  /**
   * The convenience fee is charged on what actually moves through the gateway — the
   * whole bill when prepaid, only the 10% token when COD. That asymmetry is why COD
   * currently costs the student ₹226 against ₹231 prepaid (the known A7 asymmetry),
   * and it is what `campus.settings.codHandlingFee` exists to correct.
   */
  const onlineChargeAmount: Paise =
    method === "ONLINE_100" ? PAYABLE_BY_STUDENT : PLATFORM_COMMISSION;
  const convenienceFee = ceilPercentToRupee(onlineChargeAmount, GATEWAY_FEE_PCT);

  const onlinePaid = addPaise(onlineChargeAmount, convenienceFee);

  return {
    subtotalPaise: SUBTOTAL,
    packagingFeePaise: PACKAGING,
    deliveryFeePaise: DELIVERY,
    discountPaise: DISCOUNT,

    commissionBasePaise: COMMISSION_BASE,
    commissionPct: COMMISSION_PCT,
    platformCommissionPaise: PLATFORM_COMMISSION,
    vendorReceivablePaise: VENDOR_RECEIVABLE,

    convenienceFeePaise: convenienceFee,

    /** Total outlay: ₹231 prepaid, ₹226 COD (₹225 of value + the fee actually paid). */
    grandTotalPaise: addPaise(PAYABLE_BY_STUDENT, convenienceFee),

    /**
     * D2, read literally: what was PAID ONLINE, minus the non-refundable fee.
     * ONLINE_100 → ₹225. HYBRID_COD → ₹23, because no cash was ever collected.
     */
    refundableAmountPaise: subtractPaise(onlinePaid, convenienceFee),
  };
}

function buildPayment(method: PaymentMethod, status: OrderStatus): IOrderPayment {
  const pricing = buildPricing(method);
  const onlinePaid =
    method === "ONLINE_100"
      ? pricing.grandTotalPaise
      : addPaise(PLATFORM_COMMISSION, pricing.convenienceFeePaise);

  const isPaid = status !== "PAYMENT_PENDING" && status !== "PAYMENT_FAILED";
  const isRefunded =
    status === "REJECTED_BY_VENDOR" ||
    status === "EXPIRED_NO_ACK" ||
    status === "CANCELLED_BY_ADMIN" ||
    status === "DISPUTE_UPHELD";

  return {
    method,
    status: !isPaid
      ? status === "PAYMENT_FAILED"
        ? "FAILED"
        : "PENDING"
      : isRefunded
        ? "REFUNDED"
        : "CAPTURED",
    razorpayOrderId: "order_TESTfixture0001",
    razorpayPaymentId: isPaid ? "pay_TESTfixture0001" : undefined,
    onlinePaidPaise: isPaid ? onlinePaid : ZERO_PAISE,
    /**
     * THE COD INVARIANT: cash due === vendorReceivable, exactly. Because the token IS
     * the commission and the cash IS the receivable, a COD order needs zero
     * settlement — nobody owes anybody anything.
     */
    cashDueOnDeliveryPaise: method === "HYBRID_COD" ? VENDOR_RECEIVABLE : ZERO_PAISE,
    cashCollected: method === "HYBRID_COD" && status === "DELIVERED" ? true : undefined,
  };
}

const BASE_TIME = new Date("2026-09-01T16:30:00.000Z");
const minutesAfter = (minutes: number): string =>
  new Date(BASE_TIME.getTime() + minutes * 60_000).toISOString();

/** Which timestamps exist by the time an order reaches a given status. */
function buildTimestamps(status: OrderStatus) {
  const reached = (...statuses: OrderStatus[]): boolean => statuses.includes(status);
  const afterPlaced = !reached("PAYMENT_PENDING", "PAYMENT_FAILED");
  const afterAccepted = !reached(
    "PAYMENT_PENDING",
    "PAYMENT_FAILED",
    "PLACED",
    "REJECTED_BY_VENDOR",
    "EXPIRED_NO_ACK",
  );
  const afterReady = afterAccepted && !reached("ACCEPTED", "PREPARING", "CANCELLED_BY_ADMIN");
  const afterDispatched = afterReady && !reached("READY");
  const afterAtGate = afterDispatched && !reached("OUT_FOR_DELIVERY");
  const afterDelivered = afterAtGate && !reached("AT_GATE", "NO_SHOW");

  return {
    createdAt: minutesAfter(0),
    placedAt: afterPlaced ? minutesAfter(1) : undefined,
    acceptedAt: afterAccepted ? minutesAfter(2) : undefined,
    readyAt: afterReady ? minutesAfter(20) : undefined,
    dispatchedAt: afterDispatched ? minutesAfter(22) : undefined,
    atGateAt: afterAtGate ? minutesAfter(30) : undefined,
    deliveredAt: afterDelivered ? minutesAfter(34) : undefined,
    settledAt: status === "SETTLED" ? minutesAfter(450) : undefined,
  };
}

let orderCounter = 8900;

export function buildOrderFixture(
  status: OrderStatus,
  method: PaymentMethod = "ONLINE_100",
): IOrder {
  orderCounter += 1;

  /**
   * The gate code exists on the ORDER from READY onward — that is when the vendor
   * reveals it to write on the packet. What the STUDENT receives is a different
   * question: the API omits this field until AT_GATE. See `studentView()`.
   */
  const hasGateCode = buildTimestamps(status).readyAt !== undefined;

  return {
    _id: `order-${status.toLowerCase()}`,
    orderNumber: `TRF-NITP-${orderCounter}`,

    campusId: nitPatnaCampus._id,
    restaurantId: nitCanteen._id,
    customerId: "user-student-aditi",

    customerSnapshot: { name: "Aditi Raman", phone: "+919812345678" },
    restaurantSnapshot: { name: nitCanteen.name, phone: nitCanteen.phone },
    deliveryZoneSnapshot: {
      zoneId: GANGA_BOYS_ZONE_ID,
      name: "Ganga Boys Hostel — Main Gate",
      zoneType: "HOSTEL_BOYS",
      curfewMinutes: 22 * 60,
      instructions: "Hand over at the gate. Do not enter the hostel block.",
    },

    items: [
      {
        itemId: "item-paneer-roll",
        name: "Paneer Roll",
        isVeg: true,
        quantity: 1,
        unitPricePaise: rupees(80),
        addOns: [{ name: "Medium", pricePaise: ZERO_PAISE }],
        lineTotalPaise: rupees(80),
      },
      {
        itemId: "item-veg-fried-rice",
        name: "Veg Fried Rice",
        isVeg: true,
        quantity: 1,
        unitPricePaise: rupees(120),
        addOns: [],
        lineTotalPaise: rupees(120),
      },
    ],

    pricing: buildPricing(method),
    payment: buildPayment(method, status),

    status,
    gateCode: hasGateCode ? "4821" : undefined,
    prepMinutes: buildTimestamps(status).acceptedAt !== undefined ? 20 : undefined,
    timestamps: buildTimestamps(status),

    cancellation:
      status === "CANCELLED_BY_ADMIN"
        ? { reason: "Kitchen power cut", by: "ADMIN", at: minutesAfter(10) }
        : status === "REJECTED_BY_VENDOR"
          ? { reason: "Out of ingredients", by: "VENDOR", at: minutesAfter(2) }
          : status === "EXPIRED_NO_ACK"
            ? { reason: "Restaurant did not respond in 4 minutes", by: "SYSTEM", at: minutesAfter(5) }
            : undefined,
  };
}

/**
 * One order in every FSM state.
 *
 * This is what makes the UI phases possible: every screen has a real state to render,
 * with no backend and no database. The Phase 2 tracker is built by walking this map.
 */
export const ordersByStatus: Record<OrderStatus, IOrder> = Object.fromEntries(
  ORDER_STATUSES.map((status) => [status, buildOrderFixture(status)]),
) as Record<OrderStatus, IOrder>;

/** The same canonical order paid the other way — ₹24 online, ₹202 cash at the gate. */
export const codOrderAtGate: IOrder = buildOrderFixture("AT_GATE", "HYBRID_COD");

/**
 * Strips what the student must never receive.
 *
 * The gate code is ABSENT from the payload — not masked, not hidden with CSS — until
 * `status === AT_GATE`. That is the entire anti-fraud property of D4: a student
 * cannot pre-confirm from their room, because until the vendor taps "Rider at gate"
 * the code does not exist for them.
 */
export function studentView(order: IOrder): IOrder {
  if (order.status === "AT_GATE") return order;
  const { gateCode: _gateCode, ...rest } = order;
  return rest;
}
