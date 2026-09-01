import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Load .env.local the way Next does, so integration tests hit the same
 * database the dev server does. Unit tests need none of this, but they are
 * unaffected by it.
 */
function loadEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(".env.local", "utf8");
    const env: Record<string, string> = {};
    // Split on /\r?\n/, not "\n". On a CRLF file the trailing \r survives,
    // and JavaScript's `.` does not match \r — so `(.*)$` silently fails on
    // every line that actually has a value, leaving only the empty ones.
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match?.[1]) continue;
      env[match[1]] = (match[2] ?? "").trim().replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

export default defineConfig({
  resolve: {
    // Native tsconfig path resolution — no plugin needed.
    tsconfigPaths: true,
    alias: {
      // `server-only` throws on import outside a Server Component. Under Next
      // the "react-server" condition resolves it to an empty module; Vitest
      // does not apply that condition, so alias it to the package's own empty
      // entry point. This is the same file Next would load — not a stub.
      "server-only": resolve(process.cwd(), "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Pure domain code (pricing, FSM, curfew) must be testable with no HTTP,
    // no session and no React. PROJECT_STRUCTURE.md section 1.
    globals: false,
    env: loadEnvLocal(),
    // Integration tests share one database, so they must not race each other.
    fileParallelism: false,
  },
});
