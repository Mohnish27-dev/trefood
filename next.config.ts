import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle. Required for a small Docker image and for
  // any host that is not Vercel. On Vercel, native serverless deployment is used.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),

  reactStrictMode: true,

  // allowedDevOrigins: ["brute-heap-ashamed.ngrok-free.dev"],

  // Menu images live in Supabase Storage, never in Mongo (DECISIONS.md section 3).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
