import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy — what earlier versions of Next called middleware.
 *
 * This is an OPTIMISTIC check: does this browser carry any credential at all?
 * It is deliberately a cookie-presence test and nothing more. It used to call
 * out to the hosted auth provider to validate a token on every guarded
 * request, which put a third-party network round trip in front of the vendor
 * board — a board that polls every five seconds.
 *
 * Nothing here decides anything. The real gate remains in three places that
 * all still fire, and all of them read the session from the database:
 *   1. the route-group layouts, which resolve the session and redirect
 *   2. `requireVendor()` / `requireAdmin()` inside every service call
 *   3. every Server Action, which re-checks role AND resource ownership
 *
 * A forged cookie therefore buys a render that immediately redirects, never
 * data. That is the property that makes the cheap check safe.
 */

const SESSION_COOKIE = "trefood_session";
const DEMO_SESSION_COOKIE = "trefood_demo_user";
/** Pre-unification vendor sign-in. Nothing mints one now; some are still live. */
const VENDOR_SESSION_COOKIE = "trefood_vendor_session";
/**
 * Minted only after the server has verified a 4-digit PIN or the registered
 * biometric credential. Listed here for the same reason the others are: the
 * gate below is optimistic, and leaving it out would redirect a legitimately
 * quick-unlocked student off /checkout and back to the PIN screen — the
 * unlock loop, one layer up.
 */
const QUICK_UNLOCK_SESSION_COOKIE = "trefood_quick_session";

const CREDENTIAL_COOKIES = [
  SESSION_COOKIE,
  DEMO_SESSION_COOKIE,
  VENDOR_SESSION_COOKIE,
  QUICK_UNLOCK_SESSION_COOKIE,
] as const;

/**
 * Route groups that are pointless to render without any session at all.
 * `/account` is deliberately NOT here: it renders its own explanation for
 * a signed-out visitor.
 */
const GUARDED = [/^\/vendor(\/|$)/, /^\/admin(\/|$)/, /^\/checkout(\/|$)/];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  const response = NextResponse.next({ request: { headers: request.headers } });

  // A Server Action posts to the page it came from, so a redirect here would
  // answer a mutation with a document. The action re-checks auth itself.
  if (request.headers.has("next-action")) return response;

  if (!GUARDED.some((pattern) => pattern.test(pathname))) return response;

  const hasCredential = CREDENTIAL_COOKIES.some((name) => request.cookies.has(name));
  if (hasCredential) return response;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const signIn = new URL("/signin", origin);
  signIn.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/vendor/:path*", "/admin/:path*", "/checkout/:path*"],
};
