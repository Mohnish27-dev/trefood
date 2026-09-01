import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/lib/env";

/**
 * Server-side Supabase client for Server Components, Server Actions, and Route Handlers.
 * Handles reading and setting auth session cookies.
 */
export async function createSupabaseServerClient() {
  const rawUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl || !anonKey) {
    throw new Error(
      "Supabase public credentials missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  const url = rawUrl.trim().replace(/^=+/, "").trim();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // The `setAll` method was called from a Server Component.
          // This is expected and safe when middleware/proxy refreshes user sessions.
        }
      },
    },
  });
}
