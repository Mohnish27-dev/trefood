import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInPicker, type SignInAccount } from "@/components/student/sign-in-picker";
import { StudentAuthForm } from "@/components/student/student-auth-form";
import { getSession, listDemoUsers } from "@/server/auth/session";
import { getQuickUnlockDeviceState } from "@/server/auth/quick-unlock-cookies";
import { getRestaurantById } from "@/server/services/catalog";
import { serverEnv } from "@/lib/env";
import { landingForRole, resolveLandingPath } from "@/lib/routes";
import { isVendorRole } from "@/lib/quick-unlock";
import { ROLE } from "@/lib/constants";

export const metadata: Metadata = { title: "Sign in · TREFOOD" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; tab?: string }>;
}) {
  const { next, reason, tab } = await searchParams;
  const session = await getSession();

  // If already signed in as vendor: redirect to vendor console
  if (
    session &&
    (session.role === ROLE.VENDOR_OWNER || session.role === ROLE.VENDOR_STAFF)
  ) {
    redirect(resolveLandingPath(next, session.role));
  }

  // Already signed in and no role complaint? Redirect immediately.
  if (session && !reason) {
    redirect(resolveLandingPath(next, session.role));
  }

  const quickUnlockDevice = await getQuickUnlockDeviceState();

  // Redirect any vendor-specific access to the dedicated vendor login page.
  const isVendorIntent =
    tab === "vendor" ||
    reason === "vendor" ||
    Boolean(next && /^\/vendor(\/|$)/.test(next)) ||
    (quickUnlockDevice.trusted && isVendorRole(quickUnlockDevice.role));

  if (isVendorIntent) {
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (reason && reason !== "student") params.set("reason", reason);
    const qs = params.toString();
    redirect(`/vendor/login${qs ? `?${qs}` : ""}`);
  }

  const isStub = serverEnv().AUTH_PROVIDER === "stub";

  // In stub mode on the student login page, filter out vendor accounts.
  // Partner accounts are only visible on the dedicated vendor login page.
  const accounts: SignInAccount[] = [];
  if (isStub) {
    for (const user of await listDemoUsers()) {
      if (isVendorRole(user.role)) continue;
      const restaurant = user.restaurantId ? await getRestaurantById(user.restaurantId) : null;
      accounts.push({
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantName: restaurant?.name ?? null,
        strikes: user.strikes,
        lands: landingForRole(user.role),
      });
    }
  }

  return (
    <main className="min-h-dvh bg-tf-maroon-deep">
      {/* ── Student Authentication Screen ─────────── */}
      <StudentAuthForm
        redirectTo={next ?? null}
        quickUnlockDevice={quickUnlockDevice}
        reason={reason}
      >
        {/* ── Demo accounts (Stub mode only, collapsible, non-vendor only) ─────────── */}
        {isStub && accounts.length > 0 ? (
          <div className="w-full px-7 pb-6 pt-2">
            <details className="group rounded-2xl border border-line bg-surface/70 backdrop-blur-md p-4 text-xs">
              <summary className="cursor-pointer font-semibold text-muted hover:text-bone transition-colors flex items-center justify-between select-none">
                <span>Demo &amp; Staff Accounts (Test Mode)</span>
                <span className="text-faint text-[10px] group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="mt-4 pt-4 border-t border-line">
                <SignInPicker accounts={accounts} redirectTo={next ?? null} />
              </div>
            </details>
          </div>
        ) : null}
      </StudentAuthForm>
    </main>
  );
}
