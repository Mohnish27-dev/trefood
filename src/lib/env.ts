/**
 * Environment validation.
 *
 * Fails loudly at boot rather than at 1 AM during a payment surge.
 * PROJECT_STRUCTURE.md section 5.
 *
 * Two schemas, deliberately separate:
 *
 *   serverEnv - secrets. Guarded by `import "server-only"` at every call site
 *               that reads a secret, so a Client Component importing one is a
 *               build error, not a leaked key.
 *
 *   clientEnv - NEXT_PUBLIC_* only. Every member is referenced as a literal
 *               `process.env.NEXT_PUBLIC_FOO` because Next inlines these at
 *               build time and a dynamic lookup would resolve to undefined.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

const intFromString = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : Number(v)))
    .pipe(z.number().int().positive());

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v?.trim()));

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined || v === null) return undefined;
    const cleaned = v.trim().replace(/^=+/, "").trim();
    return cleaned === "" ? undefined : cleaned;
  });

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    MONGODB_DB: z.string().min(1).default("trefood"),
    MONGODB_MAX_POOL_SIZE: intFromString(10),

    AUTH_PROVIDER: z.enum(["stub", "supabase"]).default("stub"),
    PAYMENT_PROVIDER: z.enum(["stub", "phonepe", "paytm"]).default("stub"),

    SUPABASE_SERVICE_ROLE_KEY: optionalString,

    // D8 — PhonePe merchant (dynamic QR + UPI, direct-to-bank settlement).
    PHONEPE_MERCHANT_ID: optionalString,
    PHONEPE_MERCHANT_SECRET: optionalString,
    PHONEPE_WEBHOOK_SECRET: optionalString,

    // Paytm merchant
    PAYTM_MID: optionalString,
    PAYTM_MERCHANT_KEY: optionalString,
    PAYTM_WEBSITE: z.string().default("WEBSTAGING"),
    PAYTM_ENVIRONMENT: z.enum(["staging", "production"]).default("staging"),
    PAYTM_CALLBACK_URL: optionalUrl,
    // Also parsed server-side so Docker runtime configuration is not replaced
    // by the NEXT_PUBLIC_APP_URL value that was inlined during `next build`.
    NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000").transform((v) => v.trim().replace(/^=+/, "").trim()),

    VAPID_PRIVATE_KEY: optionalString,
    VAPID_SUBJECT: z.string().default("mailto:ops@trefood.in"),

    CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
  })
  // Provider seams: a secret is only required once its provider is switched on.
  // This is what lets the prototype run with zero third-party credentials while
  // still refusing to boot a production config that is half-wired.
  .superRefine((env, ctx) => {
    if (env.AUTH_PROVIDER === "supabase" && !env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message: "required when AUTH_PROVIDER=supabase",
      });
    }
    if (env.PAYMENT_PROVIDER === "phonepe") {
      for (const key of ["PHONEPE_MERCHANT_ID", "PHONEPE_MERCHANT_SECRET", "PHONEPE_WEBHOOK_SECRET"] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: "required when PAYMENT_PROVIDER=phonepe" });
        }
      }
    }
    if (env.PAYMENT_PROVIDER === "paytm") {
      for (const key of ["PAYTM_MID", "PAYTM_MERCHANT_KEY"] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: "required when PAYMENT_PROVIDER=paytm" });
        }
      }
    }
    if (env.NODE_ENV === "production" && env.CRON_SECRET === "dev-only-change-me") {
      ctx.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "the development placeholder must not reach production",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | undefined;

/** Validated server environment. Throws with a readable report on first bad access. */
export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const report = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `\nTREFOOD could not start: the environment is invalid.\n\n${report}\n\n` +
        `Copy .env.local.example to .env.local and fill in the missing values.\n`,
    );
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000").transform((v) => v.trim().replace(/^=+/, "").trim()),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
  NEXT_PUBLIC_SENTRY_DSN: optionalString,
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: z.string().default("https://app.posthog.com"),
  NEXT_PUBLIC_POLL_VENDOR_MS: intFromString(5_000),
  NEXT_PUBLIC_POLL_STUDENT_MS: intFromString(8_000),
  NEXT_PUBLIC_POLL_ADMIN_MS: intFromString(10_000),
});

// Literal references: Next inlines these at build time.
const rawClientEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_POLL_VENDOR_MS: process.env.NEXT_PUBLIC_POLL_VENDOR_MS,
  NEXT_PUBLIC_POLL_STUDENT_MS: process.env.NEXT_PUBLIC_POLL_STUDENT_MS,
  NEXT_PUBLIC_POLL_ADMIN_MS: process.env.NEXT_PUBLIC_POLL_ADMIN_MS,
};

/** Validated public environment. Safe to import from a Client Component. */
export const clientEnv = clientSchema.parse(rawClientEnv);
