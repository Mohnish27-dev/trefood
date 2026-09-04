/**
 * Clean up abandoned / unfulfilled test orders with status PAYMENT_PENDING.
 *
 * Usage:
 *   npm run db:cleanup-pending
 */

import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import { ORDER_STATUS } from "@/lib/constants";

async function main(): Promise<void> {
  const ordersColl = await db.orders();
  const auditColl = await db.auditLogs();

  // Find all orders that are PAYMENT_PENDING or PAYMENT_FAILED with zero payment captured
  const staleOrders = await ordersColl
    .find({
      $or: [
        { status: ORDER_STATUS.PAYMENT_PENDING },
        { status: ORDER_STATUS.PAYMENT_FAILED, "payment.onlinePaidPaise": 0 },
      ],
    })
    .toArray();

  if (staleOrders.length === 0) {
    console.log("No abandoned / pending payment orders found.");
    const client = await getMongoClient();
    await client.close();
    return;
  }

  console.log(`Found ${staleOrders.length} abandoned orders:`);
  for (const o of staleOrders) {
    console.log(`  - ${o.orderNumber} (${o.status}) created at ${o.timestamps.createdAt}`);
  }

  const orderIds = staleOrders.map((o) => o._id);

  const deletedOrders = await ordersColl.deleteMany({ _id: { $in: orderIds } });
  const deletedAudit = await auditColl.deleteMany({ orderId: { $in: orderIds } });

  console.log(`\nSuccessfully deleted:`);
  console.log(`  - ${deletedOrders.deletedCount} orders`);
  console.log(`  - ${deletedAudit.deletedCount} audit log entries`);

  const client = await getMongoClient();
  await client.close();
}

main().catch((error: unknown) => {
  console.error("Cleanup failed:", error);
  process.exitCode = 1;
});
