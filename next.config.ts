import type { NextConfig } from "next";

const allowedOrigins = [
  "trefood.in",
  "*.trefood.in",
  "localhost:3000",
];

if (process.env.NEXT_PUBLIC_APP_URL) {
  try {
    const parsed = new URL(process.env.NEXT_PUBLIC_APP_URL);
    if (!allowedOrigins.includes(parsed.host)) {
      allowedOrigins.push(parsed.host);
    }
  } catch {
    // Ignore invalid URL
  }
}

const nextConfig: NextConfig = {
  // Self-contained server bundle. Required for a small Docker image and for
  // any host that is not Vercel. On Vercel, native serverless deployment is used.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),

  reactStrictMode: true,

  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },

  // Menu images live in Supabase Storage, never in Mongo (DECISIONS.md section 3).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
