/**
 * Paytm credential + connectivity probe.
 *
 * Calls initiateTransaction directly with the configured credentials and
 * prints the RAW gateway response. This isolates "are the credentials and the
 * environment consistent" from every other moving part of checkout — no
 * database, no order, no browser.
 *
 * Usage:
 *   npm run paytm:diagnose
 */

import PaytmChecksum from "paytmchecksum";

import { serverEnv } from "@/lib/env";

interface PaytmResponse {
  body?: {
    resultInfo?: { resultStatus?: string; resultCode?: string; resultMsg?: string };
    txnToken?: string;
  };
}

function mask(secret: string): string {
  if (secret.length <= 4) return "*".repeat(secret.length);
  return `${secret.slice(0, 2)}${"*".repeat(secret.length - 4)}${secret.slice(-2)}`;
}

async function main(): Promise<void> {
  const env = serverEnv();

  const mid = env.PAYTM_MID ?? "";
  const merchantKey = env.PAYTM_MERCHANT_KEY ?? "";
  const website = env.PAYTM_WEBSITE;
  const host =
    env.PAYTM_ENVIRONMENT === "production"
      ? "https://securegw.paytm.in"
      : "https://securegw-stage.paytm.in";
  const callbackUrl =
    env.PAYTM_CALLBACK_URL ??
    `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/webhooks/paytm`;

  // Unique every run: a re-used orderId is itself a rejection cause, and that
  // must never be what this probe is measuring.
  const orderId = `DIAG${Date.now()}`;

  console.log("── Configuration ────────────────────────────────────");
  console.log(`  PAYTM_ENVIRONMENT : ${env.PAYTM_ENVIRONMENT}`);
  console.log(`  gateway host      : ${host}`);
  console.log(`  PAYTM_MID         : ${mid || "(EMPTY)"}  [len ${mid.length}]`);
  console.log(`  PAYTM_MERCHANT_KEY: ${mask(merchantKey)}  [len ${merchantKey.length}]`);
  console.log(`  PAYTM_WEBSITE     : ${website}`);
  console.log(`  callbackUrl       : ${callbackUrl}`);
  console.log(`  probe orderId     : ${orderId}`);

  // A staging key is 16 chars; a mangled one (shell ate the %, or the value was
  // truncated) shows up here rather than as an opaque 501 three screens later.
  if (merchantKey.length !== 16) {
    console.log(
      `\n  ⚠  merchant key is ${merchantKey.length} chars, expected 16 — check for a value mangled in transit.`,
    );
  }
  if (env.PAYTM_ENVIRONMENT === "staging" && website !== "WEBSTAGING") {
    console.log(`\n  ⚠  staging normally requires PAYTM_WEBSITE=WEBSTAGING, got "${website}".`);
  }
  if (callbackUrl.includes("localhost")) {
    console.log(`\n  ⚠  callbackUrl points at localhost — the webhook cannot reach you.`);
  }

  const body = {
    requestType: "Payment",
    mid,
    websiteName: website,
    orderId,
    callbackUrl,
    txnAmount: { value: "1.00", currency: "INR" },
    userInfo: { custId: "DIAG_CUST_001" },
  };

  const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), merchantKey);

  const url = `${host}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(mid)}&orderId=${encodeURIComponent(orderId)}`;

  console.log("\n── Request ──────────────────────────────────────────");
  console.log(`  POST ${url}`);
  console.log(`  body: ${JSON.stringify(body)}`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, head: { signature } }),
  });

  const text = await response.text();

  console.log("\n── Response ─────────────────────────────────────────");
  console.log(`  HTTP ${response.status} ${response.statusText}`);
  console.log(`  ${text}`);

  let parsed: PaytmResponse | null = null;
  try {
    parsed = JSON.parse(text) as PaytmResponse;
  } catch {
    console.log("\n  Response was not JSON — the gateway is likely serving an error page.");
    return;
  }

  const info = parsed?.body?.resultInfo;
  console.log("\n── Verdict ──────────────────────────────────────────");
  if (parsed?.body?.txnToken) {
    console.log("  ✓ Token created. Credentials, website name and environment all agree.");
    return;
  }

  console.log(`  ✗ No token. resultCode=${info?.resultCode ?? "?"} resultMsg="${info?.resultMsg ?? "?"}"`);

  const hints: Record<string, string> = {
    "330": "Checksum mismatch — the merchant key does not match the MID, or was mangled in transit.",
    "501": "Gateway-side system error. Most often the MID/key pair is split across environments, or Paytm staging is down. The resultMsg above is the authoritative detail.",
    "network_error": "Could not reach the gateway.",
  };
  const hint = hints[info?.resultCode ?? ""];
  if (hint) console.log(`  → ${hint}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
