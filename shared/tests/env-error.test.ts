import { describe, expect, it } from "vitest";
import { z } from "zod";

import { formatEnvError } from "../src/env-error.js";

/**
 * The Phase 0 exit gate is that a missing environment variable crashes the service
 * with a *readable* message. Both backend and frontend validate their own half of the
 * environment through this formatter. "Readable" has a testable definition: it names every missing
 * key at once, so one deploy is enough to learn what is wrong.
 */
describe("formatEnvError", () => {
  const schema = z.object({
    MONGODB_URI: z.string().startsWith("mongodb"),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
    CRON_SECRET: z.string().min(32),
  });

  it("names every failing key, not just the first", () => {
    const result = schema.safeParse({ MONGODB_URI: "postgres://nope" });
    expect(result.success).toBe(false);
    if (result.success) return;

    const message = formatEnvError("server", result.error);

    expect(message).toContain("MONGODB_URI");
    expect(message).toContain("RAZORPAY_WEBHOOK_SECRET");
    expect(message).toContain("CRON_SECRET");
  });

  it("says which environment failed and points at the fix", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;

    const message = formatEnvError("server", result.error);

    expect(message).toContain("Invalid server environment");
    expect(message).toContain(".env.example");
  });

  it("puts one key per line so the list is scannable", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;

    const keyLines = formatEnvError("server", result.error)
      .split("\n")
      .filter((line) => line.startsWith("  "));

    expect(keyLines).toHaveLength(3);
  });
});
