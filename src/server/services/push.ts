import "server-only";

import webpush from "web-push";

import * as db from "@/server/db/collections";
import { newId } from "@/lib/ids";
import { clientEnv, serverEnv } from "@/lib/env";
import { ROLE } from "@/lib/constants";
import { formatINR } from "@/lib/money";
import type { Order } from "@/types/order";
import type { PushSubscription } from "@/types/ops";

/**
 * Web Push (VAPID).
 *
 * Free, and the only push channel until TRAI DLT registration clears and SMS
 * becomes available (D7). One subscription per device, so a student with a
 * phone and a laptop gets both.
 *
 * Two rules that outrank "deliver the notification":
 *
 *   1. Push is NEVER the only channel for anything. F17 in the failures doc is
 *      explicit: a student who denied the permission prompt must still learn
 *      that their food is at the gate. The in-app banner and the polled
 *      tracker are the primary channel; this is the nudge that saves them
 *      staring at a screen.
 *   2. A push failure never fails the transition that triggered it. Every send
 *      here is best-effort and swallowed. An order does not stay stuck at
 *      OUT_FOR_DELIVERY because a browser vendor's endpoint 500ed.
 *
 * With no VAPID keys configured the whole module degrades to a no-op, which is
 * exactly what the prototype needs: the app runs with zero credentials.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const privateKey = serverEnv().VAPID_PRIVATE_KEY;
  const publicKey = clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    configured = false;
    return configured;
  }

  webpush.setVapidDetails(serverEnv().VAPID_SUBJECT, publicKey, privateKey);
  configured = true;
  return configured;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

export async function saveSubscription(params: {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
}): Promise<void> {
  const subscriptions = await db.pushSubscriptions();
  const now = new Date();

  // Upsert on the endpoint: a browser re-registering the same device must not
  // accumulate rows, or one AT_GATE event becomes six identical buzzes.
  await subscriptions.updateOne(
    { endpoint: params.endpoint },
    {
      $set: {
        userId: params.userId,
        keys: params.keys,
        userAgent: params.userAgent,
        lastSeenAt: now,
      },
      $setOnInsert: { _id: newId(), endpoint: params.endpoint, createdAt: now },
    },
    { upsert: true },
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await (await db.pushSubscriptions()).deleteOne({ endpoint });
}

export async function countSubscriptions(userId: string): Promise<number> {
  return (await db.pushSubscriptions()).countDocuments({ userId });
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping the notification lands. */
  url: string;
  /** Collapses repeats of the same event on the same device. */
  tag?: string;
  requireInteraction?: boolean;
  /** Lets the service worker treat a vendor alert differently from a student nudge. */
  kind?: "VENDOR_NEW_ORDER" | "VENDOR_TEST";
}

export interface DeliveryOptions {
  /** Seconds the push service holds the message for an offline device. */
  ttlSeconds?: number;
  /**
   * "high" asks Android to wake a dozing phone for it. Reserved for messages
   * someone loses money over if they arrive late.
   */
  urgency?: "normal" | "high";
}

export async function sendToUser(
  userId: string,
  payload: PushPayload,
  options: DeliveryOptions = {},
): Promise<number> {
  return sendToUsers([userId], payload, options);
}

async function sendToUsers(
  userIds: readonly string[],
  payload: PushPayload,
  options: DeliveryOptions,
): Promise<number> {
  if (!ensureConfigured() || userIds.length === 0) return 0;

  const subscriptions = await db.pushSubscriptions();
  const rows = await subscriptions.find({ userId: { $in: [...userIds] } }).toArray();
  if (rows.length === 0) return 0;

  // In parallel: a kitchen with an owner phone, a counter tablet and a staff
  // phone should buzz together, not one after another behind a slow endpoint.
  const results = await Promise.all(rows.map((row) => sendToSubscription(row, payload, options)));
  return results.filter(Boolean).length;
}

async function sendToSubscription(
  row: PushSubscription,
  payload: PushPayload,
  options: DeliveryOptions,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: row.keys },
      JSON.stringify(payload),
      { TTL: options.ttlSeconds ?? 300, urgency: options.urgency ?? "normal" },
    );
    return true;
  } catch (error: unknown) {
    // 404/410 mean the browser dropped the subscription — clean it up rather
    // than retrying it forever on every future order.
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : 0;
    if (status === 404 || status === 410) await removeSubscription(row.endpoint);
    return false;
  }
}

