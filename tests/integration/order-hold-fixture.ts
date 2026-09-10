import * as db from "@/server/db/collections";
import { releasePendingOrders } from "@/server/services/orders";

/** Advance only this fixture's persisted deadline, then use the real release path. */
export async function elapseOrderHold(orderId: string): Promise<void> {
  await (await db.orders()).updateOne({ _id: orderId }, { $set: { cancelUntil: new Date(0) } });
  await releasePendingOrders({ orderId });
}
