import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy — what earlier versions of Next called middleware.
 *
 * This is an OPTIMISTIC check and nothing more. It knows only whether a
 * session cookie exists; it cannot see the role, because resolving one means a
 * database read and this runs before every matched request.
 *
 * The real gate is in three places that all still fire:
 *
 *   1. the route-group layouts, which resolve the session and redirect
 *   2. `requireVendor()` / `requireAdmin()` inside every service call
 *   3. every Server Action, which re-checks role AND resource ownership
 *
 * PRD Part 4.9 states the rule this file must never be mistaken for breaking:
 * middleware alone is not authorisation. What it buys is a redirect that
 * happens before a server render rather than after one — a nicety for a person
 * who followed a stale bookmark, and no defence at all against anyone who
 * forges a cookie.
 */

const SESSION_COOKIE = "trefood_demo_user";

/**
 * Route groups that are pointless to render without any session at all.
 *
 * `/account` is deliberately NOT here. It renders its own explanation for a
 * signed-out visitor — "browsing needs no account, sign in when you want to
 * order" — which is the honest message for a product where auth is required
 * only at checkout. Bouncing someone to a login wall for tapping the account
 * tab teaches them the opposite.
 */
const GUARDED = [/^\/vendor(\/|$)/, /^\/admin(\/|$)/, /^\/checkout(\/|$)/];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (!GUARDED.some((pattern) => pattern.test(pathname))) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const signIn = new URL("/signin", request.url);
  signIn.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Static assets, the service worker and API routes are deliberately excluded:
  // an API route answers with 401 JSON, which a fetch can handle, whereas a
  // redirect to an HTML sign-in page would arrive as an unparseable response.
  matcher: ["/vendor/:path*", "/admin/:path*", "/checkout/:path*"],
};
