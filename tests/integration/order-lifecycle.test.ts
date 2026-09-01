import { afterAll, describe, expect, it } from "vitest";

import * as db from "@/server/db/collections";
import { getMongoClient } from "@/server/db/client";
import { getOrderTimeline } from "@/server/services/audit";
import { createOrder, transitionOrder } from "@/server/services/orders";
import { revealGateCode } from "@/server/services/gate-code";
import { ACTOR, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";
import type { User } from "@/types/user";

/**
 * The full path from cart to DELIVERED, for both payment methods, against a
 * real database. PROJECT_STRUCTURE.md section 7.5.
 *
 * Requires the seed to have run (`npm run seed`).
 */

const R = rupeesToPaise;

async function demoStudent(): Promise<User> {
  const users = await db.users();
  let user = await users.findOne({ _id: "test_student_fixture" });
  if (!user) {
    const studentFixture: User = {
      _id: "test_student_fixture",
      authId: null,
      role: "STUDENT",
      name: "Test Student",
      email: "test.student@nitp.ac.in",
      phone: "+919876500001",
      campusId: "campus_nitp",
      restaurantId: null,
      codBlocked: false,
      codBlockedReason: null,
      strikes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await users.replaceOne({ _id: studentFixture._id }, studentFixture, { upsert: true });
    user = studentFixture;
  }
  return user;
}

async function cleanUp(orderId: string): Promise<void> {
  await (await db.orders()).deleteOne({ _id: orderId });
  await (await db.auditLogs()).deleteMany({ orderId });
}

const createdOrderIds: string[] = [];

afterAll(async () => {
  for (const id of createdOrderIds) await cleanUp(id);
  await (await db.users()).deleteMany({
    _id: { $in: ["test_student_fixture", "test_student_blocked_fixture"] },
  });
  await (await getMongoClient()).close();
});

describe("prepaid order, cart to DELIVERED", () => {
  it("walks the whole happy path", async () => {
    const student = await demoStudent();

    const created = await createOrder({
      customer: student,
      restaurantId: "rest_nit_canteen",
      zoneId: "zone_ganga_boys",
      // Veg Thali (90) full (+30) x2 = 240, Masala Maggi (45) = 45  -> 285
      lines: [
        { itemId: "item_nc_veg_thali", quantity: 2, addOnOptionIds: ["opt_full"] },
        { itemId: "item_nc_maggi", quantity: 1, addOnOptionIds: [] },
      ],
      method: PAYMENT_METHOD.ONLINE_100,
      idempotencyKey: `test-prepaid-${Date.now()}-${Math.random()}`,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const order = created.order;
    createdOrderIds.push(order._id);

    /* ── Money ──────────────────────────────────────────────── */

    // 285 food + 10 packaging + 15 delivery = 310 commission base
    expect(order.pricing.subtotalPaise).toBe(R(285));
    expect(order.pricing.commissionBasePaise).toBe(R(310));
    // 10% of 310 = 31 exactly
    expect(order.pricing.platformCommissionPaise).toBe(R(31));
    expect(order.pricing.vendorReceivablePaise).toBe(R(279));
    // The invariant that never drifts
    expect(
      order.pricing.platformCommissionPaise + order.pricing.vendorReceivablePaise,
    ).toBe(order.pricing.commissionBasePaise);
    // 2.36% of 310 = 7.316 -> ceil to 8
    expect(order.pricing.convenienceFeePaise).toBe(R(8));
    expect(order.pricing.grandTotalPaise).toBe(R(318));
    expect(order.pricing.refundableAmountPaise).toBe(R(310));
    expect(order.payment.cashDueOnDeliveryPaise).toBe(0);

    /* ── Snapshots ──────────────────────────────────────────── */

    expect(order.restaurantSnapshot.name).toBe("NIT Canteen");
    expect(order.deliveryZoneSnapshot.name).toBe("Ganga Boys Hostel Gate");
    // 22:00, stored as minutes from midnight
    expect(order.deliveryZoneSnapshot.curfewMinutes).toBe(22 * 60);

    /* ── The gate code is server-side redacted at every step ── */

    expect(order.gateCode).toMatch(/^\d{4}$/);
    expect(revealGateCode(order.gateCode, ORDER_STATUS.PAYMENT_PENDING, "STUDENT")).toBeNull();

    /* ── Walk the FSM ───────────────────────────────────────── */

    const step = async (
      to: (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS],
      actor: (typeof ACTOR)[keyof typeof ACTOR],
      extra: { prepMinutes?: number } = {},
    ) => {
      const result = await transitionOrder({
        orderId: order._id,
        to,
        actor,
        actorId: "test",
        ...extra,
      });
      expect(result.ok, `${to} should succeed`).toBe(true);
      return result;
    };

    await step(ORDER_STATUS.PLACED, ACTOR.WEBHOOK);
    await step(ORDER_STATUS.ACCEPTED, ACTOR.VENDOR, { prepMinutes: 20 });
    await step(ORDER_STATUS.PREPARING, ACTOR.SYSTEM);

    // Vendor sees the code from READY, to write on the packet.
    await step(ORDER_STATUS.READY, ACTOR.VENDOR);
    expect(revealGateCode(order.gateCode, ORDER_STATUS.READY, "VENDOR")).toBe(order.gateCode);
    // ...and the student still cannot.
    expect(revealGateCode(order.gateCode, ORDER_STATUS.READY, "STUDENT")).toBeNull();

    await step(ORDER_STATUS.OUT_FOR_DELIVERY, ACTOR.VENDOR);
    // Still hidden while the rider is walking.
    expect(revealGateCode(order.gateCode, ORDER_STATUS.OUT_FOR_DELIVERY, "STUDENT")).toBeNull();

    await step(ORDER_STATUS.AT_GATE, ACTOR.VENDOR);
    // Only now.
    expect(revealGateCode(order.gateCode, ORDER_STATUS.AT_GATE, "STUDENT")).toBe(order.gateCode);

    const delivered = await step(ORDER_STATUS.DELIVERED, ACTOR.STUDENT);
    expect(delivered.ok && delivered.order.status).toBe(ORDER_STATUS.DELIVERED);
    expect(delivered.ok && delivered.order.timestamps.deliveredAt).toBeInstanceOf(Date);
    expect(delivered.ok && delivered.order.prepMinutes).toBe(20);

    /* ── Audit trail ────────────────────────────────────────── */

    const timeline = await getOrderTimeline(order._id);
    // creation + 7 transitions
    expect(timeline.length).toBe(8);
    expect(timeline.map((t) => t.to)).toEqual([
      ORDER_STATUS.PAYMENT_PENDING,
      ORDER_STATUS.PLACED,
      ORDER_STATUS.ACCEPTED,
      ORDER_STATUS.PREPARING,
      ORDER_STATUS.READY,
      ORDER_STATUS.OUT_FOR_DELIVERY,
      ORDER_STATUS.AT_GATE,
      ORDER_STATUS.DELIVERED,
    ]);
    // Every entry names who did it.
    for (const entry of timeline) expect(entry.actorRole).toBeTruthy();
  });
});

describe("hybrid COD order", () => {
  it("splits the money so settlement is unnecessary", async () => {
    const student = await demoStudent();

    const created = await createOrder({
      customer: student,
      restaurantId: "rest_nit_canteen",
      zoneId: "zone_main_gate",
      lines: [{ itemId: "item_nc_veg_thali", quantity: 2, addOnOptionIds: ["opt_full"] }],
      method: PAYMENT_METHOD.HYBRID_COD,
      idempotencyKey: `test-cod-${Date.now()}-${Math.random()}`,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const order = created.order;
    createdOrderIds.push(order._id);

    // 240 food + 10 packaging + 15 delivery = 265 base
    expect(order.pricing.commissionBasePaise).toBe(R(265));
    // 10% of 265 = 26.50 -> ceil 27
    expect(order.pricing.platformCommissionPaise).toBe(R(27));
    expect(order.pricing.vendorReceivablePaise).toBe(R(238));

    // THE invariant: the token IS the commission, the cash IS the receivable.
    // Neither side owes the other anything, so a COD order never settles.
    expect(order.payment.cashDueOnDeliveryPaise).toBe(order.pricing.vendorReceivablePaise);
    expect(
      order.pricing.platformCommissionPaise + order.payment.cashDueOnDeliveryPaise,
    ).toBe(order.pricing.commissionBasePaise);

    // 2.36% of the 27 token = 0.637 -> ceil to 1
    expect(order.pricing.convenienceFeePaise).toBe(R(1));
    // Refundable is the token minus its fee, NOT the whole order.
    expect(order.pricing.refundableAmountPaise).toBe(R(27));
  });
});

describe("F12 — duplicate submission", () => {
  it("returns the first order rather than creating a twin", async () => {
    const student = await demoStudent();
    const key = `test-idem-${Date.now()}-${Math.random()}`;

    const args = {
      customer: student,
      restaurantId: "rest_nit_canteen",
      zoneId: "zone_main_gate",
      // Two, not one: a single 45-rupee Maggi is below the canteen's
      // 50-rupee minimum and would be refused before idempotency mattered.
      lines: [{ itemId: "item_nc_maggi", quantity: 2, addOnOptionIds: [] }],
      method: PAYMENT_METHOD.ONLINE_100,
      idempotencyKey: key,
    } as const;

    const first = await createOrder(args);
    const second = await createOrder(args);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    createdOrderIds.push(first.order._id);

    expect(second.order._id).toBe(first.order._id);
    expect(second.reused).toBe(true);
    expect(first.reused).toBe(false);

    const count = await (await db.orders()).countDocuments({ idempotencyKey: key });
    expect(count).toBe(1);
  });
});

describe("F14 — an item 86-ed before payment", () => {
  it("refuses the order rather than charging for food that is not coming", async () => {
    const student = await demoStudent();

    const created = await createOrder({
      customer: student,
      restaurantId: "rest_nit_canteen",
      // Chilli Paneer is seeded unavailable.
      lines: [{ itemId: "item_nc_chilli_paneer", quantity: 1, addOnOptionIds: [] }],
      zoneId: "zone_main_gate",
      method: PAYMENT_METHOD.ONLINE_100,
      idempotencyKey: `test-86-${Date.now()}-${Math.random()}`,
    });

    // The whole cart was unavailable, so it cannot even be priced.
    expect(created.ok).toBe(false);
    if (created.ok) createdOrderIds.push(created.order._id);
  });
});

describe("COD is refused for a blocked student (F9)", () => {
  it("rejects at the service layer, not just in the UI", async () => {
    const users = await db.users();
    const blockedFixture: User = {
      _id: "test_student_blocked_fixture",
      authId: null,
      role: "STUDENT",
      name: "Blocked Student",
      email: "blocked.student@nitp.ac.in",
      phone: "+919876500002",
      campusId: "campus_nitp",
      restaurantId: null,
      codBlocked: true,
      codBlockedReason: "Refused to pay cash on delivery for TRF-NITP-0042",
      strikes: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await users.replaceOne({ _id: blockedFixture._id }, blockedFixture, { upsert: true });

    const created = await createOrder({
      customer: blockedFixture,
      restaurantId: "rest_nit_canteen",
      zoneId: "zone_main_gate",
      lines: [{ itemId: "item_nc_veg_thali", quantity: 1, addOnOptionIds: ["opt_full"] }],
      method: PAYMENT_METHOD.HYBRID_COD,
      idempotencyKey: `test-codblock-${Date.now()}-${Math.random()}`,
    });

    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.code).toBe("COD_BLOCKED");
  });
});
