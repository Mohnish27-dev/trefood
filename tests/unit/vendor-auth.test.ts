import { describe, expect, it } from "vitest";
import {
  createVendorSessionToken,
  hashPassword,
  verifyPassword,
  verifyVendorSessionToken,
} from "@/server/auth/passwords";

describe("Direct Vendor Auth Passwords & Tokens", () => {
  it("hashes password with salt and produces verifiable hash", () => {
    const password = "mySecretVendorPassword123!";
    const hash = hashPassword(password);

    expect(hash).toContain(":");
    const [salt, key] = hash.split(":");
    expect(salt).toHaveLength(32); // 16 bytes hex
    expect(key).toHaveLength(128); // 64 bytes hex

    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("wrongPassword", hash)).toBe(false);
  });

  it("produces unique salts for identical passwords", () => {
    const password = "commonPassword123";
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(verifyPassword(password, hash1)).toBe(true);
    expect(verifyPassword(password, hash2)).toBe(true);
  });

  it("handles malformed hash strings safely without throwing", () => {
    expect(verifyPassword("password", "")).toBe(false);
    expect(verifyPassword("password", "malformed")).toBe(false);
    expect(verifyPassword("password", "invalid:nothex")).toBe(false);
  });

  it("creates and verifies vendor session tokens", () => {
    const userId = "usr_testvendor123";
    const token = createVendorSessionToken(userId);

    expect(token.startsWith(`${userId}.`)).toBe(true);

    const verifiedUserId = verifyVendorSessionToken(token);
    expect(verifiedUserId).toBe(userId);
  });

  it("rejects tampered or forged session tokens", () => {
    const userId = "usr_testvendor123";
    const token = createVendorSessionToken(userId);

    // Tampered userId
    const tamperedUserIdToken = `usr_attacker.${token.split(".")[1]}`;
    expect(verifyVendorSessionToken(tamperedUserIdToken)).toBeNull();

    // Tampered signature
    const tamperedSigToken = `${userId}.badsignature1234567890abcdef`;
    expect(verifyVendorSessionToken(tamperedSigToken)).toBeNull();

    // Malformed token
    expect(verifyVendorSessionToken("")).toBeNull();
    expect(verifyVendorSessionToken("not-a-token")).toBeNull();
  });
});
