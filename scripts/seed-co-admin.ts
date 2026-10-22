/**
 * Co-admin account seeding.
 *
 * Seeds the co-admin login: the admin console without earnings,
 * settlements, pricing, students, the Issue Desk or the audit log, and with
 * vendors and campuses view-only.
 *
 * The email and password come from CO_ADMIN_EMAIL and CO_ADMIN_PASSWORD in
 * .env.local (gitignored), so the credentials never land in the repo.
 *
 * Idempotent. If the email already exists (say, as a student who signed in
 * with Google), that account is promoted in place so its sign-in keeps
 * working.
 *
 * Usage:
 *   npm run seed:coadmin
 */

import { ROLE } from "@/lib/constants";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { User } from "@/types/user";

const CO_ADMIN_USER_ID = "user_co_admin";

async function main(): Promise<void> {
  const email = process.env.CO_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.CO_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set CO_ADMIN_EMAIL and CO_ADMIN_PASSWORD in .env.local first.");
  }

  const now = new Date();
  const passwordHash = hashPassword(password);
  const users = await db.users();

  const existing = await users.findOne({ email });
  if (existing && existing._id !== CO_ADMIN_USER_ID) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          role: ROLE.CO_ADMIN,
          passwordHash,
          passwordChangedAt: now,
          restaurantId: null,
          updatedAt: now,
        },
      },
    );
    console.log(`[x] Existing account "${email}" promoted to co-admin.`);
  } else {
    const coAdmin: User = {
      _id: CO_ADMIN_USER_ID,
      authId: null,
      role: ROLE.CO_ADMIN,
      name: "Co-admin",
      email,
      phone: null,
      passwordHash,
      passwordChangedAt: now,
      campusId: null,
      restaurantId: null,
      strikes: 0,
      ordersBlocked: false,
      ordersBlockedReason: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await users.replaceOne({ _id: CO_ADMIN_USER_ID }, coAdmin, { upsert: true });
    console.log(`[x] Co-admin "${email}" created/updated.`);
  }

  const client = await getMongoClient();
  await client.close();
}

main().catch((error: unknown) => {
  console.error("\nCo-admin seed failed:\n", error);
  process.exitCode = 1;
});
