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

  if (isGuarded && !hasSupabaseUser && !hasDemoCookie) {
    const signIn = new URL("/signin", request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: ["/vendor/:path*", "/admin/:path*", "/checkout/:path*"],
};
