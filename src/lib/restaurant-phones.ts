import type { Restaurant } from "@/types/restaurant";

/** Indian mobile or landline, optional leading +, 10 to 15 digits. */
export const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

/** A restaurant can list at most this many numbers. */
export const MAX_RESTAURANT_PHONES = 5;

/**
 * Every number for a restaurant, primary first, no duplicates.
 *
 * `phone` wins the first slot even if `phones` disagrees, because it is the
 * field orders snapshot and scripts rewrite; `phones` only adds to it.
 */
export function restaurantPhones(restaurant: Pick<Restaurant, "phone" | "phones">): string[] {
  const all = [restaurant.phone, ...(restaurant.phones ?? [])].map((p) => p.trim());
  return [...new Set(all.filter((p) => p !== ""))];
}
