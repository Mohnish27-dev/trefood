import "server-only";

import * as db from "@/server/db/collections";
import {
  DEFAULTS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  VENDOR_ACTIVE_STATUSES,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/constants";
import { campusDateString, campusDayRange } from "@/lib/campus-time";
import type { Paise } from "@/lib/money";
import { revealGateCode } from "./gate-code";
import { ackDeadline, estimatedArrival, gateDeadline } from "./orders";
import { listLedgerEntries } from "./ledger";
import { listSettlements } from "./settlement";
import type { Campus } from "@/types/campus";
import type { MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { LedgerEntry, Settlement } from "@/types/finance";
import type { Order } from "@/types/order";

/**
 * Read paths for the vendor console.
 *
 * The board query runs every five seconds on a canteen tablet, so everything
 * here is shaped for that: one round trip, indexed on `restaurant_status`, and
 * a payload flat enough that the client does no derivation of its own.
 *
 * Redaction happens HERE, not in the component. The gate code leaves the
 * server only from READY onward (`revealGateCode`), so a student who opens the
 * vendor URL out of curiosity gets nothing, and a vendor cannot see a code
 * before there is a packet to write it on.
 */

/* ══════════════════════════════════════════════════════════════════════
   The live board
   ══════════════════════════════════════════════════════════════════════ */

export interface VendorBoardItem {
  itemId: string;
  name: string;
  isVeg: boolean;
  quantity: number;
  addOns: string[];
  lineTotalPaise: Paise;
  /** False once the vendor 86s it — the kitchen needs to see which line died. */
  isAvailable: boolean;
}

export interface VendorBoardOrder {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  placedAt: string | null;
  acceptedAt: string | null;

  customerName: string;
  customerPhone: string;
  zoneName: string;
  zoneInstructions: string;

  items: VendorBoardItem[];

  method: PaymentMethod;
  /** COD: what the rider must come back with. Prepaid: 0. */
  cashDueOnDeliveryPaise: Paise;
  vendorReceivablePaise: Paise;
  platformCommissionPaise: Paise;

  /** Null until READY. Enforced server-side, not by the UI. */
  gateCode: string | null;
  prepMinutes: number | null;

  /** F4 — when the acknowledgement window closes. ISO, or null once accepted. */
  ackDeadline: string | null;
  ackWindowSeconds: number;
  /** ETA at the gate, ISO. Null before acceptance. */
  estimatedArrival: string | null;
  /** A6 — the student's 15-minute grace, ISO. Null unless AT_GATE. */
  gateDeadline: string | null;

  /** F18 — 2x prep time gone and still no "Rider at gate" tap. */
  needsAtGateNag: boolean;
  /** F6 — a stockout on this order is waiting on the student. */
  stockout: { itemName: string; expiresAt: string; choice: string | null } | null;
}

export interface VendorBoard {
  restaurant: Restaurant;
  orders: VendorBoardOrder[];
  /** Server time, so a tablet with a wrong clock still counts down correctly. */
  serverTime: string;
  todayOrderCount: number;
  todayGrossPaise: Paise;
}

export async function getVendorBoard(params: {
  restaurantId: string;
  now?: Date;
}): Promise<VendorBoard | null> {
  const now = params.now ?? new Date();

  const restaurant = await (await db.restaurants()).findOne({ _id: params.restaurantId });
  if (!restaurant) return null;

  const campus = await (await db.campuses()).findOne({ _id: restaurant.campusId });
  if (!campus) return null;

  const orders = await (await db.orders())
    .find({ restaurantId: restaurant._id, status: { $in: [...VENDOR_ACTIVE_STATUSES] } })
    .sort({ "timestamps.placedAt": 1 })
    .toArray();

  // Availability is read once for the whole board rather than per card: the
  // kitchen needs to see a struck-through line on an in-flight order the
  // instant someone 86s the item on another tablet.
  const itemIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.itemId)))];
  const availability = await menuAvailability(itemIds);

  const summary = await todaySummary({ restaurant, campus, now });

  return {
    restaurant,
    serverTime: now.toISOString(),
    orders: orders.map((order) => toBoardOrder({ order, campus, availability, now })),
    ...summary,
  };
}

async function menuAvailability(itemIds: readonly string[]): Promise<Map<string, boolean>> {
  if (itemIds.length === 0) return new Map();
  const rows = await (await db.menuItems())
    .find({ _id: { $in: [...itemIds] } })
    .project<{ _id: string; isAvailable: boolean }>({ isAvailable: 1 })
    .toArray();
  return new Map(rows.map((row) => [row._id, row.isAvailable]));
}

