import "server-only";

import crypto from "node:crypto";

import * as db from "@/server/db/collections";
import { newId } from "@/lib/ids";
import { sendMail } from "@/server/mail/mailer";
import { otpMessage } from "@/server/mail/templates";
import { OTP_PURPOSE, type EmailOtp, type OtpPurpose } from "@/types/auth";

/**
 * Six-digit email codes.
 *
 * A code is worth a million guesses only if guessing is actually allowed a
 * million times, so the limits below are the security, not the digit count:
 *
 *   six wrong guesses   burns the code outright, not just that attempt
 *   ten minutes         the whole window a code is alive
 *   sixty seconds       the floor between two sends to one address
 *   five per hour       the ceiling per address, which is also what stops
 *                       this becoming a free mail cannon aimed at strangers
 *
 * The code is stored as SHA-256 of the salted digits — a fast hash on purpose,
 * because the input is six digits and a slow hash would buy nothing against an
 * attacker holding the database while costing every honest verification. What
 * protects the code is the attempt counter, which an offline attacker never gets.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 6;
export const OTP_RESEND_COOLDOWN_MS = 60_000;
export const OTP_MAX_PER_HOUR = 5;

const HOUR_MS = 60 * 60 * 1000;

export type OtpSendOutcome =
  | { ok: true; cooldownMs: number }
  | { ok: false; reason: "COOLDOWN"; retryAfterMs: number }
  | { ok: false; reason: "HOURLY_LIMIT"; retryAfterMs: number }
  | { ok: false; reason: "SEND_FAILED" };

export type OtpVerifyOutcome =
  | { ok: true; record: EmailOtp }
  | { ok: false; reason: "NO_CODE" | "EXPIRED" | "BURNT" | "WRONG"; attemptsLeft: number };

/** Rejection-sampled, so every one of the million codes is equally likely. */
function generateCode(): string {
  const max = 10 ** OTP_LENGTH;
  // A plain modulo of a raw 32-bit draw is biased toward the low codes, and a
  // skewed code space is a smaller code space. Redraw instead.
  const limit = Math.floor(0xffffffff / max) * max;
  let draw: number;
  do {
    draw = crypto.randomBytes(4).readUInt32BE(0);
  } while (draw >= limit);
  return String(draw % max).padStart(OTP_LENGTH, "0");
}

