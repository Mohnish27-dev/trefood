import { NextResponse, type NextRequest } from "next/server";

import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE,
  canonicalOrigin,
  isGoogleConfigured,
  startGoogleFlow,
} from "@/server/auth/google";
import { serverEnv } from "@/lib/env";

/**
 * Begins Google sign-in.
 *
 * A plain GET the button links to, rather than a Server Action, for one
 * reason: the response is a redirect to a third-party origin, and the browser
 * has to follow it as a top-level navigation. This also means the button keeps
 * working with JavaScript still loading, which the old client-side handler did not.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = canonicalOrigin();

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${origin}/signin?reason=google_unavailable`);
  }

  const params = request.nextUrl.searchParams;

  const requested = params.get("next");
  // Only a local path survives. `//evil.example` and `https://…` are dropped
  // here rather than at the callback, so an open redirect never even reaches
  // the state cookie that the callback trusts.
  const next = requested && /^\/(?!\/)/.test(requested) ? requested : null;

  // Set by the callback when it found no state cookie. Only the one value is
  // honoured, so nothing can push the attempt counter past the retry ceiling.
  const attempt = params.get("attempt") === "2" ? 2 : 1;

  /**
   * The cookie has to be set on the host Google will send the browser back to.
   *
   * `redirect_uri` is built from NEXT_PUBLIC_APP_URL because Google matches it
   * byte for byte. If this request arrived on any other host — the apex where
   * only `www` is canonical, a bare IP, a preview domain — the cookie lands on
   * that host and the callback, which happens on the canonical one, never sees
   * it. That fails the first attempt and then appears to fix itself, because
   * the error page itself is served from the canonical origin and the second
   * attempt therefore starts from the right host.
   *
   * Bouncing to the canonical origin first costs one redirect and removes the
   * whole class. `canon` stops it bouncing twice if a proxy rewrites the host
   * in a way that can never match.
   */
  const servedHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .toLowerCase()
    .trim();
  const canonicalHost = new URL(origin).host.toLowerCase();

  if (servedHost && servedHost !== canonicalHost && params.get("canon") !== "1") {
    const canonical = new URL("/api/auth/google/start", origin);
    if (next) canonical.searchParams.set("next", next);
    if (attempt === 2) canonical.searchParams.set("attempt", "2");
    canonical.searchParams.set("canon", "1");
    return NextResponse.redirect(canonical);
  }

  const { url, stateCookieValue } = startGoogleFlow(next, attempt);

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_STATE_COOKIE, stateCookieValue, {
    httpOnly: true,
    // Google's redirect back is a cross-site top-level GET, and `strict` would
    // withhold the cookie on exactly that request — the flow would always fail.
    sameSite: "lax",
    path: "/",
    maxAge: GOOGLE_STATE_MAX_AGE,
    secure: serverEnv().NODE_ENV === "production",
  });

  return response;
}
