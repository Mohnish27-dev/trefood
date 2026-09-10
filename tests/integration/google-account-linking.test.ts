import { afterEach, describe, expect, it } from "vitest";

import * as db from "@/server/db/collections";
import { buildStudent, needsPasswordSetup, upsertGoogleAccount } from "@/server/auth/accounts";
import { ROLE } from "@/lib/constants";

/**
 * What happens to an existing account when its owner presses "Continue with
 * Google" for the first time.
 *
 * This is the migration path, and getting it wrong is expensive in a way tests
 * are cheap: linking too eagerly hands an account to a stranger, and linking
 * too timidly gives a real student a second, empty account with none of their
 * order history in it.
 */

const EMAIL = "google-link@trefood.test";
const OTHER_EMAIL = "google-other@trefood.test";

async function cleanup(): Promise<void> {
  await (await db.users()).deleteMany({ email: { $in: [EMAIL, OTHER_EMAIL] } });
}

describe("Google account linking", () => {
  afterEach(cleanup);

  it("creates a verified student when the address is new", async () => {
    const { user, created } = await upsertGoogleAccount({
      googleId: "google-sub-new",
      email: EMAIL,
      emailVerified: true,
      name: "New Student",
    });

    expect(created).toBe(true);
    expect(user.role).toBe(ROLE.STUDENT);
    expect(user.googleId).toBe("google-sub-new");
    expect(user.emailVerified).toBe(true);
    expect(user.name).toBe("New Student");
    // Without a campus the restaurant list renders empty, which is how the two
    // sign-up paths drifted apart before they shared this function.
    expect(user.campusId).toBe("campus_nitp");
    expect(user.passwordHash).toBeNull();
  });

  it("adopts a pre-existing account by email, keeping its history", async () => {
    const existing = buildStudent({
      email: EMAIL,
      name: "Long-standing Student",
      emailVerified: false,
      passwordHash: "salt:hash",
    });
    existing.strikes = 2;
    existing.phone = "9876543210";
    await (await db.users()).insertOne(existing);

    const { user, created } = await upsertGoogleAccount({
      googleId: "google-sub-existing",
      email: EMAIL,
      emailVerified: true,
      name: "Long-standing Student",
    });

    expect(created).toBe(false);
    expect(user._id).toBe(existing._id);
    expect(user.googleId).toBe("google-sub-existing");
    expect(user.emailVerified).toBe(true);
    // The account is the same account: strikes, phone and password survive.
    expect(user.strikes).toBe(2);
    expect(user.phone).toBe("9876543210");
    expect(user.passwordHash).toBe("salt:hash");

    expect(await (await db.users()).countDocuments({ email: EMAIL })).toBe(1);
  });

  it("refuses to adopt an account when Google has not verified the address", async () => {
    const existing = buildStudent({ email: EMAIL, name: "Victim", emailVerified: true });
    await (await db.users()).insertOne(existing);

    // An unverified address is a claim, not a fact. Adopting on one lets
    // anybody who can mint such a Google account walk into this account.
    await expect(
      upsertGoogleAccount({
        googleId: "google-sub-attacker",
        email: EMAIL,
        emailVerified: false,
        name: "Attacker",
      }),
    ).rejects.toThrow(/has not verified/i);

    const untouched = await (await db.users()).findOne({ _id: existing._id });
    expect(untouched?.googleId).toBeNull();
  });

  it("matches on the Google subject even after the address changes hands", async () => {
    const first = await upsertGoogleAccount({
      googleId: "google-sub-stable",
      email: EMAIL,
      emailVerified: true,
      name: "Original",
    });

    const again = await upsertGoogleAccount({
      googleId: "google-sub-stable",
      email: EMAIL,
      emailVerified: true,
      name: "Original",
    });

    expect(again.created).toBe(false);
    expect(again.user._id).toBe(first.user._id);
  });

  it("marks a Google-only account as needing a password", () => {
    const googleOnly = buildStudent({
      email: OTHER_EMAIL,
      name: "Google Only",
      emailVerified: true,
      googleId: "google-sub-only",
    });
    expect(needsPasswordSetup(googleOnly)).toBe(true);

    const withPassword = buildStudent({
      email: OTHER_EMAIL,
      name: "Has Password",
      emailVerified: true,
      passwordHash: "salt:hash",
    });
    expect(needsPasswordSetup(withPassword)).toBe(false);
  });

  it("falls back to the address when Google sends no name", async () => {
    const { user } = await upsertGoogleAccount({
      googleId: "google-sub-nameless",
      email: EMAIL,
      emailVerified: true,
      name: null,
    });

    expect(user.name).toBe("google-link");
  });
});
