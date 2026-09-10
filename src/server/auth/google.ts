import "server-only";

import crypto from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Google sign-in, spoken directly to Google.
 *
 * This is the standard authorization-code flow with PKCE, roughly sixty lines
 * of it, against two documented endpoints. It replaced a hosted provider that
 * proxied the same exchange, and dropping the middleman also drops the
 * middleman's sending quota, its outage window, and the second copy of every
 * account that had to be kept in step with ours.
 *
 * Three defences, none optional:
 *
 *   state          a random value echoed back by Google and compared against a
 *                  cookie. Without it, an attacker can complete a login in
 *                  somebody else's browser (CSRF on the callback).
 *   PKCE verifier  proves the code is being redeemed by whoever started the
 *                  flow, even if the code leaks from a redirect or a log.
 *   nonce          bound into the id_token, so a token minted for another
 *                  session cannot be replayed into this one.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
/** The OpenID userinfo endpoint. Used instead of decoding the id_token by hand. */
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_STATE_COOKIE = "trefood_oauth_state";
/** Five minutes is longer than any honest trip through a Google consent screen. */
export const GOOGLE_STATE_MAX_AGE = 5 * 60;

export function isGoogleConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** The redirect URI, which must match the Google console entry byte for byte. */
export function googleRedirectUri(): string {
  const base = serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${base}/api/auth/google/callback`;
}

export interface GoogleFlowStart {
  url: string;
  /** Packed into one cookie, so the callback needs no server-side scratch space. */
  stateCookieValue: string;
}

interface StatePayload {
  state: string;
  verifier: string;
  nonce: string;
  next: string | null;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

/**
 * Builds the consent URL and the cookie that the callback will check it against.
 *
 * The whole flow state rides in one signed cookie rather than a database row:
 * it is single-use, five minutes long, and belongs to exactly one browser, so
 * a row would be a row nobody ever reads twice.
 */
export function startGoogleFlow(next: string | null): GoogleFlowStart {
  const env = serverEnv();

  const state = base64url(crypto.randomBytes(24));
  const verifier = base64url(crypto.randomBytes(32));
  const nonce = base64url(crypto.randomBytes(16));

  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());

  const payload: StatePayload = { state, verifier, nonce, next };
  const encoded = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = crypto
    .createHmac("sha256", env.CRON_SECRET)
    .update(`google-oauth:${encoded}`)
    .digest("hex");

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Ask every time rather than silently reusing whichever Google account the
  // browser happens to be signed into. On a shared campus laptop, "continue as
  // the last person" is the wrong default and produces orders under the wrong name.
  url.searchParams.set("prompt", "select_account");

  return { url: url.toString(), stateCookieValue: `${encoded}.${signature}` };
}

/** Unpacks and authenticates the state cookie. Returns null if it was tampered with. */
export function readStateCookie(value: string): StatePayload | null {
  try {
    const separator = value.lastIndexOf(".");
    if (separator <= 0) return null;

    const encoded = value.slice(0, separator);
    const signature = value.slice(separator + 1);

    const expected = crypto
      .createHmac("sha256", serverEnv().CRON_SECRET)
      .update(`google-oauth:${encoded}`)
      .digest("hex");

    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }

    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;

    const { state, verifier, nonce, next } = parsed as Record<string, unknown>;
    if (typeof state !== "string" || typeof verifier !== "string" || typeof nonce !== "string") {
      return null;
    }

    return { state, verifier, nonce, next: typeof next === "string" ? next : null };
  } catch {
    return null;
  }
}

export interface GoogleProfile {
  /** The stable `sub` claim. An email can change hands; this cannot. */
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export type GoogleExchange =
  | { ok: true; profile: GoogleProfile }
  | { ok: false; reason: string };

/**
 * Redeems the authorization code and reads the profile.
 *
 * The nonce is checked against the id_token before the profile is trusted.
 * The id_token's signature is not verified here and does not need to be: it
 * arrived over TLS directly from Google's token endpoint in response to our
 * own client secret, which is the case the OpenID spec explicitly exempts.
 */
export async function exchangeGoogleCode(
  code: string,
  verifier: string,
  expectedNonce: string,
): Promise<GoogleExchange> {
  const env = serverEnv();

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID ?? "",
        client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
    });
  } catch (error: unknown) {
    return { ok: false, reason: error instanceof Error ? error.message : "token request failed" };
  }

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => "");
    return { ok: false, reason: `token exchange rejected (${tokenResponse.status}) ${detail.slice(0, 200)}` };
  }

  const tokens = (await tokenResponse.json()) as {
    access_token?: string;
    id_token?: string;
  };

  if (!tokens.access_token || !tokens.id_token) {
    return { ok: false, reason: "token response was missing an access or id token" };
  }

  const claims = decodeIdTokenClaims(tokens.id_token);
  if (!claims) return { ok: false, reason: "id token could not be read" };

  if (claims.nonce !== expectedNonce) {
    return { ok: false, reason: "nonce mismatch" };
  }
  if (claims.aud !== env.GOOGLE_CLIENT_ID) {
    return { ok: false, reason: "id token was issued for a different client" };
  }

  let userinfo: Response;
  try {
    userinfo = await fetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });
  } catch (error: unknown) {
    return { ok: false, reason: error instanceof Error ? error.message : "userinfo request failed" };
  }

  if (!userinfo.ok) return { ok: false, reason: `userinfo rejected (${userinfo.status})` };

  const profile = (await userinfo.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email) {
    return { ok: false, reason: "Google did not return an email address" };
  }

  return {
    ok: true,
    profile: {
      googleId: profile.sub,
      email: profile.email.toLowerCase(),
      emailVerified: profile.email_verified !== false,
      name: profile.name ?? null,
      picture: profile.picture ?? null,
    },
  };
}

interface IdTokenClaims {
  aud?: string;
  nonce?: string;
  sub?: string;
  email?: string;
}

/** Reads the payload segment. Signature checking is Google's job at the token endpoint. */
function decodeIdTokenClaims(idToken: string): IdTokenClaims | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as IdTokenClaims;
  } catch {
    return null;
  }
}
