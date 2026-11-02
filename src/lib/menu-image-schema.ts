import { z } from "zod";

// Shared by vendor and admin actions. Schema objects cannot be exported from
// a "use server" module: Next.js validates every runtime export as an action.
export const menuItemImageUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) =>
      val === "" ||
      val.startsWith("/") ||
      val.startsWith("http://") ||
      val.startsWith("https://") ||
      val.startsWith("data:image/"),
    { message: "Image URL must be a valid web URL or a path starting with '/'" },
  )
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .optional();
