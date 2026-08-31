import * as Sentry from "@sentry/nextjs";

/**
 * Server boot. Next.js calls `register()` once per runtime, before the first request.
 *
 * Two jobs, in this order:
 *   1. Start Sentry, so a boot failure is reported rather than lost.
 *   2. Validate the environment, so a missing secret kills the process here with a
 *      readable list — not at 1 AM inside a webhook handler.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    await import("./server/boot");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Routes uncaught Server Component / Route Handler errors to Sentry.
export const onRequestError = Sentry.captureRequestError;
