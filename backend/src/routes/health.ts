import { Router } from "express";

import { pingDb } from "../db/client.js";

export const healthRoutes = Router();

/**
 * Liveness: is the process up? Deliberately does not touch Mongo — an orchestrator
 * must not restart a healthy container because Atlas had a two-second blip.
 */
healthRoutes.get("/health", (_req, res) => {
  res.json({ ok: true, service: "trefood-backend", at: new Date().toISOString() });
});

/**
 * Readiness: can this instance actually serve traffic? This one does ping Mongo, and
 * reports failure as 503 rather than masking it behind a 200.
 */
healthRoutes.get("/health/ready", async (_req, res) => {
  try {
    const db = await pingDb();
    res.json({ ok: true, service: "trefood-backend", db, at: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: "trefood-backend",
      error: error instanceof Error ? error.message : "Unknown database error",
      at: new Date().toISOString(),
    });
  }
});
