"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/server/auth/session";
import {
  toggleFavouriteRestaurant,
  updateStudentProfile,
} from "@/server/services/account";

/**
 * The two things a student may change about their own account.
 *
 * Both re-read the session server-side rather than trusting an id from the
 * client, the same rule `placeOrder` follows. There is no `userId` in either
 * schema on purpose — if one appeared, editing someone else's profile would be
 * a form field away.
 */

export type AccountActionState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/* ══════════════════════════════════════════════════════════════════════
   Profile
   ══════════════════════════════════════════════════════════════════════ */

const profileSchema = z.object({
  name: z.string().trim().min(2, "Your name needs at least two letters").max(60),
  // Same shape as checkout (D7). An empty string means "not given yet" rather
  // than an invalid number, because the number is genuinely optional until the
  // first order.
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, ""))
    .refine((value) => value === "" || /^\+?[0-9]{10,15}$/.test(value), {
      message: "Enter a valid phone number",
    }),
});

/**
 * Name and phone only.
 *
 * Email is the account's identity and is not editable here — changing it
 * would orphan the auth record. Campus is not editable either: it decides
 * which restaurants exist, and switching it mid-cart is a support ticket, not
 * a text field.
 */
export async function updateProfile(input: unknown): Promise<AccountActionState> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the details and try again.",
    };
  }

  const { user } = await requireSession();

  const updated = await updateStudentProfile({
    userId: user._id,
    name: parsed.data.name,
    phone: parsed.data.phone === "" ? null : parsed.data.phone,
  });

  if (!updated) return { status: "error", message: "We could not save that. Try again." };

  revalidatePath("/account");
  revalidatePath("/checkout");

  return { status: "ok", message: "Profile updated." };
}

/* ══════════════════════════════════════════════════════════════════════
   Favourites
   ══════════════════════════════════════════════════════════════════════ */

const favouriteSchema = z.object({ restaurantId: z.string().min(1) });

/**
 * Star or un-star a restaurant. Returns the new state so the heart can settle
 * on the truth even if the optimistic flip guessed wrong.
 */
export async function toggleFavourite(
  input: unknown,
): Promise<AccountActionState & { favourited?: boolean }> {
  const parsed = favouriteSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Unknown restaurant." };

  const { user } = await requireSession();

  const result = await toggleFavouriteRestaurant({
    userId: user._id,
    restaurantId: parsed.data.restaurantId,
  });

  if (!result) return { status: "error", message: "We could not save that. Try again." };

  revalidatePath("/account/favourites");

  return {
    status: "ok",
    favourited: result.favourited,
    message: result.favourited ? "Added to favourites." : "Removed from favourites.",
  };
}
