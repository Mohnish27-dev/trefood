import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { env } from "./env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRoutes } from "./routes/health.js";

/**
 * Builds the Express app. Separated from `index.ts` so tests can mount it without
 * binding a port or opening a database connection.
 */
export function createApp(): Express {
  const app = express();

  // Behind nginx / a load balancer, this is what makes req.ip the real client IP —
  // which the rate limits in docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §10.5 depend on.
  app.set("trust proxy", 1);

  app.disable("x-powered-by");
  app.use(helmet());

  /**
   * CORS. The frontend is a different origin now, so this is real access control
   * rather than boilerplate. `credentials: true` is required for the session cookie,
   * and it is exactly why the origin list is an explicit allowlist and never `*` —
   * the two settings are illegal together for a good reason.
   */
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );

  /**
   * JSON body parsing, with the raw body preserved.
   *
   * The Razorpay webhook (Phase 9) must verify an HMAC over the EXACT bytes Razorpay
   * signed. Re-serialising the parsed object changes key order and whitespace and the
   * signature stops matching — a bug that looks like a Razorpay outage. Capturing the
   * raw buffer here is what prevents it.
   */
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buffer) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    }),
  );

  app.use(healthRoutes);

  // Mounted in later phases (docs/PHASES.md):
  //   app.use("/api/v1", campusRoutes)     P7
  //   app.use("/api/v1", orderRoutes)      P10
  //   app.use("/webhooks", webhookRoutes)  P9  — signature-verified, idempotent
  //   app.use("/cron", cronRoutes)         P12 — CRON_SECRET header required

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
