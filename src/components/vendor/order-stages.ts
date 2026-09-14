import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";
import type { VendorStringKey } from "@/lib/i18n/vendor-dictionary";

/**
 * The three live stages of an order, each with its own tab in the console.
 *
 * They used to share one three-column board. On a phone that stacked into one
 * long scroll, and a vendor marking a thali "on the way" had to scroll past
 * every new order to find it. Each stage now gets a page of its own, and the
 * nav shows how many orders sit in each.
 */
export type OrderStage = "new" | "preparing" | "on_the_way";

export const ORDER_STAGES: Record<
  OrderStage,
  { href: string; label: VendorStringKey; hint: VendorStringKey; statuses: readonly OrderStatus[] }
> = {
  new: {
    href: "/vendor/orders",
    label: "colNewOrders",
    hint: "hintNewOrders",
    statuses: [ORDER_STATUS.PLACED],
  },
  preparing: {
    href: "/vendor/preparing",
    label: "colPreparing",
    hint: "hintPreparing",
    statuses: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY],
  },
  on_the_way: {
    href: "/vendor/on-the-way",
    label: "colOnTheWay",
    hint: "hintOnTheWay",
    statuses: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.AT_GATE],
  },
};