function hashCode(code: string, salt: string): string {
  return crypto.createHash("sha256").update(salt + ":" + code).digest("hex");
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Mints a code, stores its hash, and mails the plain code.
 *
 * Any earlier live code for the same address and purpose is retired first, so
 * "resend" means the previous code stops working. Two valid codes at once is
 * two chances to guess, and it is also how somebody ends up typing the older
 * one out of their notification shade.
 */
export async function sendOtp(
  rawEmail: string,
  purpose: OtpPurpose,
  pendingSignup?: { name: string; passwordHash: string } | null,
): Promise<OtpSendOutcome> {
  const email = normaliseEmail(rawEmail);
  const otps = await db.emailOtps();
  const now = new Date();

  const recent = await otps
    .find({ email, purpose, createdAt: { $gt: new Date(now.getTime() - HOUR_MS) } })
    .sort({ createdAt: -1 })
    .toArray();

  const newest = recent[0];
  if (newest) {
    const sinceMs = now.getTime() - new Date(newest.createdAt).getTime();
    if (sinceMs < OTP_RESEND_COOLDOWN_MS) {
      return { ok: false, reason: "COOLDOWN", retryAfterMs: OTP_RESEND_COOLDOWN_MS - sinceMs };
    }
  }

  if (recent.length >= OTP_MAX_PER_HOUR) {
    const oldest = recent[recent.length - 1];
    const retryAfterMs = oldest
      ? new Date(oldest.createdAt).getTime() + HOUR_MS - now.getTime()
      : HOUR_MS;
    return { ok: false, reason: "HOURLY_LIMIT", retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  const code = generateCode();
  const salt = crypto.randomBytes(16).toString("hex");

  const record: EmailOtp = {
    _id: newId("otp"),
    email,
    purpose,
    codeHash: hashCode(code, salt),
    codeSalt: salt,
    attempts: 0,
    pendingSignup: purpose === OTP_PURPOSE.SIGNUP ? (pendingSignup ?? null) : null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000),
    consumedAt: null,
  };

  // Retire the previous codes BEFORE the send. If the mail then fails, the
  // person is left with no working code and a clear error, which is honest,
  // rather than silently still holding one the screen has declared dead.
  await otps.updateMany({ email, purpose, consumedAt: null }, { $set: { consumedAt: now } });
  await otps.insertOne(record);

  const message = otpMessage(code, purpose, OTP_TTL_MINUTES);
  const result = await sendMail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (!result.sent) {
    // Nothing reached the mailbox, so the record is dead weight. Dropping it
    // also refunds the hourly allowance: nobody should lose four of five tries
    // to an outage on our side.
    await otps.deleteOne({ _id: record._id });
    return { ok: false, reason: "SEND_FAILED" };
  }

  return { ok: true, cooldownMs: OTP_RESEND_COOLDOWN_MS };
}

/**
 * Checks a code and consumes it on success.
 *
 * The record is returned so the caller can read `pendingSignup` — the code and
 * the account it unlocks are one fact, and looking the signup up separately
 * would be a second chance for the two to get out of step.
 */
export async function verifyOtp(
  rawEmail: string,
  purpose: OtpPurpose,
  code: string,
): Promise<OtpVerifyOutcome> {
  const email = normaliseEmail(rawEmail);
  const otps = await db.emailOtps();
  const now = new Date();

  const record = await otps.findOne({ email, purpose, consumedAt: null }, { sort: { createdAt: -1 } });

  if (!record) return { ok: false, reason: "NO_CODE", attemptsLeft: 0 };
  if (new Date(record.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "EXPIRED", attemptsLeft: 0 };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "BURNT", attemptsLeft: 0 };
  }

  const supplied = code.replace(/\D/g, "");
  const actual = hashCode(supplied, record.codeSalt);
  const matches =
    supplied.length === OTP_LENGTH &&
    crypto.timingSafeEqual(Buffer.from(record.codeHash, "hex"), Buffer.from(actual, "hex"));

  if (!matches) {
    const updated = await otps.findOneAndUpdate(
      { _id: record._id },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
    const attempts = updated?.attempts ?? record.attempts + 1;
    const attemptsLeft = Math.max(OTP_MAX_ATTEMPTS - attempts, 0);

    if (attemptsLeft === 0) {
      // Burn it rather than leave a spent code lying around at zero tries.
      await otps.updateOne({ _id: record._id }, { $set: { consumedAt: new Date() } });
      return { ok: false, reason: "BURNT", attemptsLeft: 0 };
    }
    return { ok: false, reason: "WRONG", attemptsLeft };
  }

  // Consume conditionally: `consumedAt: null` in the filter means two requests
  // racing with the same correct code produce exactly one winner.
  const consumed = await otps.findOneAndUpdate(
    { _id: record._id, consumedAt: null },
    { $set: { consumedAt: now } },
    { returnDocument: "after" },
  );

  if (!consumed) return { ok: false, reason: "NO_CODE", attemptsLeft: 0 };
  return { ok: true, record: consumed };
}

/** Milliseconds until this address may request another code, or 0. */
export async function otpCooldownRemaining(rawEmail: string, purpose: OtpPurpose): Promise<number> {
  const email = normaliseEmail(rawEmail);
  const newest = await (await db.emailOtps()).findOne({ email, purpose }, { sort: { createdAt: -1 } });
  if (!newest) return 0;
  const since = Date.now() - new Date(newest.createdAt).getTime();
  return since >= OTP_RESEND_COOLDOWN_MS ? 0 : OTP_RESEND_COOLDOWN_MS - since;
}
