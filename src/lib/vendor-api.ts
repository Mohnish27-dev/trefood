import type { VendorActionState } from "@/server/actions/vendor";

/** End the session without re-rendering the vendor layout after cookie deletion. */
export async function signOutVendor(): Promise<VendorActionState> {
  try {
    const response = await fetch("/api/vendor/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const result: unknown = await response.json();
    if (typeof result === "object" && result !== null && "status" in result) {
      if (response.ok && result.status === "ok") {
        const message = "message" in result && typeof result.message === "string" ? result.message : undefined;
        return message ? { status: "ok", message } : { status: "ok" };
      }
      if (result.status === "error" && "message" in result && typeof result.message === "string") {
        return { status: "error", message: result.message };
      }
    }
  } catch {
    // Network failures, timeouts, and non-JSON proxy errors all release the UI.
  }
  return { status: "error", message: "Could not complete the request. Check your connection and retry." };
}

