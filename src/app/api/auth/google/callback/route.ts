import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env";
import { resolveLandingPath } from "@/lib/routes";
import { upsertGoogleAccount } from "@/server/auth/accounts";
import {
  GOOGLE_STATE_COOKIE,
  exchangeGoogleCode,
  isGoogleConfigured,
  readStateCookie,
} from "@/server/auth/google";
import { AUTH_METHOD, openSession, sessionCookieOptions, SESSION_COOKIE } from "@/server/auth/session-store";
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
  const origin = serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
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
  if (!cookieValue) return fail("auth_expired");

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
  const device = quickUnlockDeviceCookieFor(user);
  if (device) {
    response.cookies.set(device.name, device.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: device.maxAge,
      secure: serverEnv().NODE_ENV === "production",
    });
  } else {
    response.cookies.delete(QUICK_UNLOCK_DEVICE_COOKIE);
    response.cookies.delete(QUICK_UNLOCK_SESSION_COOKIE);
  }

  return response;
}
