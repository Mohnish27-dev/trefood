import "server-only";

import { z } from "zod";

import { formatEnvError } from "@/lib/env-error";

/**
 * SERVER-ONLY environment. Every value here is a secret.
 *
 * `import "server-only"` at the top means any Client Component that reaches this
 * module fails the build with a readable error, instead of shipping a Razorpay
 * secret in the JS bundle. docs/PROJECT_STRUCTURE.md §5.
 *
 * This module validates *eagerly*, at import time, and is imported by
 * `src/instrumentation.ts` — so a missing secret crashes the server at boot with a
 * list of what is missing. That is deliberate: discovering an unset
 * RAZORPAY_WEBHOOK_SECRET at 1 AM during a payment surge is not the moment to learn
 * it was never set. docs/PHASES.md Phase 0.
 */
const serverEnvSchema = z.object({
  // ── Database ────────────────────────────────────────────────
  MONGODB_URI: z.string().startsWith("mongodb"),
  MONGODB_DB: z.string().min(1).default("trefood"),

  // ── Supabase: auth + image storage ──────────────────────────
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // ── Razorpay ────────────────────────────────────────────────
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),

  // ── Web Push ────────────────────────────────────────────────
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().startsWith("mailto:"),

  // ── Cron protection ─────────────────────────────────────────
  // Guards every /api/cron/* route: a shared secret, not obscurity.
  // docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §10.7. The 32-character floor stops a
  // short placeholder from quietly becoming the production value.
  CRON_SECRET: z.string().min(32, "must be at least 32 characters of real entropy"),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(formatEnvError("server", parsed.error));
}

export const serverEnv = parsed.data;
