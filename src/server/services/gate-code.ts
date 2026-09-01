import { randomInt, timingSafeEqual } from "node:crypto";

import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";

/**
 * The 4-digit code that replaces a rider app entirely.
 *
 * SYSTEM_ARCHITECTURE_AND_FLOWS.md section 6. DECISIONS.md D4.
 *
 * The direction is inverted from the original design: the VENDOR writes the
 * code on the packet, and the STUDENT matches it. The original had the rider
 * type a student OTP, which requires the rider to hold a working, charged,
 * connected phone — and they often do not.
 *
 * Inverting it costs nothing in fraud terms and gains everything in reliability:
 *
 *   · The code is physically on the packet, so a student cannot confirm an
 *     order that never arrived — they would have no code to match.
 *   · The student already has a phone, is already logged in, and is already
 *     standing at the gate.
 *   · It works at 2 AM in the rain with a rider who owns a 900-rupee keypad phone.
 */

const CODE_LENGTH = 4;

/**
 * Cryptographically random, and unrelated to the order number (ARCH section 10.4).
 *
 * Digits only, by design — the operational runbook calls out marker-written
 * codes being misread, and digits remove any 0/O or 1/l confusion at a dark
 * gate. Codes where all four digits repeat are skipped: "0000" written on a
 * packet reads as a placeholder rather than a code.
 */
export function generateGateCode(): string {
  for (;;) {
    const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
    if (!/^(\d)\1{3}$/.test(code)) return code;
  }
}

/**
 * May the STUDENT see the code yet?
 *
 * Only at AT_GATE. Until the vendor taps "Rider at gate" the confirm button
 * does not exist, so a student cannot pre-confirm from their room. And
 * confirming early only hurts the student — it releases the order before they
 * are holding the food.
 */
export function isGateCodeVisibleToStudent(status: OrderStatus): boolean {
  return status === ORDER_STATUS.AT_GATE;
}

/**
 * May the VENDOR see it?
 *
 * From READY onward, which is the moment the staff writes it on the packet.
 */
export function isGateCodeVisibleToVendor(status: OrderStatus): boolean {
  return (
    status === ORDER_STATUS.READY ||
    status === ORDER_STATUS.OUT_FOR_DELIVERY ||
    status === ORDER_STATUS.AT_GATE ||
    status === ORDER_STATUS.DELIVERED ||
    status === ORDER_STATUS.DELIVERED_TO_SECURITY
  );
}

/** Redact unless the viewer is entitled. The default is always to hide. */
export function revealGateCode(
  code: string | null,
  status: OrderStatus,
  viewer: "STUDENT" | "VENDOR" | "ADMIN",
): string | null {
  if (!code) return null;
  if (viewer === "ADMIN") return code; // dispute rulings need the full timeline
  if (viewer === "VENDOR") return isGateCodeVisibleToVendor(status) ? code : null;
  return isGateCodeVisibleToStudent(status) ? code : null;
}

/** Constant-time comparison. A timing side channel on a 4-digit code is small, but free to close. */
export function verifyGateCode(expected: string, entered: string): boolean {
  const a = Buffer.from(expected.trim());
  const b = Buffer.from(entered.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
