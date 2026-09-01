import "server-only";

import * as db from "@/server/db/collections";
import {
  ACTOR,
  DEFAULTS,
  ORDER_STATUS,
  TERMINAL_STATUSES,
  type OrderStatus,
  type StuckReason,
} from "@/lib/constants";
import type { Paise } from "@/lib/money";
import { writeAudit } from "./audit";
import type { Campus, CampusSettings, DeliveryZone, GeoPolygon } from "@/types/campus";
import type { Restaurant } from "@/types/restaurant";
import type { Order } from "@/types/order";

/**
 * Admin read and write paths.
 *
 * The console is desktop-only and deliberately plainer than the other two
 * surfaces — but it is where the campus data lives, and that data *is* the
 * product. Gates, curfews and coordinates are what make TREFOOD work on a
 * campus where Swiggy cannot, so the editors here are as carefully guarded as
 * anything a student touches.
 *
 * Every mutation writes an audit entry. An admin changing a curfew or a
 * commission rate is changing money and safety for hundreds of orders, and
 * "who moved the Kaveri curfew to 23:00" must always have an answer.
 */

/* ══════════════════════════════════════════════════════════════════════
   Campuses, zones, pricing
   ══════════════════════════════════════════════════════════════════════ */

export async function listAllCampuses(): Promise<Campus[]> {
  return (await db.campuses()).find({}).sort({ name: 1 }).toArray();
}

