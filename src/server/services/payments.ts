import "server-only";

import { serverEnv } from "@/lib/env";
import { type Paise, rupeesToPaise } from "@/lib/money";
import PaytmChecksum from "paytmchecksum";

export interface PaymentIntent {
  providerOrderId: string;
  amountPaise: Paise;
  currency: "INR";
  /** Non-null only for the stub: production never captures without a webhook. */
  autoCapturedPaymentId: string | null;
  /** Paytm transaction token for Checkout JS (dynamic QR and UPI intent) */
  txnToken?: string | null;
  mid?: string | null;
}

export interface PaymentProvider {
  readonly name: "stub" | "phonepe" | "paytm";
  createIntent(params: {
    orderId: string;
    orderNumber: string;
    amountPaise: Paise;
    customerName: string;
    customerPhone: string;
  }): Promise<PaymentIntent>;
  refund(params: { paymentId: string; amountPaise: Paise; reason: string; orderNumber?: string }): Promise<{
    refundId: string;
    status: "PROCESSED" | "PENDING" | "FAILED";
  }>;
  checkStatus?(params: { orderNumber: string }): Promise<{
    status: "SUCCESS" | "PENDING" | "FAILED";
    paymentId?: string | undefined;
    amountPaise?: Paise | undefined;
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
    autoCapturedPaymentId: `stub_pay_${orderId}`,
  }),

  refund: async ({ paymentId }) => ({
    refundId: `stub_refund_${paymentId}`,
    status: "PROCESSED",
  }),
};

/* ------------------------------------------------------------------ */
/* PhonePe — D8.                                                      */
/* ------------------------------------------------------------------ */

const phonepeProvider: PaymentProvider = {
  name: "phonepe",

  createIntent: async () => {
    throw new Error(
      "The PhonePe provider is not wired yet — merchant registration is pending. Keep PAYMENT_PROVIDER=stub or paytm in .env.local.",
    );
  },

  refund: async () => {
    throw new Error(
      "The PhonePe provider is not wired yet — merchant registration is pending. Keep PAYMENT_PROVIDER=stub or paytm in .env.local.",
    );
  },
};

/* ------------------------------------------------------------------ */
/* Paytm — Dynamic QR + UPI Intent via Standard Checkout JS           */
/* ------------------------------------------------------------------ */

function getPaytmHost(): string {
  const env = serverEnv();
  return env.PAYTM_ENVIRONMENT === "production"
    ? "https://securegw.paytm.in"
    : "https://securegw-stage.paytm.in";
}

function paiseToPaytmAmount(paise: Paise): string {
  const whole = Math.floor(paise / 100);
  const rem = Math.abs(paise % 100);
  return `${whole}.${rem.toString().padStart(2, "0")}`;
}

