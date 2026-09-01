import { z } from "zod";

import { formatEnvError, optional, optionalWithDefault } from "@trefood/shared";

/**
 * The frontend's environment. Note what is NOT here any more: the Mongo URI, the
 * Razorpay secrets, the Supabase service-role key, and CRON_SECRET all moved to
 * `backend/src/env.ts`. This half of the system now holds nothing worth stealing.
 *
 * Everything below is a `NEXT_PUBLIC_` value that ships to the browser by design.
 */
const publicEnvSchema = z.object({
  /**
   * Base URL of the TREFOOD API. The single most important value in this file: it is
   * the seam between the two services.
   */
  NEXT_PUBLIC_API_URL: z.url(),

  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),

  NEXT_PUBLIC_APP_URL: z.url(),

  // Observability degrades gracefully: no DSN means no reporting, not a dead app.
  NEXT_PUBLIC_SENTRY_DSN: optional(z.url()),
  NEXT_PUBLIC_POSTHOG_KEY: optional(z.string().min(1)),
  NEXT_PUBLIC_POSTHOG_HOST: optionalWithDefault(z.url(), "https://app.posthog.com"),
});

/**
 * Every value below is read as a *literal* `process.env.NEXT_PUBLIC_X` expression.
 * Next.js inlines these into the client bundle by textual substitution — a dynamic
 * lookup like `process.env[key]` is NOT inlined and would be `undefined` in the
 * browser. Do not refactor this object into a loop.
 */
const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});

if (!parsed.success) {
  throw new Error(formatEnvError("frontend", parsed.error));
}

export const env = parsed.data;
