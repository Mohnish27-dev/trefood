import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy — what earlier versions of Next called middleware.
 *
 * This is an OPTIMISTIC check and session refresher. It checks whether a
 * session exists (either Supabase auth token or stub cookie) and refreshes
 * the Supabase session cookie across requests.
 *
 * The real gate remains in three places that all still fire:
 *   1. the route-group layouts, which resolve the session and redirect
 *   2. `requireVendor()` / `requireAdmin()` inside every service call
 *   3. every Server Action, which re-checks role AND resource ownership
 */

const DEMO_SESSION_COOKIE = "trefood_demo_user";
const VENDOR_SESSION_COOKIE = "trefood_vendor_session";
/**
 * Minted only after the server has verified a 4-digit PIN or the registered
 * biometric credential. Listed here for the same reason the others are: the
 * gate below is optimistic, and leaving it out would redirect a legitimately
 * quick-unlocked student off /checkout and back to the PIN screen — the
 * unlock loop, one layer up.
 */
const QUICK_UNLOCK_SESSION_COOKIE = "trefood_quick_session";

/**
 * Route groups that are pointless to render without any session at all.
 * `/account` is deliberately NOT here: it renders its own explanation for
 * a signed-out visitor.
 */
const GUARDED = [/^\/vendor(\/|$)/, /^\/admin(\/|$)/, /^\/checkout(\/|$)/];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const isGuarded = GUARDED.some((pattern) => pattern.test(pathname));

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let hasSupabaseUser = false;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSupabaseUser = !!user;
  }

  const hasDemoCookie = request.cookies.has(DEMO_SESSION_COOKIE);
  const hasVendorCookie = request.cookies.has(VENDOR_SESSION_COOKIE);
  const hasQuickUnlockCookie = request.cookies.has(QUICK_UNLOCK_SESSION_COOKIE);

  if (
    isGuarded &&
    !hasSupabaseUser &&
    !hasDemoCookie &&
    !hasVendorCookie &&
    !hasQuickUnlockCookie
  ) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin);
    const signIn = new URL("/signin", origin);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: ["/vendor/:path*", "/admin/:path*", "/checkout/:path*"],
};
