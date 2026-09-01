/**
 * Drive a demo order to any state, so a screen can be shown without cooking.
 *
 *   npm run demo:order              -> stops at AT_GATE (the gate screen)
 *   npm run demo:order -- PLACED    -> a new order waiting on the vendor board
 *   npm run demo:order -- READY     -> gate code revealed to the vendor only
 *
 * Uses the real services and the real FSM, so what you see on screen is what
 * the production path produces — not a fixture.
 */

import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import { createOrder, transitionOrder } from "@/server/services/orders";
import { ACTOR, ORDER_STATUS, PAYMENT_METHOD, type OrderStatus } from "@/lib/constants";
import { formatINR } from "@/lib/money";

const PATH: { to: OrderStatus; actor: (typeof ACTOR)[keyof typeof ACTOR]; prep?: number }[] = [
  { to: ORDER_STATUS.PLACED, actor: ACTOR.WEBHOOK },
  { to: ORDER_STATUS.ACCEPTED, actor: ACTOR.VENDOR, prep: 20 },
  { to: ORDER_STATUS.PREPARING, actor: ACTOR.SYSTEM },
  { to: ORDER_STATUS.READY, actor: ACTOR.VENDOR },
  { to: ORDER_STATUS.OUT_FOR_DELIVERY, actor: ACTOR.VENDOR },
  { to: ORDER_STATUS.AT_GATE, actor: ACTOR.VENDOR },
];

async function main(): Promise<void> {
  const target = (process.argv[2] ?? ORDER_STATUS.AT_GATE) as OrderStatus;
  const method =
    process.argv[3] === "COD" ? PAYMENT_METHOD.HYBRID_COD : PAYMENT_METHOD.ONLINE_100;

  let student = await (await db.users()).findOne({ role: "STUDENT" });
  if (!student) {
    const newStudent = {
      _id: "usr_demo_student",
      authId: null,
      role: "STUDENT" as const,
      name: "Demo Student",
      email: "student@nitp.ac.in",
      phone: "+919876500001",
      campusId: "campus_nitp",
      restaurantId: null,
      codBlocked: false,
      codBlockedReason: null,
      strikes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await (await db.users()).insertOne(newStudent);
    student = newStudent;
  }

  const created = await createOrder({
    customer: student,
    restaurantId: "rest_nit_canteen",
    zoneId: "zone_ganga_boys",
    lines: [
      { itemId: "item_nc_veg_thali", quantity: 2, addOnOptionIds: ["opt_full"] },
      { itemId: "item_nc_maggi", quantity: 1, addOnOptionIds: ["opt_maggi_cheese"] },
    ],
    method,
    idempotencyKey: `demo-${Date.now()}`,
  });

  if (!created.ok) {
    console.error("Could not create the demo order:", created.message);
    process.exitCode = 1;
    return;
  }

  const order = created.order;
  console.log(`\nCreated ${order.orderNumber}  (${method})`);
  console.log(`  Commission base   ${formatINR(order.pricing.commissionBasePaise)}`);
  console.log(`  Platform 10%      ${formatINR(order.pricing.platformCommissionPaise)}`);
  console.log(`  Vendor receives   ${formatINR(order.pricing.vendorReceivablePaise)}`);
  console.log(`  Convenience fee   ${formatINR(order.pricing.convenienceFeePaise)} (non-refundable)`);
  if (method === PAYMENT_METHOD.HYBRID_COD) {
    console.log(`  Cash at the gate  ${formatINR(order.payment.cashDueOnDeliveryPaise)}`);
  } else {
    console.log(`  Student pays      ${formatINR(order.pricing.grandTotalPaise)}`);
  }

  console.log("\nAdvancing through the real state machine:");
  for (const step of PATH) {
    const result = await transitionOrder({
      orderId: order._id,
      to: step.to,
      actor: step.actor,
      actorId: "demo-script",
      ...(step.prep === undefined ? {} : { prepMinutes: step.prep }),
    });

    if (!result.ok) {
      console.error(`  ! ${step.to}: ${result.message}`);
      break;
    }
    console.log(`  -> ${step.to}`);
    if (step.to === target) break;
  }

  const final = await (await db.orders()).findOne({ _id: order._id });
  console.log(`\nOrder is now ${final?.status ?? "unknown"}`);
  console.log(`  Gate code (written on the packet): ${order.gateCode}`);
  console.log(`\n  Student  http://localhost:3000/orders/${order._id}`);
  console.log(`  Vendor   http://localhost:3000/vendor/orders\n`);

  await (await getMongoClient()).close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
