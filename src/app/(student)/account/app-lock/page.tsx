import { ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { AccountQuickUnlock } from "@/components/student/account-quick-unlock";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "App lock" };
export const dynamic = "force-dynamic";

/**
 * App lock — the 4-digit PIN and device biometrics.
 *
 * On its own screen rather than in a card on the hub, because setting a PIN is
 * a several-tap flow with a modal in the middle, and the account screen should
 * not grow a second interactive surface that tall.
 */
export default async function AppLockPage() {
  const session = await getSession();

  if (!session) {
    return (
      <>
        <SubPageHeader title="App lock" />
        <EmptyState
          icon={UserRound}
          title="Sign in first"
          description="A PIN unlocks an account, so there has to be an account signed in before one can be set."
          action={
            <Button asChild>
              <Link href="/signin?next=/account/app-lock">Sign in</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <SubPageHeader title="App lock" />

      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3 px-1">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-saffron" />
          <p className="text-sm leading-relaxed text-muted">
            A 4-digit PIN or your fingerprint gets you back into TREFOOD on this phone
            without typing a password. It protects this device only — your account is still
            reached with your email and password anywhere else.
          </p>
        </div>

        <AccountQuickUnlock user={session.user} />
      </div>
    </>
  );
}
