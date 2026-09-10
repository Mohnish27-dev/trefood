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

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    MONGODB_DB: z.string().min(1).default("trefood"),
    MONGODB_MAX_POOL_SIZE: intFromString(10),

    AUTH_PROVIDER: z.enum(["stub", "trefood"]).default("trefood"),

    /* ── Google sign-in (Google Cloud console, Web application client) ── */
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,

    /* ── Outbound mail: the Zoho mailbox on the trefood.in domain ──────── */
    SMTP_HOST: z.string().default("smtp.zoho.in"),
    SMTP_PORT: intFromString(465),
    /** 465 is implicit TLS; 587 is STARTTLS. Derived, never guessed. */
    SMTP_SECURE: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v === "" ? undefined : v === "true" || v === "1")),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    /** The From address. Zoho refuses to send as an address the mailbox does not own. */
    MAIL_FROM: z.string().default("TREFOOD <no-reply@trefood.in>"),

    /**
     * Development escape hatch. With no SMTP credentials configured, codes are
     * printed to the server log instead of emailed, so the whole flow is
     * walkable on a laptop. Refused in production by the check below.
     */
    MAIL_TRANSPORT: z.enum(["smtp", "console"]).default("smtp"),

    // No payment-gateway configuration: TREFOOD is cash on delivery end to
    // end, and nothing in the order flow talks to a gateway. If online payment
    // is ever switched back on, the provider seam and its secrets come back
    // here together.

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
    // Mail is not optional once TREFOOD owns its own authentication: without a
    // working mailbox nobody can verify an address or reset a password, and a
    // sign-up screen that silently drops its codes is worse than one that is
    // switched off. So the credentials are demanded the moment the console
    // fallback is not in play.
    if (env.MAIL_TRANSPORT === "smtp") {
      if (!env.SMTP_USER) {
        ctx.addIssue({ code: "custom", path: ["SMTP_USER"], message: "required when MAIL_TRANSPORT=smtp" });
      }
      if (!env.SMTP_PASSWORD) {
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_PASSWORD"],
          message: "required when MAIL_TRANSPORT=smtp (use a Zoho app-specific password)",
        });
      }
    }
    if (env.NODE_ENV === "production" && env.MAIL_TRANSPORT === "console") {
      ctx.addIssue({
        code: "custom",
        path: ["MAIL_TRANSPORT"],
        message: "console mail prints verification codes to the log; it cannot reach production",
      });
    }
    // Google sign-in is a button on the sign-in screen, so a half-configured
    // client would render an option that dead-ends on Google's error page.
    if ((env.GOOGLE_CLIENT_ID && !env.GOOGLE_CLIENT_SECRET) || (!env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_SECRET"],
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
      });
    }
    if (env.NODE_ENV === "production" && env.AUTH_PROVIDER === "stub") {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_PROVIDER"],
        message: "stub auth performs no credential check; set AUTH_PROVIDER=trefood",
      });
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
  /** Present when Google sign-in is configured, so the button can be hidden if not. */
  NEXT_PUBLIC_GOOGLE_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
  NEXT_PUBLIC_SENTRY_DSN: optionalString,
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: z.string().default("https://app.posthog.com"),
  NEXT_PUBLIC_POLL_VENDOR_MS: intFromString(5_000),
  NEXT_PUBLIC_POLL_STUDENT_MS: intFromString(8_000),
  NEXT_PUBLIC_POLL_ADMIN_MS: intFromString(10_000),

  // Support channels shown on the account screens. Unset means the channel is
  // not offered — better a missing row than a published number nobody answers.
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().default("tregoinworks@gmail.com"),
  /** Digits only, with country code, e.g. 919876543210. */
  NEXT_PUBLIC_SUPPORT_WHATSAPP: optionalString,
  NEXT_PUBLIC_SUPPORT_PHONE: optionalString,
});

// Literal references: Next inlines these at build time.
const rawClientEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_ENABLED,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_POLL_VENDOR_MS: process.env.NEXT_PUBLIC_POLL_VENDOR_MS,
  NEXT_PUBLIC_POLL_STUDENT_MS: process.env.NEXT_PUBLIC_POLL_STUDENT_MS,
  NEXT_PUBLIC_POLL_ADMIN_MS: process.env.NEXT_PUBLIC_POLL_ADMIN_MS,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_SUPPORT_WHATSAPP: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
  NEXT_PUBLIC_SUPPORT_PHONE: process.env.NEXT_PUBLIC_SUPPORT_PHONE,
};

/** Validated public environment. Safe to import from a Client Component. */
export const clientEnv = clientSchema.parse(rawClientEnv);
