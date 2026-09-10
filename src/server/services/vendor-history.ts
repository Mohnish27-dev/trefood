import "server-only";

import * as db from "@/server/db/collections";
import { ORDER_STATUS, VENDOR_ACTIVE_STATUSES, type OrderStatus } from "@/lib/constants";
import { releasePendingOrders } from "./orders";

export type VendorHistoryFilter = "all" | "accepted" | "rejected" | "completed";
const PAGE_SIZE = 20;
const VISIBLE_STATUSES: readonly OrderStatus[] = [
  ...VENDOR_ACTIVE_STATUSES,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.SETTLED,
  ORDER_STATUS.REJECTED_BY_VENDOR,
  ORDER_STATUS.EXPIRED_NO_ACK,
  ORDER_STATUS.CANCELLED_BY_ADMIN,
  ORDER_STATUS.NO_SHOW,
];

/** Restaurant id must come from requireVendor, never from a URL parameter. */
export async function getVendorOrderHistory(params: {
  restaurantId: string;
  filter?: string;
  page?: number;
}) {
  await releasePendingOrders({ restaurantId: params.restaurantId });
  const filter: VendorHistoryFilter =
    params.filter === "accepted" || params.filter === "rejected" || params.filter === "completed"
      ? params.filter : "all";
  const query = {
    restaurantId: params.restaurantId,
    status: { $in: filter === "rejected" ? [ORDER_STATUS.REJECTED_BY_VENDOR]
      : filter === "completed" ? [ORDER_STATUS.DELIVERED, ORDER_STATUS.SETTLED]
      : [...VISIBLE_STATUSES] },
    ...(filter === "accepted" ? { "timestamps.acceptedAt": { $type: "date" as const } } : {}),
  };
  const orders = await db.orders();
  const total = await orders.countDocuments(query);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = params.page ?? 1;
  const page = Math.min(pageCount, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const rows = await orders.find(query)
    .sort({ "timestamps.createdAt": -1, _id: -1 })
    .skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray();

  return {
    filter, page, pageCount, total,
    orders: rows.map(order => ({
      id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.timestamps.createdAt.toISOString(),
      acceptedAt: order.timestamps.acceptedAt?.toISOString() ?? null,
      customerName: order.customerSnapshot.name,
      zoneName: order.deliveryZoneSnapshot.name,
      items: order.items.map(item => ({
        name: item.name, quantity: item.quantity, isVeg: item.isVeg,
        addOns: item.addOns.map(addOn => addOn.name), lineTotalPaise: item.lineTotalPaise,
      })),
      totalPaise: order.pricing.grandTotalPaise,
      cashCollectedPaise: order.payment.cashCollectedPaise,
      cancellationReason: order.cancellation?.reason ?? null,
      isActive: VENDOR_ACTIVE_STATUSES.includes(order.status),
    })),
  };
}

export type VendorOrderHistory = Awaited<ReturnType<typeof getVendorOrderHistory>>;
