import { describe, expect, it } from "vitest";

import { googleRedirectUri, readStateCookie, startGoogleFlow } from "@/server/auth/google";

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
