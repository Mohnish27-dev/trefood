import { NextResponse, type NextRequest } from "next/server";

import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE,
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
  const origin = serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${origin}/signin?reason=google_unavailable`);
  }

  const requested = request.nextUrl.searchParams.get("next");
  // Only a local path survives. `//evil.example` and `https://…` are dropped
  // here rather than at the callback, so an open redirect never even reaches
  // the state cookie that the callback trusts.
  const next = requested && /^\/(?!\/)/.test(requested) ? requested : null;

  const { url, stateCookieValue } = startGoogleFlow(next);

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
