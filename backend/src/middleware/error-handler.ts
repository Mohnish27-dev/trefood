import * as Sentry from "@sentry/node";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { isProduction } from "../env.js";

/** 404 for anything the router did not match. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ ok: false, error: "Not found", path: req.path });
};

/**
 * The single error boundary. Express 5 forwards rejected promises here automatically,
 * so route handlers do not need their own try/catch.
 *
 * Two rules:
 *   - A Zod failure is a 400 with the field list. The client sent something wrong and
 *     deserves to know what.
 *   - Anything else is a 500 with a generic message in production. Internal messages
 *     can carry collection names, query shapes, and occasionally a connection string.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: "Invalid request",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  Sentry.captureException(error);
  console.error("[trefood] unhandled error", error);

  res.status(500).json({
    ok: false,
    error:
      isProduction || !(error instanceof Error)
        ? "Internal server error"
        : error.message,
  });
};
