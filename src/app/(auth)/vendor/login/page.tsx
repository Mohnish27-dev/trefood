import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInPicker, type SignInAccount } from "@/components/student/sign-in-picker";
import { VendorAuthForm } from "@/components/vendor/vendor-auth-form";
import { getSession, listDemoUsers } from "@/server/auth/session";
import { getQuickUnlockDeviceState } from "@/server/auth/quick-unlock-cookies";
import { getRestaurantById } from "@/server/services/catalog";
import { serverEnv } from "@/lib/env";
import { landingForRole, resolveLandingPath } from "@/lib/routes";
import { ROLE } from "@/lib/constants";
import { isVendorRole } from "@/lib/quick-unlock";

export const metadata: Metadata = { title: "Restaurant Partner Login · TREFOOD" };
export const dynamic = "force-dynamic";

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const session = await getSession();

  // If already signed in as vendor and no role complaint: go straight to console
  if (
    session &&
    (session.role === ROLE.VENDOR_OWNER || session.role === ROLE.VENDOR_STAFF) &&
    !reason
  ) {
    redirect(resolveLandingPath(next, session.role));
  }

  const quickUnlockDevice = await getQuickUnlockDeviceState();
  const isStub = serverEnv().AUTH_PROVIDER === "stub";

  const accounts: SignInAccount[] = [];
  if (isStub) {
    for (const user of await listDemoUsers()) {
      if (!isVendorRole(user.role)) continue;
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
    <main className="min-h-dvh bg-ink flex flex-col justify-center items-center">
      <VendorAuthForm
        redirectTo={next ?? null}
        quickUnlockDevice={quickUnlockDevice}
        reason={reason}
      >
        {isStub && accounts.length > 0 ? (
          <div className="w-full mt-6">
            <details className="group rounded-2xl border border-line bg-surface/70 backdrop-blur-md p-4 text-xs">
              <summary className="cursor-pointer font-semibold text-muted hover:text-bone transition-colors flex items-center justify-between select-none">
                <span>Restaurant Demo Accounts (Test Mode)</span>
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
      </VendorAuthForm>
    </main>
  );
}

