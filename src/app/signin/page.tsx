import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/shared/logo";
import { SignInPicker, type SignInAccount } from "@/components/student/sign-in-picker";
import { StudentAuthForm } from "@/components/student/student-auth-form";
import { getSession, listDemoUsers } from "@/server/auth/session";
import { getRestaurantById } from "@/server/services/catalog";
import { serverEnv } from "@/lib/env";
import { ROLE } from "@/lib/constants";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  vendor: "That account is not linked to a restaurant. Pick a vendor account below.",
  admin: "That page needs an admin account.",
  auth_failed: "Authentication could not be completed. Please try signing in again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; tab?: string }>;
}) {
  const { next, reason, tab } = await searchParams;
  const session = await getSession();

  // Already signed in and no role complaint? Redirect immediately.
  if (session && !reason) redirect(next && next.startsWith("/") ? next : "/");

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
      lands:
        user.role === ROLE.VENDOR_OWNER || user.role === ROLE.VENDOR_STAFF
          ? "/vendor/orders"
          : user.role === ROLE.ADMIN || user.role === ROLE.SUPER_ADMIN
            ? "/admin/orders"
            : "/",
    });
  }

  const initialType = reason === "vendor" || tab === "vendor" ? "vendor" : "student";

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
        <div className="mb-4">
          <BrandLogo size="lg" href="/" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-bone">
          Sign in to your account
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Choose Customer to order food or Vendor to manage your restaurant orders.
        </p>
      </div>

      {reason && REASONS[reason] ? (
        <p className="mt-4 rounded-xl border border-amber/30 bg-amber-wash px-3.5 py-3 text-sm text-amber">
          {REASONS[reason]}
        </p>
      ) : null}

      {/* ── Customer & Vendor Authentication (Google OAuth + Email/Password) ─────────── */}
      <StudentAuthForm redirectTo={next ?? null} initialType={initialType} />

      {/* ── Demo accounts (Stub mode only) ─────────────────────────── */}
      {isStub ? (
        <SignInPicker accounts={accounts} redirectTo={next ?? null} />
      ) : null}
    </main>
  );
}
