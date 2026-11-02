import "server-only";

import { cookies } from "next/headers";

import { DEMO_USER_COOKIE } from "@/server/auth/session";
import { VENDOR_SESSION_COOKIE } from "@/server/auth/passwords";
import { QUICK_UNLOCK_SESSION_COOKIE } from "@/server/auth/quick-unlock";
import { authCookieDomain, destroyCurrentSession } from "@/server/auth/session-store";

/** End authentication while preserving the device trust used on the PIN screen. */
export async function logoutCurrentSession(): Promise<void> {
  await destroyCurrentSession();
  const store = await cookies();
  store.delete(DEMO_USER_COOKIE);
  store.delete(VENDOR_SESSION_COOKIE);
  store.delete({ name: QUICK_UNLOCK_SESSION_COOKIE, path: "/", domain: authCookieDomain() });
}