/**
 * The order-event push.
 *
 * `tag` is the order id, so a student who gets "on the way" and then "at your
 * gate" sees one notification that updates, rather than a stack of four.
 * `requireInteraction` is set for the gate event alone — that is the one worth
 * surviving a glance at a lock screen.
 */
export async function notifyOrderEvent(params: {
  order: Order;
  title: string;
  body: string;
  requireInteraction?: boolean;
}): Promise<void> {
  try {
    await sendToUser(params.order.customerId, {
      title: params.title,
      body: params.body,
      url: `/orders/${params.order._id}`,
      tag: `order-${params.order._id}`,
      ...(params.requireInteraction === undefined
        ? {}
        : { requireInteraction: params.requireInteraction }),
    });
  } catch {
    // Rule 2: a push failure never fails the transition that caused it.
  }
}

/* ------------------------------------------------------------------ */
/* Vendor alerts                                                       */
/* ------------------------------------------------------------------ */

/** Everyone who can answer an order for this restaurant: owners and staff alike. */
async function restaurantStaffIds(restaurantId: string): Promise<string[]> {
  const staff = await (await db.users())
    .find(
      { restaurantId, role: { $in: [ROLE.VENDOR_OWNER, ROLE.VENDOR_STAFF] } },
      { projection: { _id: 1 } },
    )
    .toArray();
  return staff.map((user) => user._id);
}

/**
 * The new-order alert, to every device of every account on the restaurant.
 *
 * This is what reaches a phone lying face-down on the counter with the app
 * closed. The in-console alarm only rings while the console is open, so
 * without this a vendor who has put the phone down is a vendor whose orders
 * expire in silence.
 *
 * Every alert for one order shares a tag, so a reminder replaces the first
 * buzz on the lock screen (and buzzes again, via `renotify`) instead of
 * stacking three copies of the same order.
 *
 * TTL is the time left to accept. A phone that comes back online after the
 * order has already expired should not be told to go and accept it.
 */
export async function notifyVendorNewOrder(params: {
  order: Order;
  /** Seconds until the order auto-expires. */
  secondsToAccept: number;
  /** Zero for the first alert, then 1, 2, 3 for each minute it waits. */
  reminder?: number;
}): Promise<void> {
  const { order, secondsToAccept } = params;
  const reminder = params.reminder ?? 0;
  if (secondsToAccept <= 0) return;

  try {
    const staffIds = await restaurantStaffIds(order.restaurantId);
    const minutesLeft = Math.max(1, Math.ceil(secondsToAccept / 60));

    await sendToUsers(
      staffIds,
      {
        kind: "VENDOR_NEW_ORDER",
        title:
          reminder === 0
            ? `New order ${order.orderNumber}`
            : `Still waiting: ${order.orderNumber}`,
        body: [
          summariseItems(order),
          `${formatINR(order.payment.cashDuePaise)} cash · ${order.deliveryZoneSnapshot.name}`,
          [order.customerSnapshot.name, order.customerSnapshot.phone].filter(Boolean).join(" · "),
          reminder === 0
            ? `Accept within ${minutesLeft} min`
            : `Not accepted yet — auto-cancels in ${minutesLeft} min`,
        ].join("\n"),
        url: "/vendor/orders",
        tag: `vendor-order-${order._id}`,
        requireInteraction: true,
      },
      { ttlSeconds: Math.max(30, Math.floor(secondsToAccept)), urgency: "high" },
    );
  } catch {
    // Rule 2 again. The console alarm and the board still carry the order.
  }
}

/** Vendor settings: prove the whole chain works on this phone, with the app closed. */
export async function sendVendorTestPush(userId: string): Promise<number> {
  return sendToUser(
    userId,
    {
      kind: "VENDOR_TEST",
      title: "TREFOOD order alerts are working",
      body: "New orders will reach this phone like this, even when the app is closed.",
      url: "/vendor/orders",
      tag: "vendor-test",
    },
    { ttlSeconds: 120, urgency: "high" },
  );
}

/** "2× Veg Biryani, 1× Coke +2 more" — enough to start cooking from a lock screen. */
export function summariseItems(order: Pick<Order, "items">, shown = 2): string {
  const lines = order.items.slice(0, shown).map((item) => `${item.quantity}× ${item.name}`);
  const rest = order.items.length - shown;
  return rest > 0 ? `${lines.join(", ")} +${rest} more` : lines.join(", ");
}
