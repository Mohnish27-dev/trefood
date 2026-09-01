import path from "node:path";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * This package is not the repo root, so Next must be told where the workspace
   * actually starts — otherwise it infers the wrong root and traces the wrong
   * node_modules, missing @trefood/shared which is hoisted above this package.
   */
  outputFileTracingRoot: path.join(here, ".."),

  // @trefood/shared ships as ESM built by tsc; Next compiles it with the app.
  transpilePackages: ["@trefood/shared"],

  // Menu photos live in Supabase Storage, never in MongoDB (docs/DECISIONS.md §3).
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Quiet unless something is wrong; a build log full of upload chatter hides real errors.
  silent: !process.env.CI,

  // Source-map upload needs SENTRY_AUTH_TOKEN. Absent locally, present in CI/deploy.
  widenClientFileUpload: true,
});
