import crypto from "node:crypto";
import { NextResponse } from "next/server";
import PaytmChecksum from "paytmchecksum";

import { ACTOR, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { serverEnv } from "@/lib/env";
import { newId } from "@/lib/ids";
import * as db from "@/server/db/collections";
import { transitionOrder } from "@/server/services/orders";
import { writeAudit } from "@/server/services/audit";

export const dynamic = "force-dynamic";

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11_000
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const params: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(json)) {
        params[k] = String(v ?? "");
      }
    } else {
      const formData = await request.formData();
      for (const [k, v] of formData.entries()) {
        params[k] = String(v ?? "");
      }
    }

    const checksum = params.CHECKSUMHASH;
    if (!checksum) {
      return NextResponse.json({ error: "Missing CHECKSUMHASH" }, { status: 400 });
    }

    const merchantKey = serverEnv().PAYTM_MERCHANT_KEY!;
    const isChecksumValid = PaytmChecksum.verifySignature(params, merchantKey, checksum);

    if (!isChecksumValid) {
      await writeAudit({
        entity: "ORDER",
        entityId: params.ORDERID ?? "unknown",
        from: null,
        to: "CHECKSUM_FAILED",
        actorId: null,
        actorRole: ACTOR.WEBHOOK,
        reason: "Paytm webhook rejected: checksum mismatch",
      });
      return NextResponse.json({ error: "Checksum verification failed" }, { status: 400 });
    }

    const orderNumber = params.ORDERID;
    if (!orderNumber) {
      return NextResponse.json({ error: "Missing ORDERID" }, { status: 400 });
    }

    const ordersCol = await db.orders();
    const order = await ordersCol.findOne({ orderNumber });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const eventId = `paytm_${params.TXNID || order._id}_${params.STATUS}`;
    const webhookEventsCol = await db.webhookEvents();
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(params)).digest("hex");

    try {
      await webhookEventsCol.insertOne({
        _id: newId(),
        eventId,
        provider: "PAYTM",
        eventType: params.STATUS || "UNKNOWN",
        orderId: order._id,
        payloadHash,
        processedAt: new Date(),
      });
    } catch (err: unknown) {
      if (isDuplicateKey(err)) {
        // Replay defense: already processed
        return respond(request, order._id, { ok: true, message: "Already processed" });
      }
      throw err;
    }

    if (params.STATUS === "TXN_SUCCESS") {
      const paidPaise = Math.round(parseFloat(params.TXNAMOUNT || "0") * 100);

      await ordersCol.updateOne(
        { _id: order._id },
        {
          $set: {
            "payment.status": PAYMENT_STATUS.CAPTURED,
            "payment.providerPaymentId": params.TXNID ?? null,
            "payment.onlinePaidPaise": paidPaise,
          },
        },
      );

      if (order.status === ORDER_STATUS.PAYMENT_PENDING) {
        await transitionOrder({
          orderId: order._id,
          to: ORDER_STATUS.PLACED,
          actor: ACTOR.WEBHOOK,
          actorId: null,
          reason: `Paytm payment captured (TXNID: ${params.TXNID}, mode: ${params.PAYMENTMODE ?? "UPI"})`,
        });
      }
    } else if (params.STATUS === "TXN_FAILURE") {
      if (order.status === ORDER_STATUS.PAYMENT_PENDING) {
        await transitionOrder({
          orderId: order._id,
          to: ORDER_STATUS.PAYMENT_FAILED,
          actor: ACTOR.WEBHOOK,
          actorId: null,
          reason: `Paytm payment failed: ${params.RESPMSG || "Transaction rejected"}`,
        });
      }
    }

    return respond(request, order._id, { ok: true, status: params.STATUS });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function respond(request: Request, orderId: string, data: Record<string, unknown>): Response {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/orders/${orderId}`, request.url), 303);
  }
  return NextResponse.json(data);
}
