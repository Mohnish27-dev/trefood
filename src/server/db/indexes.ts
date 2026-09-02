import "server-only";

import type { Db, IndexDescription } from "mongodb";

import { getDb } from "./client";
import { COLLECTION, type CollectionName } from "./collections";

/**
 * Every index in the system, in one place, created idempotently.
 *
 * `createIndexes` is a no-op when an identical index already exists, so this
 * is safe to run on every boot and safe to run concurrently from several
 * instances during a rolling deploy.
 *
 * The unique ones are load-bearing, not optimisations:
 *
 *   orders.orderNumber              a duplicate would be quoted at two gates
 *   orders.idempotencyKey           F12 — a double-tap must return the first order
 *   settlements(restaurantId,date)  F15 — a second nightly run must be a no-op
 *   webhookEvents.eventId           a replayed webhook must not double-process
 *   disputes.orderId                one dispute per order, by construction
 */

const INDEXES: Record<CollectionName, IndexDescription[]> = {
  [COLLECTION.campuses]: [{ key: { slug: 1 }, unique: true, name: "slug_unique" }],

  [COLLECTION.users]: [
    // PARTIAL, not sparse. A sparse index only skips documents where the field
    // is MISSING; a document with an explicit `authId: null` is still indexed,
    // so the second unauthenticated user collides on null. Every user carries
    // `authId: null` until Supabase fills it in (D7), so this must filter on
    // type instead.
    {
      key: { authId: 1 },
      unique: true,
      partialFilterExpression: { authId: { $type: "string" } },
      name: "authId_unique",
    },
    { key: { email: 1 }, unique: true, name: "email_unique" },
    { key: { phone: 1 }, sparse: true, name: "phone" },
    { key: { restaurantId: 1 }, sparse: true, name: "restaurantId" },
  ],

  [COLLECTION.restaurants]: [
    { key: { slug: 1 }, unique: true, name: "slug_unique" },
    // The student list query: open restaurants in a campus that serve a zone.
    { key: { campusId: 1, isOpen: 1, isApproved: 1 }, name: "campus_open_approved" },
    { key: { campusId: 1, servedZoneIds: 1 }, name: "campus_zones" },
    { key: { "kyc.status": 1 }, name: "kyc_status" },
  ],

  [COLLECTION.menuCategories]: [
    { key: { restaurantId: 1, sortOrder: 1 }, name: "restaurant_sort" },
  ],

  [COLLECTION.menuItems]: [
    { key: { restaurantId: 1, isAvailable: 1 }, name: "restaurant_available" },
    { key: { restaurantId: 1, categoryId: 1, sortOrder: 1 }, name: "restaurant_category_sort" },
  ],

  [COLLECTION.orders]: [
    { key: { orderNumber: 1 }, unique: true, name: "orderNumber_unique" },
    { key: { idempotencyKey: 1 }, unique: true, name: "idempotencyKey_unique" },
    // Student history, newest first.
    { key: { customerId: 1, "timestamps.createdAt": -1 }, name: "customer_recent" },
    // The vendor board poll, every 5 seconds. This one has to be fast.
    { key: { restaurantId: 1, status: 1 }, name: "restaurant_status" },
    // The cron sweeps: expire-unacked, close-stale-gates, reconcile-payments.
    { key: { status: 1, "timestamps.placedAt": 1 }, name: "status_placedAt" },
    { key: { status: 1, "timestamps.atGateAt": 1 }, name: "status_atGateAt" },
    { key: { status: 1, "timestamps.createdAt": 1 }, name: "status_createdAt" },
    // The settlement run, and the admin live radar.
    { key: { restaurantId: 1, status: 1, "timestamps.deliveredAt": 1 }, name: "settlement_scan" },
    { key: { campusId: 1, status: 1 }, name: "campus_status" },
  ],

  [COLLECTION.coupons]: [
    { key: { code: 1 }, unique: true, name: "code_unique" },
    { key: { campusId: 1, isActive: 1 }, name: "campus_active" },
    { key: { restaurantId: 1, isActive: 1 }, sparse: true, name: "restaurant_active" },
  ],

  [COLLECTION.ledgerEntries]: [
    { key: { restaurantId: 1, createdAt: -1 }, name: "restaurant_recent" },
    { key: { orderId: 1 }, sparse: true, name: "orderId" },
  ],

  [COLLECTION.settlements]: [
    // F15 — this is what makes a second run of the nightly cron a no-op.
    { key: { restaurantId: 1, settlementDate: 1 }, unique: true, name: "restaurant_date_unique" },
    { key: { settlementDate: 1, status: 1 }, name: "date_status" },
  ],

  [COLLECTION.webhookEvents]: [
    // Insert here BEFORE acting. A duplicate key error means already processed.
    { key: { eventId: 1 }, unique: true, name: "eventId_unique" },
    // Housekeeping: events older than 30 days are no longer useful for replay defence.
    { key: { processedAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 30, name: "processedAt_ttl" },
  ],

  [COLLECTION.auditLogs]: [
    { key: { orderId: 1, at: 1 }, name: "order_at" },
    { key: { actorId: 1, at: -1 }, name: "actor_at" },
    { key: { entity: 1, entityId: 1, at: -1 }, name: "entity_at" },
    // Deliberately NO ttl. The audit trail is append-only and permanent —
    // it is the evidence in every dispute and every chargeback.
  ],

  [COLLECTION.pushSubscriptions]: [
    { key: { userId: 1 }, name: "userId" },
    { key: { endpoint: 1 }, unique: true, name: "endpoint_unique" },
  ],

  [COLLECTION.disputes]: [
    { key: { orderId: 1 }, unique: true, name: "orderId_unique" },
    { key: { status: 1, createdAt: -1 }, name: "status_recent" },
    { key: { campusId: 1, status: 1 }, name: "campus_status" },
  ],

  [COLLECTION.counters]: [],
};

/** IndexOptionsConflict (85) and IndexKeySpecsConflict (86). */
function isIndexConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === 85 || code === 86;
}

export interface IndexReport {
  collection: string;
  created: string[];
  error: string | null;
}

export async function ensureIndexes(db?: Db): Promise<IndexReport[]> {
  const database = db ?? (await getDb());
  const reports: IndexReport[] = [];

  for (const [name, specs] of Object.entries(INDEXES)) {
    if (specs.length === 0) {
      reports.push({ collection: name, created: [], error: null });
      continue;
    }
    try {
      const created = await database.collection(name).createIndexes(specs);
      reports.push({ collection: name, created, error: null });
    } catch (error: unknown) {
      // Codes 85/86 mean an index of this name already exists with different
      // options or a different key. That happens whenever an index definition
      // is changed here, and leaving the old one in place would silently keep
      // enforcing the OLD constraint. Drop and rebuild rather than skip.
      if (isIndexConflict(error)) {
        try {
          for (const spec of specs) {
            if (spec.name !== undefined) {
              await database.collection(name).dropIndex(spec.name).catch(() => undefined);
            }
          }
          const created = await database.collection(name).createIndexes(specs);
          reports.push({ collection: name, created, error: null });
          continue;
        } catch (retryError: unknown) {
          reports.push({
            collection: name,
            created: [],
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
          continue;
        }
      }

      reports.push({
        collection: name,
        created: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return reports;
}

export { INDEXES };
