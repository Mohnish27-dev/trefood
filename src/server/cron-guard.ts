import "server-only";

import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Cron authentication. PRD Part 4.8 — every scheduled route is protected by a
 * shared secret header.
 *
 * These routes cancel orders, issue refunds and write settlements. An
 * unauthenticated caller could expire every live order on the campus by
 * hitting one URL, so the guard is not optional and the comparison is
 * constant-time: a length-or-prefix leak on a long-lived secret is worth
 * closing for the two lines it costs.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. The
 * `x-cron-secret` header is accepted too, so any other scheduler can hit the
 * same routes without a code change.
 */
export function isAuthorisedCron(request: Request): boolean {
  const expected = serverEnv().CRON_SECRET;

  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret") ??
    "";

  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function unauthorisedCron(): Response {
  return Response.json({ error: "Unauthorised" }, { status: 401 });
}
