import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests hit a real test database and are opt-in (docs/PHASES.md P15).
    exclude: ["node_modules/**", "tests/integration/**"],
    /**
     * src/env.ts validates eagerly and throws, so the suite cannot even import the
     * app without a complete environment. These are throwaway values — the point is
     * to exercise the code, not to reach any real service.
     */
    env: {
      NODE_ENV: "test",
      // Unused by the suite: tests bind an ephemeral port via listen(0) directly.
      PORT: "4000",
      CORS_ORIGINS: "http://localhost:3000",
      MONGODB_URI: "mongodb://127.0.0.1:27017",
      MONGODB_DB: "trefood_test",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      RAZORPAY_KEY_ID: "rzp_test_key",
      RAZORPAY_KEY_SECRET: "test-secret",
      RAZORPAY_WEBHOOK_SECRET: "test-webhook-secret",
      VAPID_PUBLIC_KEY: "test-vapid-public",
      VAPID_PRIVATE_KEY: "test-vapid-private",
      VAPID_SUBJECT: "mailto:test@trefood.in",
      CRON_SECRET: "0".repeat(32),
    },
  },
});
