import { z } from "zod";

/**
 * Post-delivery feedback, validated at the boundary.
 *
 * This lives here rather than beside the Server Action that uses it because a
 * `"use server"` module may only export async functions. Exporting a schema
 * from one throws at module evaluation and takes every action in that file
 * down with it, before a single line of action code runs.
 */
export const feedbackSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  rating: z
    .number()
    .int()
    .min(1, "Rating must be at least 1 star")
    .max(5, "Rating cannot exceed 5 stars"),
  comment: z
    .string()
    .trim()
    .max(500, "Feedback must be 500 characters or less")
    .optional()
    .nullable(),
  tags: z.array(z.string().trim().max(50)).max(10).optional(),
});
