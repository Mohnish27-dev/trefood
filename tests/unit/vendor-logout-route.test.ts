import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock("@/server/auth/logout", () => ({ logoutCurrentSession: mocks.logout }));

import { POST } from "@/app/api/vendor/logout/route";

function request(origin = "https://trefood.in", host?: string) {
  return new Request("https://trefood.in/api/vendor/logout", {
    method: "POST",
    headers: { origin, ...(host ? { "x-forwarded-host": host } : {}) },
  });
}
beforeEach(() => vi.resetAllMocks());

describe("vendor logout route", () => {
  it("ends a session without rendering or redirecting inside the mutation", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.has("location")).toBe(false);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.logout).toHaveBeenCalledOnce();
  });

  it.each(["https://attacker.test", "null", "invalid-origin"])("refuses cross-origin logout from %s", async (origin) => {
    expect((await POST(request(origin))).status).toBe(403);
    expect(mocks.logout).not.toHaveBeenCalled();
  });

  it("checks the public host behind the production reverse proxy", async () => {
    expect((await POST(request("https://www.trefood.in", "www.trefood.in"))).status).toBe(200);
  });

  it("returns a retryable JSON error if session revocation fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mocks.logout.mockRejectedValue(new Error("Database credentials"));
      const response = await POST(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ status: "error", message: "Could not sign out. Please retry." });
    } finally {
      log.mockRestore();
    }
  });
});
