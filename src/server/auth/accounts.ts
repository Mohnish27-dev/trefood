import "server-only";

import * as db from "@/server/db/collections";
import { ROLE } from "@/lib/constants";
import { newId } from "@/lib/ids";
import { normaliseEmail } from "@/server/auth/otp";
import type { User } from "@/types/user";

/**
 * Account provisioning, in one place.
 *
 * Google sign-in and code-verified sign-up both end here. When they did not,
 * the two paths drifted: one set `campusId`, the other did not, and a student
 * who happened to arrive through Google saw an empty restaurant list. The
 * defaults for a new account are a single fact and they live in one function.
 */

/** Raised when a Google profile cannot be attached to the account it names. */
export class AccountLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountLinkError";
  }
}

/** The only live campus. Matches DEFAULT_CAMPUS_SLUG in `@/lib/routes`. */
const DEFAULT_CAMPUS_ID = "campus_nitp";

export interface NewAccountInput {
  email: string;
  name: string;
  emailVerified: boolean;
  passwordHash?: string | null;
  googleId?: string | null;
}

/** A blank student, with every field the domain later assumes is present. */
export function buildStudent(input: NewAccountInput): User {
  const now = new Date();
  return {
    _id: newId("usr"),
    authId: null,
    googleId: input.googleId ?? null,
    role: ROLE.STUDENT,
    name: input.name.trim() || input.email.split("@")[0] || "Student",
    email: normaliseEmail(input.email),
    emailVerified: input.emailVerified,
    phone: null,
    passwordHash: input.passwordHash ?? null,
    passwordChangedAt: input.passwordHash ? now : null,
    campusId: DEFAULT_CAMPUS_ID,
    restaurantId: null,
    ordersBlocked: false,
    ordersBlockedReason: null,
    strikes: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Finds the account a Google profile belongs to, creating it if it is new.
 *
 * Matching is by `googleId` first and email second. The email fallback is what
 * carries a pre-migration account across: it already exists, with its order
 * history and its strikes, and the only thing missing is the Google subject —
 * so we link rather than create a duplicate the student would have to explain.
 *
 * The fallback is only allowed for an address Google says it has verified.
 * Without that check, anyone able to mint a Google account claiming an
 * unverified address could adopt a TREFOOD account by email alone.
 */
export async function upsertGoogleAccount(profile: {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}): Promise<{ user: User; created: boolean }> {
  const users = await db.users();
  const email = normaliseEmail(profile.email);
  const now = new Date();

  const byGoogleId = await users.findOne({ googleId: profile.googleId });
  if (byGoogleId) {
    await users.updateOne(
      { _id: byGoogleId._id },
      { $set: { emailVerified: true, updatedAt: now } },
    );
    return { user: { ...byGoogleId, emailVerified: true }, created: false };
  }

  const byEmail = await users.findOne({ email });

  if (byEmail) {
    if (!profile.emailVerified) {
      // Refused explicitly rather than left to collide on the unique email
      // index. The caller already rejects unverified addresses, so reaching
      // here means something upstream changed, and a named error says so
      // instead of surfacing a duplicate-key stack trace.
      throw new AccountLinkError(
        "Google has not verified that address, so it cannot be linked to an existing account.",
      );
    }

    await users.updateOne(
      { _id: byEmail._id },
      { $set: { googleId: profile.googleId, emailVerified: true, updatedAt: now } },
    );
    return {
      user: { ...byEmail, googleId: profile.googleId, emailVerified: true },
      created: false,
    };
  }

  const student = buildStudent({
    email,
    name: profile.name ?? "",
    emailVerified: profile.emailVerified,
    googleId: profile.googleId,
  });

  await users.insertOne(student);
  return { user: student, created: true };
}

/**
 * Whether this account predates TREFOOD owning its authentication.
 *
 * Such an account has a record here but its password lived in the old hosted
 * provider, which cannot export hashes. It is not broken and it is not a
 * stranger: it needs one emailed code to set a password it owns.
 */
export function needsPasswordSetup(user: User): boolean {
  return !user.passwordHash;
}
