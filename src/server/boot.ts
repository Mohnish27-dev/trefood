import "server-only";

import { serverEnv } from "@/lib/env.server";

/**
 * Boot-time checks. Imported by `src/instrumentation.ts` on the Node runtime only.
 *
 * Importing `serverEnv` is not a formality — that module validates eagerly, so the
 * import itself throws if any secret is missing or malformed, and the process dies
 * with every problem listed at once. docs/PHASES.md Phase 0.
 *
 * The database is deliberately NOT pinged here. Boot must not depend on a network
 * round-trip to Atlas: a transient DNS blip would turn a healthy deploy into a crash
 * loop. Connectivity is checked on demand at /api/health instead.
 */
const runtime = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";

console.info(
  `[trefood] boot ok · env=${runtime} · db=${serverEnv.MONGODB_DB} · ` +
    `razorpay=${serverEnv.RAZORPAY_KEY_ID.startsWith("rzp_live") ? "LIVE" : "test"}`,
);
