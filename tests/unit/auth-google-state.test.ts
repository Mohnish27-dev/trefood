import { describe, expect, it } from "vitest";

import {
  GOOGLE_STATE_MAX_AGE,
  attemptFromState,
  canonicalOrigin,
  googleRedirectUri,
  readStateCookie,
  startGoogleFlow,
} from "@/server/auth/google";

/**
 * The Google flow's three defences, tested as defences.
 *
 * Every case below is an attack the flow has to survive, not a happy path with
 * the inputs changed: a forged state cookie, a swapped state value, and a
 * replayed authorization request. If any of these passes, somebody can complete
 * a Google sign-in inside another person's browser.
 */
describe("Google OAuth flow state", () => {
  it("builds a consent URL carrying PKCE and a nonce", () => {
    const { url } = startGoogleFlow("/checkout");
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("code_challenge")).toBeTruthy();
    expect(parsed.searchParams.get("nonce")).toBeTruthy();
    expect(parsed.searchParams.get("state")).toBeTruthy();
    expect(parsed.searchParams.get("scope")).toBe("openid email profile");
    // Never silently reuse whichever Google account the browser is signed into.
    expect(parsed.searchParams.get("prompt")).toBe("select_account");
    expect(parsed.searchParams.get("redirect_uri")).toBe(googleRedirectUri());
  });

  it("round-trips the state cookie, and the state matches the URL", () => {
    const { url, stateCookieValue } = startGoogleFlow("/orders/abc");
    const state = readStateCookie(stateCookieValue);

    expect(state).not.toBeNull();
    expect(state?.next).toBe("/orders/abc");
    expect(state?.state).toBe(new URL(url).searchParams.get("state"));
    expect(state?.nonce).toBe(new URL(url).searchParams.get("nonce"));
    // The verifier is the secret half of PKCE and must never appear in the URL.
    expect(url).not.toContain(state?.verifier ?? "__never__");
  });

  it("keeps the code challenge out of reach of the verifier", () => {
    const { url, stateCookieValue } = startGoogleFlow(null);
    const state = readStateCookie(stateCookieValue);
    const challenge = new URL(url).searchParams.get("code_challenge");

    expect(challenge).toBeTruthy();
    expect(challenge).not.toBe(state?.verifier);
  });

  it("rejects a state cookie whose payload was edited", () => {
    const { stateCookieValue } = startGoogleFlow("/checkout");
    const [encoded, signature] = stateCookieValue.split(".");

    const tampered = Buffer.from(
      JSON.stringify({ state: "attacker", verifier: "attacker", nonce: "attacker", next: "/admin" }),
      "utf8",
    ).toString("base64url");

    expect(readStateCookie(`${tampered}.${signature ?? ""}`)).toBeNull();
    // The original payload with a mangled signature is refused just as hard.
    expect(readStateCookie(`${encoded ?? ""}.${"0".repeat(64)}`)).toBeNull();
  });

  it("rejects malformed cookies rather than throwing", () => {
    expect(readStateCookie("")).toBeNull();
    expect(readStateCookie("no-separator")).toBeNull();
    expect(readStateCookie(".onlysignature")).toBeNull();
    expect(readStateCookie("not-base64.!!!!")).toBeNull();
  });

  it("gives every attempt a fresh state, verifier and nonce", () => {
    const first = readStateCookie(startGoogleFlow(null).stateCookieValue);
    const second = readStateCookie(startGoogleFlow(null).stateCookieValue);

    expect(first?.state).not.toBe(second?.state);
    expect(first?.verifier).not.toBe(second?.verifier);
    expect(first?.nonce).not.toBe(second?.nonce);
  });

  it("points the redirect URI at this app's callback", () => {
    expect(googleRedirectUri()).toMatch(/\/api\/auth\/google\/callback$/);
    expect(googleRedirectUri()).not.toMatch(/\/\/api/);
  });
});

/**
 * Surviving a lost state cookie.
 *
 * The callback used to answer a missing cookie with an error page, and the
 * student's own fix was to press the button again — which worked, because the
 * error page had already moved them onto the canonical origin in a browser that
 * keeps cookies. The flow now performs that second attempt itself, which it can
 * only do safely if it can tell a first try from a retry without reading the
 * cookie that just went missing. `state` is the one value Google hands back.
 */
describe("Google OAuth retry marking", () => {
  it("marks the first attempt in the state Google echoes back", () => {
    const { url } = startGoogleFlow(null);
    const state = new URL(url).searchParams.get("state") ?? "";

    expect(attemptFromState(state)).toBe(1);
  });

  it("carries the retry number through the state, not a cookie", () => {
    const { url, stateCookieValue } = startGoogleFlow(null, 2);
    const state = new URL(url).searchParams.get("state") ?? "";

    expect(attemptFromState(state)).toBe(2);
    // Still the value the cookie will be checked against, marker and all.
    expect(readStateCookie(stateCookieValue)?.state).toBe(state);
  });

  it("treats an unmarked or hostile state as a first attempt", () => {
    // A retry is the generous branch, so anything unreadable must land on the
    // attempt that is allowed to retry rather than one that silently loops.
    expect(attemptFromState("")).toBe(1);
    expect(attemptFromState("nomarker")).toBe(1);
    expect(attemptFromState("~leading")).toBe(1);
    expect(attemptFromState("abc~value")).toBe(1);
    expect(attemptFromState("-4~value")).toBe(1);
    expect(attemptFromState("1e9~value")).toBe(1);
  });

  it("keeps a marked state distinguishable from the random half", () => {
    const first = new URL(startGoogleFlow(null, 1).url).searchParams.get("state") ?? "";
    const second = new URL(startGoogleFlow(null, 2).url).searchParams.get("state") ?? "";

    expect(first.slice(first.indexOf("~") + 1)).not.toBe(second.slice(second.indexOf("~") + 1));
  });

  it("allows for a first-ever Google sign-in, not just a fast one", () => {
    // Typing an address, a password and a code from a second device is what the
    // five-minute window used to cut short, one attempt before it worked.
    expect(GOOGLE_STATE_MAX_AGE).toBeGreaterThanOrEqual(10 * 60);
  });

  it("has one canonical origin, and the redirect URI is built from it", () => {
    // The cookie is set on whatever host serves the start route; the callback
    // happens on this one. They have to be the same host or the cookie is lost.
    expect(googleRedirectUri().startsWith(`${canonicalOrigin()}/`)).toBe(true);
    expect(canonicalOrigin()).not.toMatch(/\/$/);
  });
});
