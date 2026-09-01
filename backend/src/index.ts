import * as Sentry from "@sentry/node";

/**
 * Boot order matters, and this is it:
 *
 *   1. Import `./env.js` — validates eagerly and throws, so a missing secret kills
 *      the container here rather than inside a webhook handler at 1 AM.
 *   2. Start Sentry, so anything that fails after this point is reported.
 *   3. Open the Mongo pool.
 *   4. Only then bind the port.
 *
 * Step 4 comes last on purpose: a container that accepts traffic before its database
 * pool is open serves 500s to real students during every deploy.
 */
import { env, isProduction } from "./env.js";
import { createApp } from "./app.js";
import { closeDb, connectDb } from "./db/client.js";

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  // Money paths are low-volume and high-value: sample everything until traffic says otherwise.
  tracesSampleRate: 1.0,
  // Order payloads carry a student's name, phone, and gate code. Never ship them out.
  sendDefaultPii: false,
  enabled: Boolean(env.SENTRY_DSN),
});

async function main(): Promise<void> {
  await connectDb();

  const server = createApp().listen(env.PORT, () => {
    console.info(
      `[trefood] backend listening on :${env.PORT} · env=${env.NODE_ENV} · ` +
        `db=${env.MONGODB_DB} · razorpay=${env.RAZORPAY_KEY_ID.startsWith("rzp_live") ? "LIVE" : "test"} · ` +
        `cors=${env.CORS_ORIGINS.join(",")}`,
    );
  });

  /**
   * Graceful shutdown. Docker sends SIGTERM and waits ~10s before SIGKILL. Draining
   * in-flight requests before closing the Mongo pool means a deploy cannot sever an
   * order transition halfway through and leave the audit trail with a hole in it.
   */
  const shutdown = (signal: string) => {
    console.info(`[trefood] ${signal} received, draining...`);
    server.close(async () => {
      await closeDb();
      console.info("[trefood] shutdown complete");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[trefood] drain timed out, forcing exit");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  console.error("[trefood] failed to start", error);
  if (!isProduction) console.error(error);
  process.exit(1);
});