function toBoardOrder(params: {
  order: Order;
  campus: Campus;
  availability: Map<string, boolean>;
  now: Date;
}): VendorBoardOrder {
  const { order, campus, now } = params;
  const ack = ackDeadline(order, campus);
  const arrival = estimatedArrival(order, campus.settings.transitMinutes);
  const grace = gateDeadline(order, campus);

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.timestamps.placedAt?.toISOString() ?? null,
    acceptedAt: order.timestamps.acceptedAt?.toISOString() ?? null,

    customerName: order.customerSnapshot.name,
    customerPhone: order.customerSnapshot.phone,
    zoneName: order.deliveryZoneSnapshot.name,
    zoneInstructions: order.deliveryZoneSnapshot.instructions,

    items: order.items.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      isVeg: item.isVeg,
      quantity: item.quantity,
      addOns: item.addOns.map((a) => a.name),
      lineTotalPaise: item.lineTotalPaise,
      isAvailable: params.availability.get(item.itemId) ?? true,
    })),

    method: order.payment.method,
    cashDueOnDeliveryPaise: order.payment.cashDueOnDeliveryPaise,
    vendorReceivablePaise: order.pricing.vendorReceivablePaise,
    platformCommissionPaise: order.pricing.platformCommissionPaise,

    gateCode: revealGateCode(order.gateCode, order.status, "VENDOR"),
    prepMinutes: order.prepMinutes,

    ackDeadline: ack?.toISOString() ?? null,
    ackWindowSeconds: campus.settings.vendorAutoExpireSeconds,
    estimatedArrival: arrival?.toISOString() ?? null,
    gateDeadline: grace?.toISOString() ?? null,

    needsAtGateNag: needsAtGateNag(order, now),
    stockout:
      order.stockout && order.stockout.resolvedAt === null
        ? {
            itemName: order.stockout.itemName,
            expiresAt: order.stockout.expiresAt.toISOString(),
            choice: order.stockout.choice,
          }
        : null,
  };
}

/**
 * F18 — the vendor who forgot to tap "Rider at gate".
 *
 * That single tap is what pushes the student and starts the grace timer, so an
 * order stuck in OUT_FOR_DELIVERY means a student sitting in their room while
 * food goes cold at a gate. Nag once twice the promised prep time has passed,
 * which is late enough not to cry wolf during a normal run.
 */
function needsAtGateNag(order: Order, now: Date): boolean {
  if (order.status !== ORDER_STATUS.OUT_FOR_DELIVERY && order.status !== ORDER_STATUS.READY) {
    return false;
  }
  const acceptedAt = order.timestamps.acceptedAt;
  if (!acceptedAt || order.prepMinutes === null) return false;

  const nagAt = acceptedAt.getTime() + order.prepMinutes * DEFAULTS.atGateNagMultiplier * 60_000;
  return now.getTime() > nagAt;
}

/* ══════════════════════════════════════════════════════════════════════
   Earnings
   ══════════════════════════════════════════════════════════════════════ */

export interface EarningsDay {
  date: string;
  orderCount: number;
  codOrderCount: number;
  /** What the student paid, across both methods. */
  grossPaise: Paise;
  commissionPaise: Paise;
  /** The vendor's share: bank transfer for prepaid, cash in hand for COD. */
  receivablePaise: Paise;
  /** Already in the vendor's till — needs no settlement at all. */
  codCashPaise: Paise;
}

export interface VendorEarnings {
  restaurant: Restaurant;
  days: EarningsDay[];
  today: EarningsDay;
  ledger: LedgerEntry[];
  ledgerTotalPaise: number;
  settlements: Settlement[];
  /** Owed but not yet paid out: pending settlements plus today's unsettled prepaid. */
  pendingPayoutPaise: Paise;
}

