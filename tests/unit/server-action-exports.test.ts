import { describe, expect, it } from "vitest";

import * as vendorActions from "@/server/actions/vendor";
import * as adminMenuActions from "@/server/actions/admin-menu";
import * as sessionActions from "@/server/actions/session";

describe("Server Action runtime export contract", () => {
  it.each([
    ["vendor", vendorActions],
    ["admin menu", adminMenuActions],
    ["session", sessionActions],
  ])("%s exports only functions, as required by Next.js", (_name, actions) => {
    for (const [name, value] of Object.entries(actions)) {
      expect(typeof value, `Invalid Server Action export: ${name}`).toBe("function");
    }
  });
});
