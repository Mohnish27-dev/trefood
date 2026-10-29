import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/passwords";

describe("Admin Vendor Credentials & Onboarding", () => {
  it("generates a salted scrypt hash that successfully verifies", () => {
    const rawPassword = "VendorSecurePassword#2026";
    const storedHash = hashPassword(rawPassword);

    expect(storedHash).toBeTruthy();
    expect(storedHash.split(":")).toHaveLength(2);
    expect(verifyPassword(rawPassword, storedHash)).toBe(true);
    expect(verifyPassword("WrongPassword123", storedHash)).toBe(false);
  });

  it("handles empty or blank credentials safely", () => {
    expect(verifyPassword("", "")).toBe(false);
    expect(verifyPassword("somepass", "")).toBe(false);
    expect(verifyPassword("", "invalidhash")).toBe(false);
  });

  it("produces different hashes for the same password due to random salting", () => {
    const pwd = "RepeatPassword999";
    const hashA = hashPassword(pwd);
    const hashB = hashPassword(pwd);

    expect(hashA).not.toEqual(hashB);
    expect(verifyPassword(pwd, hashA)).toBe(true);
    expect(verifyPassword(pwd, hashB)).toBe(true);
  });
});
