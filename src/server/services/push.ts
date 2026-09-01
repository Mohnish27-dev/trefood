import "server-only";

import webpush from "web-push";

import * as db from "@/server/db/collections";
import { newId } from "@/lib/ids";
import { clientEnv, serverEnv } from "@/lib/env";
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
}

export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subscriptions = await db.pushSubscriptions();
  const rows = await subscriptions.find({ userId }).toArray();
  if (rows.length === 0) return 0;

  let delivered = 0;
  for (const row of rows) {
    const ok = await sendToSubscription(row, payload);
    if (ok) delivered += 1;
  }
  return delivered;
}

async function sendToSubscription(row: PushSubscription, payload: PushPayload): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: row.keys },
      JSON.stringify(payload),
      { TTL: 300 },
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
