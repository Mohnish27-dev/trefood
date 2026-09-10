import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import * as db from "@/server/db/collections";
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  sendOtp,
  verifyOtp,
} from "@/server/auth/otp";
import { OTP_PURPOSE } from "@/types/auth";

/**
 * The email code, end to end against the real collection.
 *
 * The plain code never leaves `sendOtp`, which is the point of the design and
 * an obstacle for a test. Rather than weaken the module with a test-only
 * return value, these tests read the log line that the console transport
 * prints — the same line a developer reads on a laptop. What is under test is
 * therefore exactly what ships.
 *
 * `vitest.config.mts` pins MAIL_TRANSPORT=console for the whole suite, so this
 * holds no matter what `.env.local` says — and no test ever puts a real
 * message through the Zoho mailbox.
 */

const EMAIL = "otp-suite@trefood.test";

/** Captures the six digits out of the console transport's log line. */
function installCodeCapture(): { latest: () => string | null; restore: () => void } {
  const original = console.warn;
  let captured: string | null = null;

  console.warn = (...args: unknown[]) => {
    const line = args.map(String).join(" ");
    const match = /Code:\s*(\d{6})/.exec(line);
    if (match?.[1]) captured = match[1];
  };

  return {
    latest: () => captured,
    restore: () => {
      console.warn = original;
    },
  };
}

let capture: ReturnType<typeof installCodeCapture>;

async function clearCodes(): Promise<void> {
  await (await db.emailOtps()).deleteMany({ email: EMAIL });
}

/** Backdates every code for this address so the resend cooldown is not in the way. */
async function backdate(byMs: number): Promise<void> {
  const otps = await db.emailOtps();
  const records = await otps.find({ email: EMAIL }).toArray();
  for (const record of records) {
    await otps.updateOne(
      { _id: record._id },
      { $set: { createdAt: new Date(new Date(record.createdAt).getTime() - byMs) } },
    );
  }
}

describe("email verification codes", () => {
  beforeAll(() => {
    capture = installCodeCapture();
  });

  afterAll(async () => {
    capture.restore();
    await clearCodes();
  });

  afterEach(async () => {
    await clearCodes();
  });

  it("sends a code that verifies, and carries the pending signup with it", async () => {
    const outcome = await sendOtp(EMAIL, OTP_PURPOSE.SIGNUP, {
      name: "Test Student",
      passwordHash: "salt:hash",
    });

    expect(outcome.ok).toBe(true);

    const code = capture.latest();
    expect(code).toMatch(/^\d{6}$/);

    const result = await verifyOtp(EMAIL, OTP_PURPOSE.SIGNUP, code ?? "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The account to create travels with the code, so verifying it and knowing
    // what to build are one read rather than two that can disagree.
    expect(result.record.pendingSignup?.name).toBe("Test Student");
    expect(result.record.pendingSignup?.passwordHash).toBe("salt:hash");
    expect(result.record.consumedAt).toBeTruthy();
  });

  it("refuses the same code twice", async () => {
    await sendOtp(EMAIL, OTP_PURPOSE.SIGNUP, { name: "Test", passwordHash: "x:y" });
    const code = capture.latest() ?? "";

    expect((await verifyOtp(EMAIL, OTP_PURPOSE.SIGNUP, code)).ok).toBe(true);

    const replay = await verifyOtp(EMAIL, OTP_PURPOSE.SIGNUP, code);
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.reason).toBe("NO_CODE");
  });

  it("will not let a signup code satisfy a password reset", async () => {
    await sendOtp(EMAIL, OTP_PURPOSE.SIGNUP, { name: "Test", passwordHash: "x:y" });
    const code = capture.latest() ?? "";

    const crossed = await verifyOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET, code);
    expect(crossed.ok).toBe(false);
    if (!crossed.ok) expect(crossed.reason).toBe("NO_CODE");
  });

  it("burns the code after too many wrong guesses", async () => {
    await sendOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET);
    const real = capture.latest() ?? "";
    const wrong = real === "000000" ? "111111" : "000000";

    for (let attempt = 1; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      const result = await verifyOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET, wrong);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.attemptsLeft).toBe(OTP_MAX_ATTEMPTS - attempt);
    }

    const final = await verifyOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET, wrong);
    expect(final.ok).toBe(false);
    if (!final.ok) expect(final.reason).toBe("BURNT");

    // The real code is dead too. That is the whole point of burning it: an
    // attacker guessing must not leave the owner a usable code.
    const afterBurn = await verifyOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET, real);
    expect(afterBurn.ok).toBe(false);
  });

  it("refuses an expired code", async () => {
    await sendOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET);
    const code = capture.latest() ?? "";

    await (await db.emailOtps()).updateMany(
      { email: EMAIL },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const result = await verifyOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET, code);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("holds a resend behind the cooldown", async () => {
    expect((await sendOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET)).ok).toBe(true);

    const immediate = await sendOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET);
    expect(immediate.ok).toBe(false);
    if (immediate.ok || immediate.reason !== "COOLDOWN") {
      throw new Error(`expected a cooldown, got ${JSON.stringify(immediate)}`);
    }
    expect(immediate.retryAfterMs).toBeGreaterThan(0);
    expect(immediate.retryAfterMs).toBeLessThanOrEqual(OTP_RESEND_COOLDOWN_MS);
  });

  it("retires the previous code when a new one is sent", async () => {
    await sendOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET);
    const first = capture.latest() ?? "";

    await backdate(OTP_RESEND_COOLDOWN_MS + 1000);
    await sendOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET);
    const second = capture.latest() ?? "";

    expect(second).not.toBe(first);

    // Two live codes would be two chances to guess, and the older one is what
    // a person types out of a stale notification.
    const stale = await verifyOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET, first);
    expect(stale.ok).toBe(false);

    expect((await verifyOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET, second)).ok).toBe(true);
  });

  it("caps how many codes one address can pull in an hour", async () => {
    for (let sent = 0; sent < OTP_MAX_PER_HOUR; sent += 1) {
      const outcome = await sendOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET);
      expect(outcome.ok).toBe(true);
      await backdate(OTP_RESEND_COOLDOWN_MS + 1000);
    }

    const blocked = await sendOtp(EMAIL, OTP_PURPOSE.PASSWORD_RESET);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("HOURLY_LIMIT");
  });

  it("never stores the plain code", async () => {
    await sendOtp(EMAIL, OTP_PURPOSE.SIGNUP, { name: "Test", passwordHash: "x:y" });
    const code = capture.latest() ?? "";

    const record = await (await db.emailOtps()).findOne({ email: EMAIL });
    expect(record).not.toBeNull();
    expect(JSON.stringify(record)).not.toContain(code);
    expect(record?.codeHash).toHaveLength(64);
    expect(record?.codeSalt).toHaveLength(32);
  });
});
