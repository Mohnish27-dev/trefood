import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInPicker, type SignInAccount } from "@/components/student/sign-in-picker";
import { getSession, listDemoUsers } from "@/server/auth/session";
import { getRestaurantById } from "@/server/services/catalog";
import { serverEnv } from "@/lib/env";
import { ROLE } from "@/lib/constants";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  vendor: "That account is not linked to a restaurant. Pick a vendor account below.",
  admin: "That page needs an admin account.",
};

/**
 * Sign in.
 *
 * D7 — Google sign-in now, phone captured at first checkout, phone OTP later
 * once TRAI DLT clears. All three sit behind `server/auth/session.ts`, so this
 * page renders whatever the active provider offers and nothing above it knows
 * which one is live.
 *
 * With `AUTH_PROVIDER=stub` that is the seeded account list, which is a
 * deliberate prototype affordance rather than a shortcut: the whole point of a
 * demo is switching between a normal student, a COD-blocked one, a vendor and
 * an admin in a single tap, and the stub provider refuses to run in production
 * at all.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const session = await getSession();

  // Already signed in and no role complaint? There is nothing to do here.
  if (session && !reason) redirect(next && next.startsWith("/") ? next : "/");

  const isStub = serverEnv().AUTH_PROVIDER === "stub";
  const users = isStub ? await listDemoUsers() : [];

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
      lands:
        user.role === ROLE.VENDOR_OWNER || user.role === ROLE.VENDOR_STAFF
          ? "/vendor/orders"
          : user.role === ROLE.ADMIN || user.role === ROLE.SUPER_ADMIN
            ? "/admin/orders"
            : "/",
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-10">
      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-bone"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="mt-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-bone">
          Sign in to TREFOOD
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You can browse every menu without an account. Signing in is only needed to place an
          order and to see it through to the gate.
        </p>
      </div>

      {reason && REASONS[reason] ? (
        <p className="mt-4 rounded-xl border border-amber/30 bg-amber-wash px-3.5 py-3 text-sm text-amber">
          {REASONS[reason]}
        </p>
      ) : null}

      {isStub ? (
        <SignInPicker accounts={accounts} redirectTo={next ?? null} />
      ) : (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <ShieldCheck className="size-5 text-saffron" />
          <p className="mt-3 font-display text-sm font-semibold text-bone">
            Google sign-in is not wired yet
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Set <code className="font-mono text-xs text-bone">AUTH_PROVIDER=stub</code> to use
            the seeded demo accounts, or finish the Supabase setup to enable Google.
          </p>
        </div>
      )}
    </main>
  );
}
