import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env";
import { resolveLandingPath } from "@/lib/routes";
import { upsertGoogleAccount } from "@/server/auth/accounts";
import {
  GOOGLE_STATE_COOKIE,
  attemptFromState,
  canonicalOrigin,
  exchangeGoogleCode,
  isGoogleConfigured,
  readStateCookie,
} from "@/server/auth/google";
import {
  AUTH_METHOD,
  authCookieDomain,
  openSession,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/server/auth/session-store";
import {
  QUICK_UNLOCK_DEVICE_COOKIE,
  QUICK_UNLOCK_SESSION_COOKIE,
} from "@/server/auth/quick-unlock";
import { quickUnlockDeviceCookieFor } from "@/server/auth/quick-unlock-cookies";
import { sendMail } from "@/server/mail/mailer";
import { welcomeMessage } from "@/server/mail/templates";

/**
 * Where Google sends the browser back.
 *
 * Everything here is a check before anything here is a login. The state cookie
 * is authenticated, its value compared against the one Google echoed, the code
 * redeemed with the matching PKCE verifier, and the id_token's nonce matched.
 * Only then does an account get touched.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = canonicalOrigin();
  const params = request.nextUrl.searchParams;

  const fail = (reason: string): NextResponse => {
    const response = NextResponse.redirect(`${origin}/signin?reason=${reason}`);
    // The flow is over either way; a state cookie left behind is only useful
    // to somebody replaying it.
    response.cookies.delete(GOOGLE_STATE_COOKIE);
    return response;
  };

  if (!isGoogleConfigured()) return fail("google_unavailable");

  // The person pressed Cancel on Google's consent screen. Not an error.
  if (params.get("error")) return fail("google_cancelled");

  const code = params.get("code");
  const returnedState = params.get("state");
  if (!code || !returnedState) return fail("auth_failed");

  const cookieValue = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  if (!cookieValue) {
    /**
     * No state cookie, so there is nothing to check the code against and this
     * sign-in cannot be completed. The question is what the student sees next.
     *
     * Sending them to an error page taught them to press the button a second
     * time, and the second time worked — which is the bug as they experience
     * it. Everything that drops the cookie between the two hops (a window that
     * ran out on a slow first pass through Google, a flow begun on a
     * non-canonical host, a link opened in a webview with its own cookie jar)
     * is gone by the time that second attempt starts, because this response is
     * what moves them onto the canonical origin in an ordinary browser.
     *
     * So do the retry for them, once. The attempt number rides in `state`,
     * which Google echoes back, so it survives exactly the thing that went
     * missing — no cookie is needed to know this is already the second try,
     * and two failures in a row stop rather than loop.
     */
    const attempt = attemptFromState(returnedState);
    const carried = request.cookies.getAll().map((cookie) => cookie.name);

    console.warn(
      `[auth:google] no state cookie on attempt ${attempt}` +
        ` (host=${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "?"},` +
        ` cookies=[${carried.join(",")}])`,
    );

    if (attempt < 2) {
      const restart = new URL("/api/auth/google/start", origin);
      restart.searchParams.set("attempt", "2");
      // `next` lived in the cookie that is gone, so the retry lands on the
      // role's own home rather than wherever they were headed. One wrong
      // landing beats an error page.
      return NextResponse.redirect(restart);
    }

    return fail("auth_expired");
  }

  const state = readStateCookie(cookieValue);
  if (!state) return fail("auth_failed");

  // Constant-time is unnecessary here: the value is random, single-use, and
  // already authenticated by the cookie's own HMAC.
  if (state.state !== returnedState) return fail("auth_failed");

  const exchange = await exchangeGoogleCode(code, state.verifier, state.nonce);
  if (!exchange.ok) {
    console.error(`[auth:google] ${exchange.reason}`);
    return fail("auth_failed");
  }

  if (!exchange.profile.emailVerified) {
    // Google will hand out an unverified address on some workspace configs.
    // Adopting an account on one is how somebody else's account gets taken.
    return fail("google_unverified");
  }

  const { user, created } = await upsertGoogleAccount(exchange.profile);

  if (user.ordersBlocked) {
    // Still sign them in. Blocking is about placing orders, not about looking
    // at your own history, and a locked-out account with no way to read the
    // reason is how a support queue fills up.
    console.warn(`[auth:google] blocked account signed in: ${user._id}`);
  }

  const token = await openSession(user._id, AUTH_METHOD.GOOGLE);

  if (created) {
    const welcome = welcomeMessage(user.name);
    void sendMail({ to: user.email, subject: welcome.subject, html: welcome.html, text: welcome.text });
  }

  const response = NextResponse.redirect(`${origin}${resolveLandingPath(state.next, user.role)}`);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  response.cookies.delete(GOOGLE_STATE_COOKIE);

  // Re-arm (or clear) quick unlock for this browser now that we know who just
  // signed in, so the PIN screen after a sign-out belongs to them and not to
  // whoever used this laptop before.
  const cookieDomain = authCookieDomain();
  const device = quickUnlockDeviceCookieFor(user);
  if (device) {
    response.cookies.set(device.name, device.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: device.maxAge,
      secure: serverEnv().NODE_ENV === "production",
      domain: cookieDomain,
    });
  } else {
    response.cookies.delete({ name: QUICK_UNLOCK_DEVICE_COOKIE, path: "/", domain: cookieDomain });
    response.cookies.delete({ name: QUICK_UNLOCK_SESSION_COOKIE, path: "/", domain: cookieDomain });
  }

  return response;
}
