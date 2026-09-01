import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";

/**
 * Browser-side Supabase client.
 * Used in Client Components for auth triggers (Google OAuth, Email/Password, OTP).
 */
export function createClient() {
  const rawUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl || !anonKey) {
    throw new Error(
      "Supabase public credentials missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  const url = rawUrl.trim().replace(/^=+/, "").trim();
  return createBrowserClient(url, anonKey);
}
