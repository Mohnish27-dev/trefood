import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * One-decimal rating, e.g. 4.0 rather than "4".
 *
 * Intl rather than toFixed because toFixed is banned repo-wide (it is how a
 * float sneaks into a money path) and a rating should not be the exception
 * that teaches people the rule is negotiable.
 */
const ratingFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatRating(rating: number): string {
  return ratingFormat.format(rating);
}
