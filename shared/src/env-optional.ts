import { z } from "zod";

/**
 * Makes an optional environment variable tolerate a blank value.
 *
 * This exists because of how people actually configure the app: they copy
 * `.env.example`, which lists every key including the optional ones, and fill in only
 * what they have. The optional keys are then present but empty — and `""` is not
 * `undefined`, so `z.url().optional()` rejects it and the service refuses to boot over
 * a Sentry DSN nobody wanted.
 *
 * Wrapping the schema converts `""` to `undefined` first, so a blank line in a `.env`
 * file means "not set", which is what everyone assumes it means.
 *
 *   SENTRY_DSN: optional(z.url())
 */
export function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );
}

/** Same treatment, for an optional variable that has a default when unset. */
export function optionalWithDefault<T extends z.ZodType>(
  schema: T,
  fallback: z.output<T>,
) {
  return z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    schema.optional().transform((parsed) => parsed ?? fallback),
  );
}
