import { describe, expect, it } from "vitest";

import { generatePinSalt, hashPin } from "@/lib/quick-unlock";
import {
  createQuickUnlockToken,
  credentialIdMatches,
  hashQuickPin,
  verifyQuickPin,
  verifyQuickUnlockToken,
} from "@/server/auth/quick-unlock";

/**
 * The browser and the server must agree on the PIN scheme, because the PIN is
 * set in the browser and from now on verified on the server. If these two ever
 * drift, a correct PIN starts being rejected and the person is back to the
 * sign-in loop this module exists to end.
 */
describe("Quick unlock PIN — browser/server parity", () => {
  it("hashes a PIN identically on both sides", async () => {
    const salt = generatePinSalt();
    const browserHash = await hashPin("4821", salt);

    expect(hashQuickPin("4821", salt)).toBe(browserHash);
  });

  it("verifies a PIN that was set up in the browser", async () => {
    const salt = generatePinSalt();
    const stored = await hashPin("0007", salt);

    expect(verifyQuickPin("0007", stored, salt)).toBe(true);
    expect(verifyQuickPin("0070", stored, salt)).toBe(false);
  });

  it("rejects a PIN checked against another account's salt", async () => {
    const stored = await hashQuickPin("1234", generatePinSalt());

    expect(verifyQuickPin("1234", stored, generatePinSalt())).toBe(false);
  });

  it("rejects malformed stored hashes instead of throwing", () => {
    expect(verifyQuickPin("1234", "", "salt")).toBe(false);
    expect(verifyQuickPin("1234", "not-hex", "salt")).toBe(false);
  });
});

describe("Quick unlock tokens", () => {
  it("round-trips a user id", () => {
    const token = createQuickUnlockToken("device", "usr_abc123");

    expect(verifyQuickUnlockToken("device", token)).toBe("usr_abc123");
  });

  it("refuses a device token presented as a session token", () => {
    const deviceToken = createQuickUnlockToken("device", "usr_abc123");

    // The whole point of the split: holding "this phone is mine" must never be
    // enough to be signed in. Only a verified PIN mints the session half.
    expect(verifyQuickUnlockToken("session", deviceToken)).toBeNull();
  });

  it("refuses a token whose user id has been swapped", () => {
    const token = createQuickUnlockToken("session", "usr_victim");
    const signature = token.slice(token.lastIndexOf(".") + 1);

    expect(verifyQuickUnlockToken("session", `usr_attacker.${signature}`)).toBeNull();
  });

  it("refuses tampered or malformed tokens", () => {
    expect(verifyQuickUnlockToken("device", "usr_abc123")).toBeNull();
    expect(verifyQuickUnlockToken("device", "usr_abc123.deadbeef")).toBeNull();
    expect(verifyQuickUnlockToken("device", "")).toBeNull();
    expect(verifyQuickUnlockToken("device", ".abc")).toBeNull();
  });

  it("keeps user ids containing dots intact", () => {
    const token = createQuickUnlockToken("session", "usr.with.dots");

    expect(verifyQuickUnlockToken("session", token)).toBe("usr.with.dots");
  });
});

describe("Biometric credential matching", () => {
  it("matches the registered credential and nothing else", () => {
    expect(credentialIdMatches("cred-abc", "cred-abc")).toBe(true);
    expect(credentialIdMatches("cred-abc", "cred-xyz")).toBe(false);
    expect(credentialIdMatches("cred-abc", "cred-abc-longer")).toBe(false);
  });

  it("treats a missing credential on either side as a failure", () => {
    expect(credentialIdMatches(null, "cred-abc")).toBe(false);
    expect(credentialIdMatches("cred-abc", null)).toBe(false);
    expect(credentialIdMatches(undefined, undefined)).toBe(false);
    expect(credentialIdMatches("", "")).toBe(false);
  });
});
