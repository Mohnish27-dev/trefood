import "server-only";

import { serverEnv } from "@/lib/env";
import type { Paise } from "@/lib/money";

/**
 * The payment seam.
 *
 * This is the ONE place the app differs from its final money path.
 * `StubProvider` captures instantly instead of calling a gateway, so the
 * whole ordering flow runs end to end while the merchant account is being
 * provisioned. D8 chose PhonePe (merchant business account, dynamic QR +
 * UPI, money credited directly to the business bank account); when the
 * merchant registration clears, `PhonePeProvider` lands behind this
 * identical interface and PAYMENT_PROVIDER flips — no call site changes.
 *
 * Everything else about the money path is already production code: the amount
 * charged comes from `computePricing`, the order is created PAYMENT_PENDING
 * before the gateway opens (so an abandoned payment is traceable, F1/F2), and
 * promotion to PLACED happens through the FSM.
 */

export interface PaymentIntent {
  providerOrderId: string;
  amountPaise: Paise;
  currency: "INR";
  /** Non-null only for the stub: production never captures without a webhook. */
  autoCapturedPaymentId: string | null;
}

export interface PaymentProvider {
  readonly name: "stub" | "phonepe";
  createIntent(params: {
    orderId: string;
    orderNumber: string;
    amountPaise: Paise;
    customerName: string;
    customerPhone: string;
  }): Promise<PaymentIntent>;
  refund(params: { paymentId: string; amountPaise: Paise; reason: string }): Promise<{
    refundId: string;
    status: "PROCESSED" | "PENDING" | "FAILED";
  }>;
}

/* ------------------------------------------------------------------ */
/* Stub                                                                */
/* ------------------------------------------------------------------ */

const stubProvider: PaymentProvider = {
  name: "stub",

  createIntent: async ({ orderId, amountPaise }) => ({
    providerOrderId: `stub_order_${orderId}`,
    amountPaise,
    currency: "INR",
    // Captures immediately. In production this is null and the webhook
    // (or the reconciliation cron) is what promotes the order.
    autoCapturedPaymentId: `stub_pay_${orderId}`,
  }),

  refund: async ({ paymentId }) => ({
    refundId: `stub_refund_${paymentId}`,
    status: "PROCESSED",
  }),
};

/* ------------------------------------------------------------------ */
/* PhonePe — D8. Wired once the merchant registration clears.          */
/* ------------------------------------------------------------------ */

/**
 * The integration shape is already decided:
 *
 *   createIntent -> PhonePe dynamic QR / UPI intent for the order amount,
 *                   money settles directly into the business bank account
 *   refund       -> PhonePe refund API against the captured payment
 *   webhook      -> signature verified with PHONEPE_WEBHOOK_SECRET, event id
 *                   inserted into `webhookEvents` (unique index) BEFORE it
 *                   promotes the order through the FSM — exactly once
 *
 * Credentials live in PHONEPE_MERCHANT_ID / PHONEPE_MERCHANT_SECRET /
 * PHONEPE_WEBHOOK_SECRET, and `env.ts` refuses to boot PAYMENT_PROVIDER=phonepe
 * until all three are present.
 */
const phonepeProvider: PaymentProvider = {
  name: "phonepe",

  createIntent: async () => {
    throw new Error(
      "The PhonePe provider is not wired yet — merchant registration is pending. Keep PAYMENT_PROVIDER=stub until the merchant credentials are in .env.local.",
    );
  },

  refund: async () => {
    throw new Error(
      "The PhonePe provider is not wired yet — merchant registration is pending. Keep PAYMENT_PROVIDER=stub until the merchant credentials are in .env.local.",
    );
  },
};

export function paymentProvider(): PaymentProvider {
  return serverEnv().PAYMENT_PROVIDER === "phonepe" ? phonepeProvider : stubProvider;
}
