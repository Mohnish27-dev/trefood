import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInPicker, type SignInAccount } from "@/components/student/sign-in-picker";
import { StudentAuthForm } from "@/components/student/student-auth-form";
import { getSession, listDemoUsers } from "@/server/auth/session";
import { getQuickUnlockDeviceState } from "@/server/auth/quick-unlock-cookies";
import { getRestaurantById } from "@/server/services/catalog";
import { serverEnv } from "@/lib/env";
import { landingForRole, resolveLandingPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in · TREFOOD" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; tab?: string }>;
}) {
  const { next, reason, tab } = await searchParams;
  const session = await getSession();

  // Already signed in and no role complaint? Redirect immediately.
  if (session && !reason) {
    redirect(resolveLandingPath(next, session.role));
  }

  const quickUnlockDevice = await getQuickUnlockDeviceState();

  const isStub = serverEnv().AUTH_PROVIDER === "stub";
  const users = await listDemoUsers();

  const accounts: SignInAccount[] = [];
  for (const user of users) {
    const restaurant = user.restaurantId ? await getRestaurantById(user.restaurantId) : null;
    accounts.push({
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantName: restaurant?.name ?? null,
      codBlocked: user.codBlocked,
      strikes: user.strikes,
      lands: landingForRole(user.role),
    });
  }

  const initialType = reason === "vendor" || tab === "vendor" ? "vendor" : "student";

  return (
    <main className="min-h-dvh bg-ink text-bone">
      {/* ── Customer & Vendor Authentication Screen ─────────── */}
      <StudentAuthForm
        redirectTo={next ?? null}
        initialType={initialType}
        quickUnlockDevice={quickUnlockDevice}
        reason={reason}
      />

      {/* ── Demo accounts (Stub mode only, collapsible) ─────────── */}
      {isStub && accounts.length > 0 ? (
        <div className="mx-auto w-full max-w-md px-5 pb-12 pt-2">
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
    </main>
  );
}
