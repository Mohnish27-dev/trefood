import "server-only";

import { createClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "@/lib/env";

/**
 * Service role admin client for server-side trusted operations.
 * Never expose this client or the service role key to the browser.
 */
export function createSupabaseAdminClient() {
  const rawUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = serverEnv().SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceKey) {
    throw new Error(
      "Supabase service credentials missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  const url = rawUrl.trim().replace(/^=+/, "").trim();
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
