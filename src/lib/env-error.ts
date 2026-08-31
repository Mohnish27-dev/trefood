import type { ZodError } from "zod";

/**
 * Renders a Zod environment failure as something a human can act on at 1 AM.
 *
 * The important property is that it lists EVERY problem at once. Fixing one missing
 * secret, redeploying, and discovering the next one is three deploys to learn what
 * one message could have said.
 *
 * Kept in its own module (rather than inside `env.ts`) because `env.ts` validates at
 * import time — a test that imports it would need a fully populated environment just
 * to check a string formatter.
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
    "Fix .env.local (copy .env.local.example), or set these in the Vercel project settings.",
  ].join("\n");
}
