import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const config = {
  plugins: {
    /**
     * `base` is the directory Tailwind resolves bare `@import "pkg"` specifiers from.
     *
     * It must be the monorepo root, not this package: npm hoists shared dependencies
     * to the root `node_modules`, and Tailwind v4's resolver does not walk up past a
     * package boundary on its own. Without this, `@import "tw-animate-css"` in
     * globals.css fails with "Can't resolve" even though the package is installed.
     *
     * Relative imports inside a stylesheet are unaffected — those resolve against the
     * file that contains them.
     */
    "@tailwindcss/postcss": { base: path.join(here, "..") },
  },
};

export default config;
