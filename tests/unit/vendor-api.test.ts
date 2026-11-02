import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signOutVendor } from "@/lib/vendor-api";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("vendor logout transport", () => {
  it("logs out without a build-specific Server Action request", async () => {
    fetchMock.mockResolvedValue(Response.json({ status: "ok" }));
    expect(await signOutVendor()).toEqual({ status: "ok" });
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/vendor/logout");
    expect(options.headers).not.toHaveProperty("next-action");
    expect(options.credentials).toBe("same-origin");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["network error", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["timeout", () => Promise.reject(new DOMException("Timeout", "TimeoutError"))],
    ["HTML server error", () => Promise.resolve(new Response("<html>Server error</html>", { status: 500 }))],
    ["unexpected response", () => Promise.resolve(Response.json({ status: "ok" }, { status: 500 }))],
  ])("returns a retryable result for %s", async (_name, response) => {
    fetchMock.mockImplementation(response);
    expect((await signOutVendor()).status).toBe("error");
  });

  it("logs out through the API without asking React to render the signed-out vendor layout", async () => {
    fetchMock.mockResolvedValue(Response.json({ status: "ok" }));
    expect(await signOutVendor()).toEqual({ status: "ok" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/vendor/logout");
  });
});
