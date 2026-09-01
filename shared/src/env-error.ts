import type { ZodError } from "zod";

/**
 * Renders a Zod environment failure as something a human can act on at 1 AM.
 *
 * The important property is that it lists EVERY problem at once. Fixing one missing
 * secret, redeploying, and discovering the next one is three deploys to learn what
 * one message could have said.
 *
 * Kept in its own module (rather than inside an env schema) because those validate at
 * import time — a test that imports one would need a fully populated environment just
 * to check a string formatter.
 *
 * Lives in `shared` because backend and frontend each validate their own half of the
 * environment and must fail in the same readable way.
 */
export function formatEnvError(scope: string, error: ZodError): string {
  const lines = error.issues.map((issue) => {
    const key = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  ${key}: ${issue.message}`;
  });

  return [
    `Invalid ${scope} environment. The app will not start.`,
    ...lines,
    "",
    "Copy the matching .env.example in this package and fill it in, or set these in your deployment environment.",
  ].join("\n");
}
