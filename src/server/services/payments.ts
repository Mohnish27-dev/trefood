import "server-only";

import { serverEnv } from "@/lib/env";
import type { Paise } from "@/lib/money";

/**
 * The payment seam.
 *
 * This is the ONE place the prototype differs from production. `StubProvider`
 * captures instantly instead of calling Razorpay, so the whole ordering flow
 * is demonstrable with no gateway account. Phase 9 adds `RazorpayProvider`
 * behind this identical interface and flips PAYMENT_PROVIDER — no call site
 * changes.
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
  readonly name: "stub" | "razorpay";
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
/* Razorpay — Phase 9                                                  */
/* ------------------------------------------------------------------ */

const razorpayProvider: PaymentProvider = {
  name: "razorpay",

  createIntent: async () => {
    throw new Error("Razorpay provider is not wired yet (Phase 9). Set PAYMENT_PROVIDER=stub.");
  },

  refund: async () => {
    throw new Error("Razorpay provider is not wired yet (Phase 9). Set PAYMENT_PROVIDER=stub.");
  },
};

export function paymentProvider(): PaymentProvider {
  return serverEnv().PAYMENT_PROVIDER === "razorpay" ? razorpayProvider : stubProvider;
}
