import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle. Required for a small Docker image and for
  // any host that is not Vercel. See docs/PHASE_PLAN.md section 2.
  output: "standalone",

  reactStrictMode: true,

  // Menu images live in Supabase Storage, never in Mongo (DECISIONS.md section 3).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