const paytmProvider: PaymentProvider = {
  name: "paytm",

  createIntent: async ({ orderId, orderNumber, amountPaise, customerPhone }) => {
    const env = serverEnv();
    const mid = env.PAYTM_MID ?? "";
    const merchantKey = env.PAYTM_MERCHANT_KEY ?? "";
    const website = env.PAYTM_WEBSITE ?? (env.PAYTM_ENVIRONMENT === "production" ? "DEFAULT" : "WEBSTAGING");
    const host = getPaytmHost();
    const callbackUrl =
      env.PAYTM_CALLBACK_URL ??
      `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/webhooks/paytm`;

    const valueRupees = paiseToPaytmAmount(amountPaise);
    const custId = customerPhone.replace(/\D/g, "") || `CUST_${orderId.slice(-8)}`;

    const paytmParams = {
      body: {
        requestType: "Payment",
        mid,
        websiteName: website,
        orderId: orderNumber,
        callbackUrl,
        txnAmount: {
          value: valueRupees,
          currency: "INR",
        },
        userInfo: {
          custId,
        },
      },
      head: {
        signature: "",
      },
    };

    const signature = await PaytmChecksum.generateSignature(
      JSON.stringify(paytmParams.body),
      merchantKey,
    );
    paytmParams.head.signature = signature;

    const response = await fetch(
      `${host}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(mid)}&orderId=${encodeURIComponent(orderNumber)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paytmParams),
      },
    );

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error(
          `Paytm gateway is temporarily unavailable (HTTP 503). ${
            env.PAYTM_ENVIRONMENT === "staging"
              ? "Paytm Staging environment (securegw-stage.paytm.in) is currently undergoing maintenance on Paytm's end. Once production keys are approved, switch to PAYTM_ENVIRONMENT=production."
              : "Paytm production server is temporarily busy. Please retry in a moment."
          }`,
        );
      }
      throw new Error(`Paytm initiateTransaction HTTP error: ${response.status}`);
    }

    const resData = (await response.json()) as {
      body?: {
        resultInfo?: { resultStatus?: string; resultMsg?: string; resultCode?: string };
        txnToken?: string;
      };
    };

    const resultInfo = resData.body?.resultInfo;
    if (resultInfo?.resultStatus !== "S" || !resData.body?.txnToken) {
      const resultCode = resultInfo?.resultCode ?? "unknown";
      if (resultCode === "501") {
        throw new Error(
          `Paytm ${env.PAYTM_ENVIRONMENT} gateway returned System Error (code 501). ` +
            "The transaction token was not created. Verify that this MID, merchant key, and website name belong to the same Paytm environment; if they do, retry later or contact Paytm because this response originates from their gateway.",
        );
      }
      throw new Error(
        `Paytm transaction token generation failed (code ${resultCode}): ${resultInfo?.resultMsg ?? "Unknown error"}`,
      );
    }

    return {
      providerOrderId: orderNumber,
      amountPaise,
      currency: "INR",
      autoCapturedPaymentId: null,
      txnToken: resData.body.txnToken,
      mid,
    };
  },

  refund: async ({ paymentId, amountPaise, reason, orderNumber }) => {
    const env = serverEnv();
    const mid = env.PAYTM_MID ?? "";
    const merchantKey = env.PAYTM_MERCHANT_KEY ?? "";
    const host = getPaytmHost();

    const refId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const refundAmount = paiseToPaytmAmount(amountPaise);

    const paytmParams = {
      body: {
        mid,
        txnType: "REFUND",
        orderId: orderNumber ?? paymentId,
        txnId: paymentId,
        refId,
        refundAmount,
        comments: reason.slice(0, 100),
      },
      head: {
        signature: "",
      },
    };

    const signature = await PaytmChecksum.generateSignature(
      JSON.stringify(paytmParams.body),
      merchantKey,
    );
    paytmParams.head.signature = signature;

    const response = await fetch(`${host}/refund/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paytmParams),
    });

    if (!response.ok) {
      throw new Error(`Paytm refund HTTP error: ${response.status}`);
    }

    const resData = (await response.json()) as {
      body?: {
        resultInfo?: { resultStatus?: string; resultMsg?: string };
        refundId?: string;
      };
    };

    const status = resData.body?.resultInfo?.resultStatus;
    if (status === "TXN_SUCCESS") {
      return { refundId: resData.body?.refundId ?? refId, status: "PROCESSED" };
    }
    if (status === "PENDING") {
      return { refundId: resData.body?.refundId ?? refId, status: "PENDING" };
    }

    throw new Error(
      `Paytm refund failed: ${resData.body?.resultInfo?.resultMsg ?? "Unknown error"}`,
    );
  },

  checkStatus: async ({ orderNumber }) => {
    const env = serverEnv();
    const mid = env.PAYTM_MID ?? "";
    const merchantKey = env.PAYTM_MERCHANT_KEY ?? "";
    const host = getPaytmHost();

    const paytmParams = {
      body: { mid, orderId: orderNumber },
      head: { signature: "" },
    };

    const signature = await PaytmChecksum.generateSignature(
      JSON.stringify(paytmParams.body),
      merchantKey,
    );
    paytmParams.head.signature = signature;

    const response = await fetch(`${host}/v3/order/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paytmParams),
    });

    if (!response.ok) {
      return { status: "PENDING" };
    }

    const resData = (await response.json()) as {
      body?: {
        resultInfo?: { resultStatus?: string };
        txnId?: string;
        txnAmount?: string;
      };
    };

    const resStatus = resData.body?.resultInfo?.resultStatus;
    if (resStatus === "TXN_SUCCESS") {
      return {
        status: "SUCCESS",
        paymentId: resData.body?.txnId,
        amountPaise: resData.body?.txnAmount ? rupeesToPaise(Number(resData.body.txnAmount)) : undefined,
      };
    }
    if (resStatus === "TXN_FAILURE") {
      return { status: "FAILED" };
    }

    return { status: "PENDING" };
  },
};

export function paymentProvider(): PaymentProvider {
  const provider = serverEnv().PAYMENT_PROVIDER;
  if (provider === "paytm") return paytmProvider;
  if (provider === "phonepe") return phonepeProvider;
  return stubProvider;
}

