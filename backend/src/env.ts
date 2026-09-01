import { z } from "zod";

import { formatEnvError, optional } from "@trefood/shared";

/**
 * The backend's environment. Every secret in TREFOOD lives here and nowhere else.
 *
 * This is the main security win of splitting the services: the Razorpay secret, the
 * webhook secret, the Supabase service-role key and the Mongo URI now live in a
 * process the browser cannot reach. There is no bundler step that could leak them and
 * no `NEXT_PUBLIC_` prefix to get wrong.
 *
 * Validation is eager — importing this module throws — and `src/index.ts` imports it
 * before it binds a port. A missing secret therefore kills the container at boot with
 * every problem listed at once, rather than surfacing at 1 AM inside a webhook
 * handler. docs/PHASES.md Phase 0.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  /**
   * Browser origins allowed to call this API, comma-separated. Not a formality: the
   * frontend is now a different origin, so every student, vendor and admin request is
   * cross-origin and CORS is the only thing deciding who may send credentials.
   */
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)),

  // ── Database ────────────────────────────────────────────────
  MONGODB_URI: z.string().startsWith("mongodb"),
  MONGODB_DB: z.string().min(1).default("trefood"),

  // ── Supabase ────────────────────────────────────────────────
  // The backend verifies the JWT the frontend obtained, and uses the service-role key
  // for storage writes. The anon key never gives this service any authority.
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // ── Razorpay ────────────────────────────────────────────────
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),

  // ── Web Push ────────────────────────────────────────────────
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().startsWith("mailto:"),

  // ── Cron protection ─────────────────────────────────────────
  // Guards every /cron/* route: a shared secret, not obscurity.
  // docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §10.7. The 32-character floor stops a
  // short placeholder from quietly becoming the production value.
  CRON_SECRET: z.string().min(32, "must be at least 32 characters of real entropy"),

  // ── Observability (optional: absent means no reporting, not a dead service) ──
  SENTRY_DSN: optional(z.url()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(formatEnvError("backend", parsed.error));
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