export async function updateCampusSettings(params: {
  campusId: string;
  settings: CampusSettings;
  actorId: string;
}): Promise<Campus | null> {
  const campuses = await db.campuses();
  const before = await campuses.findOne({ _id: params.campusId });
  if (!before) return null;

  const updated = await campuses.findOneAndUpdate(
    { _id: params.campusId },
    { $set: { settings: params.settings, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (updated) {
    await writeAudit({
      entity: "CAMPUS",
      entityId: params.campusId,
      from: JSON.stringify(before.settings),
      to: JSON.stringify(params.settings),
      actorId: params.actorId,
      actorRole: ACTOR.ADMIN,
      reason: "Campus pricing and timers updated",
    });
  }

  return updated;
}

/**
 * Create or replace one gate.
 *
 * Zones live inside the campus document rather than in their own collection:
 * there are five of them, they are read on every single restaurant list, and
 * they change perhaps twice a year. A join for that would be all cost and no
 * benefit.
 */
export async function upsertZone(params: {
  campusId: string;
  zone: DeliveryZone;
  actorId: string;
}): Promise<{ ok: true; campus: Campus } | { ok: false; message: string }> {
  const campuses = await db.campuses();
  const campus = await campuses.findOne({ _id: params.campusId });
  if (!campus) return { ok: false, message: "That campus does not exist." };

  const existingIndex = campus.zones.findIndex((z) => z.id === params.zone.id);
  const zones = [...campus.zones];
  if (existingIndex >= 0) zones[existingIndex] = params.zone;
  else zones.push(params.zone);

  // Exactly one fallback per campus. The curfew guard hands students this gate
  // by name whenever another one is blocked, so two of them means the message
  // is a coin flip and none means the guard has nothing to offer.
  if (params.zone.isFallback) {
    for (const zone of zones) {
      if (zone.id !== params.zone.id) zone.isFallback = false;
    }
  }

  const updated = await campuses.findOneAndUpdate(
    { _id: params.campusId },
    { $set: { zones, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) return { ok: false, message: "That campus disappeared while you were editing." };

  await writeAudit({
    entity: "CAMPUS",
    entityId: params.campusId,
    from: existingIndex >= 0 ? "zone:update" : "zone:create",
    to: `${params.zone.id}:${params.zone.name}`,
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason:
      params.zone.curfewMinutes === null
        ? `${params.zone.name} set to 24x7`
        : `${params.zone.name} curfew set to ${params.zone.curfewMinutes} minutes from midnight`,
  });

  return { ok: true, campus: updated };
}

/**
 * Deactivate a gate rather than delete it.
 *
 * Orders snapshot their zone, so history survives either way — but a deleted
 * id can never be reactivated, and "the gate is shut for repairs this week" is
 * far more common than "this gate no longer exists".
 */
export async function setZoneActive(params: {
  campusId: string;
  zoneId: string;
  isActive: boolean;
  actorId: string;
}): Promise<Campus | null> {
  const campuses = await db.campuses();
  const updated = await campuses.findOneAndUpdate(
    { _id: params.campusId, "zones.id": params.zoneId },
    { $set: { "zones.$.isActive": params.isActive, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (updated) {
    await writeAudit({
      entity: "CAMPUS",
      entityId: params.campusId,
      from: params.isActive ? "zone:inactive" : "zone:active",
      to: params.isActive ? "zone:active" : "zone:inactive",
      actorId: params.actorId,
      actorRole: ACTOR.ADMIN,
      reason: `Zone ${params.zoneId} ${params.isActive ? "reopened" : "closed"}`,
    });
  }

  return updated;
}

export async function updateGeofence(params: {
  campusId: string;
  geofence: GeoPolygon | null;
  actorId: string;
}): Promise<Campus | null> {
  const updated = await (await db.campuses()).findOneAndUpdate(
    { _id: params.campusId },
    { $set: { geofence: params.geofence, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (updated) {
    await writeAudit({
      entity: "CAMPUS",
      entityId: params.campusId,
      from: "geofence",
      to: params.geofence === null ? "cleared" : `${params.geofence.coordinates[0]?.length ?? 0} points`,
      actorId: params.actorId,
      actorRole: ACTOR.ADMIN,
      reason: "Campus boundary redrawn",
    });
  }

  return updated;
}

/* ══════════════════════════════════════════════════════════════════════
   Vendor KYC
   ══════════════════════════════════════════════════════════════════════ */

export async function listVendors(params: {
  campusId?: string;
  kycStatus?: Restaurant["kyc"]["status"];
}): Promise<Restaurant[]> {
  const filter: Record<string, unknown> = {};
  if (params.campusId) filter.campusId = params.campusId;
  if (params.kycStatus) filter["kyc.status"] = params.kycStatus;

  return (await db.restaurants()).find(filter).sort({ "kyc.status": 1, name: 1 }).toArray();
}

export async function reviewKyc(params: {
  restaurantId: string;
  approve: boolean;
  reason: string;
  actorId: string;
}): Promise<{ ok: true; restaurant: Restaurant } | { ok: false; message: string }> {
  const restaurants = await db.restaurants();
  const before = await restaurants.findOne({ _id: params.restaurantId });
  if (!before) return { ok: false, message: "That restaurant does not exist." };

  const now = new Date();
  const updated = await restaurants.findOneAndUpdate(
    { _id: params.restaurantId },
    {
      $set: {
        "kyc.status": params.approve ? "APPROVED" : "REJECTED",
        "kyc.reviewedAt": now,
        "kyc.reviewedBy": params.actorId,
        "kyc.rejectionReason": params.approve ? null : params.reason,
        // Approval is what makes a restaurant visible to students at all.
        isApproved: params.approve,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) return { ok: false, message: "That restaurant disappeared mid-review." };

  await writeAudit({
    entity: "RESTAURANT",
    entityId: updated._id,
    from: before.kyc.status,
    to: updated.kyc.status,
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: params.reason,
  });

  return { ok: true, restaurant: updated };
}

export async function setCommissionOverride(params: {
  restaurantId: string;
  /** Null returns the vendor to the campus rate. */
  commissionBpsOverride: number | null;
  actorId: string;
}): Promise<Restaurant | null> {
  const restaurants = await db.restaurants();
  const before = await restaurants.findOne({ _id: params.restaurantId });
  if (!before) return null;

  const updated = await restaurants.findOneAndUpdate(
    { _id: params.restaurantId },
    { $set: { commissionBpsOverride: params.commissionBpsOverride, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (updated) {
    await writeAudit({
      entity: "RESTAURANT",
      entityId: updated._id,
      from: String(before.commissionBpsOverride ?? "campus rate"),
      to: String(params.commissionBpsOverride ?? "campus rate"),
      actorId: params.actorId,
      actorRole: ACTOR.ADMIN,
      reason: "Commission override changed",
    });
  }

  return updated;
}

export async function updatePayoutDetails(params: {
  restaurantId: string;
  payout: Restaurant["payout"];
  actorId: string;
}): Promise<Restaurant | null> {
  const updated = await (await db.restaurants()).findOneAndUpdate(
    { _id: params.restaurantId },
    { $set: { payout: params.payout, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (updated) {
    await writeAudit({
      entity: "RESTAURANT",
      entityId: updated._id,
      from: "payout",
      // Never the account number: the audit log is exportable and this row
      // would be the one line in it worth stealing.
      to: `account ending ${params.payout.accountNumber.slice(-4)}`,
      actorId: params.actorId,
      actorRole: ACTOR.ADMIN,
      reason: "Payout details updated",
    });
  }

  return updated;
}

/* ══════════════════════════════════════════════════════════════════════
   The live radar
   ══════════════════════════════════════════════════════════════════════ */

export interface RadarOrder {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  campusId: string;
  campusName: string;
  restaurantName: string;
  customerName: string;
  customerPhone: string;
  zoneName: string;
  createdAt: string;
  minutesInState: number;
  grandTotalPaise: Paise;
  method: string;
  /** Non-empty means this order needs a human now. */
  stuck: StuckReason[];
}

export interface RadarSnapshot {
  orders: RadarOrder[];
  activeCount: number;
  stuckCount: number;
  serverTime: string;
}

/**
 * Every live order across every campus, with the stuck ones called out.
 *
 * The point of this screen is not to watch healthy orders — the sweeps handle
 * those. It is to surface the handful where a timer has already fired and
 * nothing moved, because those are the ones that end in a phone call.
 */
export async function getRadar(params: {
  campusId?: string;
  now?: Date;
}): Promise<RadarSnapshot> {
  const now = params.now ?? new Date();

  const campuses = await (await db.campuses()).find({}).toArray();
  const campusById = new Map(campuses.map((c) => [c._id, c]));

  const filter: Record<string, unknown> = { status: { $nin: [...TERMINAL_STATUSES] } };
  if (params.campusId) filter.campusId = params.campusId;

  const orders = await (await db.orders())
    .find(filter)
    .sort({ "timestamps.createdAt": -1 })
    .limit(200)
    .toArray();

  const rows = orders.map((order) => {
    const campus = campusById.get(order.campusId);
    const stuck = stuckReasons(order, campus, now);

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      campusId: order.campusId,
      campusName: campus?.name ?? "Unknown campus",
      restaurantName: order.restaurantSnapshot.name,
      customerName: order.customerSnapshot.name,
      customerPhone: order.customerSnapshot.phone,
      zoneName: order.deliveryZoneSnapshot.name,
      createdAt: order.timestamps.createdAt.toISOString(),
      minutesInState: minutesSinceLastEvent(order, now),
      grandTotalPaise: order.pricing.grandTotalPaise,
      method: order.payment.method,
      stuck,
    } satisfies RadarOrder;
  });

  // Stuck first, then oldest — the two orders of urgency, in that order.
  rows.sort((a, b) => {
    if ((a.stuck.length > 0) !== (b.stuck.length > 0)) return a.stuck.length > 0 ? -1 : 1;
    return b.minutesInState - a.minutesInState;
  });

  return {
    orders: rows,
    activeCount: rows.length,
    stuckCount: rows.filter((r) => r.stuck.length > 0).length,
    serverTime: now.toISOString(),
  };
}

function stuckReasons(order: Order, campus: Campus | undefined, now: Date): StuckReason[] {
  const reasons: StuckReason[] = [];
  const settings = campus?.settings;
  const ms = now.getTime();

  const placedAt = order.timestamps.placedAt?.getTime() ?? null;
  if (
    order.status === ORDER_STATUS.PLACED &&
    placedAt !== null &&
    settings &&
    ms > placedAt + settings.vendorAutoExpireSeconds * 1_000
  ) {
    reasons.push("ACK_OVERDUE");
  }

  const atGateAt = order.timestamps.atGateAt?.getTime() ?? null;
  if (
    order.status === ORDER_STATUS.AT_GATE &&
    atGateAt !== null &&
    settings &&
    ms > atGateAt + settings.gateGraceSeconds * 1_000
  ) {
    reasons.push("GATE_OVERDUE");
  }

  const acceptedAt = order.timestamps.acceptedAt?.getTime() ?? null;
  if (
    order.status === ORDER_STATUS.OUT_FOR_DELIVERY &&
    acceptedAt !== null &&
    order.prepMinutes !== null &&
    ms > acceptedAt + order.prepMinutes * DEFAULTS.atGateNagMultiplier * 60_000
  ) {
    reasons.push("AT_GATE_NOT_TAPPED");
  }

  if (
    order.status === ORDER_STATUS.PAYMENT_PENDING &&
    ms > order.timestamps.createdAt.getTime() + DEFAULTS.reconcileAfterMinutes * 60_000
  ) {
    reasons.push("PAYMENT_HANGING");
  }

  if (order.stockout && order.stockout.resolvedAt === null && ms > order.stockout.expiresAt.getTime()) {
    reasons.push("STOCKOUT_UNANSWERED");
  }

  return reasons;
}

function minutesSinceLastEvent(order: Order, now: Date): number {
  const t = order.timestamps;
  const last =
    t.atGateAt ?? t.dispatchedAt ?? t.readyAt ?? t.acceptedAt ?? t.placedAt ?? t.createdAt;
  return Math.max(0, Math.trunc((now.getTime() - last.getTime()) / 60_000));
}
