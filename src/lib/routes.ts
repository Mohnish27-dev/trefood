import { ROLE, type Role } from "@/lib/constants";

/**
 * Where a signed-in person belongs.
 *
 * TREFOOD runs on exactly one campus today (NIT Patna), so "signed in" and
 * "looking at a restaurant list" are the same moment. Nobody should ever be
 * dropped back on the marketing page after authenticating — that page exists
 * for people who do not have an account yet.
 *
 * Every auth path (password, Google OAuth, magic link, demo picker, quick
 * PIN) funnels through `landingForRole` / `resolveLandingPath` so there is a
 * single place to change when the second campus arrives.
 */

/** The only live campus. When there are two, this becomes a lookup. */
export const DEFAULT_CAMPUS_SLUG = "nit-patna";

/** The student home — the restaurant list, not the marketing page. */
export const CAMPUS_HOME = `/c/${DEFAULT_CAMPUS_SLUG}`;

export const VENDOR_HOME = "/vendor/orders";
export const ADMIN_HOME = "/admin/orders";

/** The post-sign-in destination for a role. */
export function landingForRole(role: string | null | undefined): string {
  if (role === ROLE.VENDOR_OWNER || role === ROLE.VENDOR_STAFF) return VENDOR_HOME;
  if (role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN) return ADMIN_HOME;
  return CAMPUS_HOME;
}

/**
 * A `next=` value is only honoured when it is a local path that actually goes
 * somewhere. `//evil.com` is rejected (open redirect), and a bare `/` is
 * treated as "no preference" rather than "send me to the landing page" —
 * that is the bug this module exists to prevent.
 */
export function resolveLandingPath(
  requested: string | null | undefined,
  role?: Role | string | null,
): string {
  if (requested && requested !== "/" && /^\/(?!\/)/.test(requested)) return requested;
  return landingForRole(role);
}
