import * as Sentry from "@sentry/nextjs";

/**
 * Server boot for the Next.js render server.
 *
 * Much smaller than it was before the split: there is no database to reach and no
 * secret to validate here any more. The frontend's own environment is checked by
 * `src/lib/env.ts` at import time, and every secret in TREFOOD now lives in the
 * backend service.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Routes uncaught Server Component / Route Handler errors to Sentry.
export const onRequestError = Sentry.captureRequestError;
