import * as Sentry from "@sentry/nextjs";

// Server runtime (Node). Loaded from src/instrumentation.ts.
// An absent DSN makes every Sentry call a no-op, so local development needs no account.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Money paths are low-volume and high-value: sample everything until traffic says otherwise.
  tracesSampleRate: 1.0,
  // Order payloads carry a student's name and phone. Never ship them to a third party.
  sendDefaultPii: false,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
