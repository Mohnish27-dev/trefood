import "server-only";

import * as db from "@/server/db/collections";
import type { User } from "@/types/user";

/**
 * The student's own account: the profile they can edit and the restaurants
 * they starred.
 *
 * Deliberately narrow. Nothing here can change standing (strikes, the COD
 * block, role, campus) — those belong to students.ts and to an admin. A
 * student editing their own profile must never be a path to editing their own
 * risk flags, so those fields are simply not reachable from this file.
 */

/** The most a student may keep starred. Past this the list stops being useful. */
export const MAX_FAVOURITES = 60;

export async function updateStudentProfile(params: {
  userId: string;
  name: string;
  phone: string | null;
}): Promise<User | null> {
  const users = await db.users();

  return users.findOneAndUpdate(
    { _id: params.userId },
    {
      $set: {
        name: params.name,
        phone: params.phone,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
}

export interface FavouriteToggleResult {
  favourited: boolean;
  ids: string[];
}

/**
 * Star or un-star a restaurant.
 *
 * Read-modify-write rather than `$addToSet`, because the order matters: a new
 * favourite goes to the FRONT so the list reads newest-first, which `$addToSet`
 * cannot express. The window for a lost concurrent write is a student tapping
 * two hearts in the same instant on two devices, which is not a real scenario.
 */
export async function toggleFavouriteRestaurant(params: {
  userId: string;
  restaurantId: string;
}): Promise<FavouriteToggleResult | null> {
  const users = await db.users();

  const user = await users.findOne({ _id: params.userId });
  if (!user) return null;

  const current = user.favouriteRestaurantIds ?? [];
  const already = current.includes(params.restaurantId);

  const next = already
    ? current.filter((id) => id !== params.restaurantId)
    : [params.restaurantId, ...current].slice(0, MAX_FAVOURITES);

  await users.updateOne(
    { _id: params.userId },
    { $set: { favouriteRestaurantIds: next, updatedAt: new Date() } },
  );

  return { favourited: !already, ids: next };
}
