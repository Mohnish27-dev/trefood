import { describe, expect, it } from "vitest";
import {
  generatePinSalt,
  hashPin,
  verifyPin,
} from "@/lib/quick-unlock";

describe("Quick Unlock PIN Hashing & Verification", () => {
  it("generates a random 32-character hex salt", () => {
    const salt1 = generatePinSalt();
    const salt2 = generatePinSalt();

    expect(salt1).toHaveLength(32);
    expect(salt2).toHaveLength(32);
    expect(salt1).not.toBe(salt2);
  });

  it("hashes 4-digit PIN deterministically with salt", async () => {
    const pin = "1234";
    const salt = generatePinSalt();

    const hash1 = await hashPin(pin, salt);
    const hash2 = await hashPin(pin, salt);

    expect(hash1).toHaveLength(64); // SHA-256 is 64 hex characters
    expect(hash1).toBe(hash2);
  });

  it("verifies correct 4-digit PIN accurately", async () => {
    const pin = "8520";
    const salt = generatePinSalt();
    const hash = await hashPin(pin, salt);

    const isMatch = await verifyPin(pin, hash, salt);
    expect(isMatch).toBe(true);
  });

  it("rejects incorrect 4-digit PINs", async () => {
    const correctPin = "4321";
    const wrongPin = "1234";
    const salt = generatePinSalt();
    const hash = await hashPin(correctPin, salt);

    const isMatch = await verifyPin(wrongPin, hash, salt);
    expect(isMatch).toBe(false);
  });

  it("rejects invalid lengths or non-4-digit strings", async () => {
    const pin = "123";
    const salt = generatePinSalt();
    const hash = await hashPin("1234", salt);

    expect(await verifyPin(pin, hash, salt)).toBe(false);
    expect(await verifyPin("12345", hash, salt)).toBe(false);
    expect(await verifyPin("", hash, salt)).toBe(false);
  });

  it("produces different hashes for the same PIN with different salts", async () => {
    const pin = "9999";
    const salt1 = generatePinSalt();
    const salt2 = generatePinSalt();

    const hash1 = await hashPin(pin, salt1);
    const hash2 = await hashPin(pin, salt2);

    expect(hash1).not.toBe(hash2);
  });
});
