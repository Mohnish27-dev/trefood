import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Menu photos live in Supabase Storage, never in MongoDB (docs/DECISIONS.md §3).
  // The hostname is derived from the Supabase URL so a project change needs no edit here.
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

  // The MongoDB driver must not be bundled; it loads native/optional deps at runtime.
  serverExternalPackages: ["mongodb"],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Quiet unless something is wrong; a build log full of upload chatter hides real errors.
  silent: !process.env.CI,

  // Source-map upload needs SENTRY_AUTH_TOKEN. Absent locally, present on Vercel.
  widenClientFileUpload: true,
});