export async function getVendorEarnings(params: {
  restaurant: Restaurant;
  campus: Campus;
  dayCount?: number;
  now?: Date;
}): Promise<VendorEarnings> {
  const now = params.now ?? new Date();
  const dayCount = params.dayCount ?? 7;

  const oldest = campusDayRange(
    campusDateString(new Date(now.getTime() - (dayCount - 1) * 86_400_000), params.campus.timezone),
    params.campus.timezone,
  ).start;

  // Only orders that actually reached a student count as earnings. Anything
  // rejected, expired or cancelled produced a refund, not revenue.
  const delivered = await (await db.orders())
    .find({
      restaurantId: params.restaurant._id,
      status: {
        $in: [
          ORDER_STATUS.DELIVERED,
          ORDER_STATUS.DELIVERED_TO_SECURITY,
          ORDER_STATUS.DISPUTE_REJECTED,
          ORDER_STATUS.SETTLED,
        ],
      },
      "timestamps.deliveredAt": { $gte: oldest },
    })
    .toArray();

  const buckets = new Map<string, EarningsDay>();
  for (let i = 0; i < dayCount; i += 1) {
    const date = campusDateString(
      new Date(now.getTime() - i * 86_400_000),
      params.campus.timezone,
    );
    buckets.set(date, {
      date,
      orderCount: 0,
      codOrderCount: 0,
      grossPaise: 0,
      commissionPaise: 0,
      receivablePaise: 0,
      codCashPaise: 0,
    });
  }

  for (const order of delivered) {
    const deliveredAt = order.timestamps.deliveredAt;
    if (!deliveredAt) continue;
    const date = campusDateString(deliveredAt, params.campus.timezone);
    const bucket = buckets.get(date);
    if (!bucket) continue;

    const isCod = order.payment.method === PAYMENT_METHOD.HYBRID_COD;
    bucket.orderCount += 1;
    if (isCod) bucket.codOrderCount += 1;
    bucket.grossPaise += order.pricing.commissionBasePaise;
    bucket.commissionPaise += order.pricing.platformCommissionPaise;
    bucket.receivablePaise += order.pricing.vendorReceivablePaise;
    if (isCod) bucket.codCashPaise += order.payment.cashDueOnDeliveryPaise;
  }

  const days = [...buckets.values()].sort((a, b) => b.date.localeCompare(a.date));
  const todayDate = campusDateString(now, params.campus.timezone);
  const today = days.find((d) => d.date === todayDate) ?? {
    date: todayDate,
    orderCount: 0,
    codOrderCount: 0,
    grossPaise: 0,
    commissionPaise: 0,
    receivablePaise: 0,
    codCashPaise: 0,
  };

  const [ledger, settlements] = await Promise.all([
    listLedgerEntries({ restaurantId: params.restaurant._id, limit: 50 }),
    listSettlements({ restaurantId: params.restaurant._id, limit: 30 }),
  ]);

  const ledgerTotalPaise = ledger.reduce((total, entry) => total + entry.amountPaise, 0);
  const pendingPayoutPaise = settlements
    .filter((s) => s.status === "PENDING")
    .reduce((total, s) => total + s.netPayablePaise, 0);

  return {
    restaurant: params.restaurant,
    days,
    today,
    ledger,
    ledgerTotalPaise,
    settlements,
    pendingPayoutPaise,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Menu
   ══════════════════════════════════════════════════════════════════════ */

export interface VendorMenuSection {
  category: MenuCategory;
  items: MenuItem[];
}

/**
 * The vendor's menu, including empty categories.
 *
 * Deliberately different from `catalog.getMenu`, which drops empty sections
 * because a student has no use for them. A vendor does: an empty category is
 * where they add the next item.
 */
export async function getVendorMenu(restaurantId: string): Promise<VendorMenuSection[]> {
  const [categories, items] = await Promise.all([
    (await db.menuCategories()).find({ restaurantId }).sort({ sortOrder: 1 }).toArray(),
    (await db.menuItems()).find({ restaurantId }).sort({ sortOrder: 1 }).toArray(),
  ]);

  return categories.map((category) => ({
    category,
    items: items.filter((item) => item.categoryId === category._id),
  }));
}

/** Today's counts for the board header, in campus-local time. */
async function todaySummary(params: {
  restaurant: Restaurant;
  campus: Campus;
  now: Date;
}): Promise<{ todayOrderCount: number; todayGrossPaise: Paise }> {
  const { start, end } = campusDayRange(
    campusDateString(params.now, params.campus.timezone),
    params.campus.timezone,
  );

  const rows = await (await db.orders())
    .find({
      restaurantId: params.restaurant._id,
      "timestamps.placedAt": { $gte: start, $lt: end },
    })
    .project<{ pricing: { vendorReceivablePaise: number } }>({ "pricing.vendorReceivablePaise": 1 })
    .toArray();

  return {
    todayOrderCount: rows.length,
    todayGrossPaise: rows.reduce((total, row) => total + row.pricing.vendorReceivablePaise, 0),
  };
}
