import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The domain auth cookies are written for.
 *
 * This app answers on both `trefood.in` and `www.trefood.in`, and neither
 * redirects to the other. A cookie with no Domain belongs to exactly the host
 * that set it, which gave the two hosts two separate sign-in states.
 *
 * Email and password never showed it: they sign in on whichever host the
 * student is already on. Google did, every time — the flow is pinned to
 * NEXT_PUBLIC_APP_URL because Google matches `redirect_uri` byte for byte, so
 * a student who started on the apex was moved to `www` and handed a cookie
 * that the apex would never send back. Coming back to the apex looked exactly
 * like being signed out.
 *
 * `serverEnv()` caches on first read, so each case re-imports the module with
 * a different NEXT_PUBLIC_APP_URL rather than trying to mutate that cache.
 */
async function domainFor(appUrl: string): Promise<string | undefined> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", appUrl);
  const { authCookieDomain } = await import("@/server/auth/session-store");
  return authCookieDomain();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("auth cookie domain", () => {
  it("shares one domain between the apex and www", async () => {
    // The two spellings of the deployment must agree, whichever one is
    // canonical, or Google sign-in and password sign-in land in different jars.
    expect(await domainFor("https://www.trefood.in")).toBe("trefood.in");
    expect(await domainFor("https://trefood.in")).toBe("trefood.in");
  });

  it("stays host-only where a Domain cannot be set", async () => {
    // `localhost` and bare IPs are refused outright by browsers, and a cookie
    // the browser drops is a sign-in that silently never happens.
    expect(await domainFor("http://localhost:3000")).toBeUndefined();
    expect(await domainFor("http://127.0.0.1:3000")).toBeUndefined();
  });

  it("refuses to widen a host it cannot reason about", async () => {
    // No public-suffix list here, so anything that is not a two-label host
    // keeps its own scope. `vercel.app` is a public suffix and a cookie named
    // onto it would be dropped; a deeper subdomain is simply not ours to widen.
    expect(await domainFor("https://trefood.vercel.app")).toBeUndefined();
    expect(await domainFor("https://preview.app.trefood.in")).toBeUndefined();
    expect(await domainFor("not a url")).toBeUndefined();
  });
});
