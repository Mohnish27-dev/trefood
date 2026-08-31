import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Honours the `@/*` alias from tsconfig.json, so tests import exactly what src does.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests hit a real test database and are opt-in (docs/PHASES.md P15).
    exclude: ["node_modules/**", "tests/integration/**"],
  },
});
