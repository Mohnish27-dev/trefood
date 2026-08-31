import { z } from "zod";

import { formatEnvError } from "@/lib/env-error";

/**
 * PUBLIC environment. Safe to import from a Client Component.
 *
 * Server-only secrets live in `env.server.ts`, which is marked `server-only` so
 * importing it from the client is a build error rather than a leak.
 * See docs/PROJECT_STRUCTURE.md §5.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),

  NEXT_PUBLIC_APP_URL: z.url(),

  // Observability degrades gracefully: no DSN means no reporting, not a dead app.
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.url().default("https://app.posthog.com"),
});

/**
 * Every value below is read as a *literal* `process.env.NEXT_PUBLIC_X` expression.
 * Next.js inlines these into the client bundle by textual substitution — a dynamic
 * lookup like `process.env[key]` is NOT inlined and would be `undefined` in the
 * browser. Do not refactor this object into a loop.
 */
const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});

if (!parsed.success) {
  throw new Error(formatEnvError("public", parsed.error));
}

export const env = parsed.data;
