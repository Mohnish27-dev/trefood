import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import { env } from "@/lib/env";

// Browser runtime. Next.js loads this file automatically before hydration.

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  // A student's name, phone, and gate code must never leave the device via telemetry.
  sendDefaultPii: false,
  enabled: Boolean(env.NEXT_PUBLIC_SENTRY_DSN),
});

if (env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    // Funnels are the point (docs/PHASES.md Phase 14). Session replay is not, and it
    // would capture the gate code on screen.
    disable_session_recording: true,
    person_profiles: "identified_only",
    capture_pageview: true,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
