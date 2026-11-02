import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revoke: vi.fn(), deleteCookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: mocks.deleteCookie }) }));
vi.mock("@/server/auth/session-store", () => ({
  destroyCurrentSession: mocks.revoke,
  authCookieDomain: () => "trefood.in",
}));
vi.mock("@/server/auth/session", () => ({ DEMO_USER_COOKIE: "trefood_demo_user" }));

import { logoutCurrentSession } from "@/server/auth/logout";

beforeEach(() => vi.resetAllMocks());

describe("vendor logout session cleanup", () => {
  it("revokes the real session and clears fallback credentials while retaining device trust", async () => {
    await logoutCurrentSession();
    expect(mocks.revoke).toHaveBeenCalledOnce();
    expect(mocks.deleteCookie.mock.calls.map(([name]) => name)).toEqual([
      "trefood_demo_user", "trefood_vendor_session",
      { name: "trefood_quick_session", path: "/", domain: "trefood.in" },
    ]);
  });

  it("does not report logout success if session revocation fails", async () => {
    mocks.revoke.mockRejectedValue(new Error("Database unavailable"));
    await expect(logoutCurrentSession()).rejects.toThrow("Database unavailable");
    expect(mocks.deleteCookie).not.toHaveBeenCalled();
  });
});
