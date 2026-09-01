"use client";

import { ChefHat, GraduationCap, Loader2, ShieldAlert, Wrench } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { signInAsDemoUser } from "@/server/actions/session";
import { ROLE, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface SignInAccount {
  userId: string;
  name: string;
  email: string;
  role: Role;
  restaurantName: string | null;
  codBlocked: boolean;
  strikes: number;
  /** Where this account lands after signing in. */
  lands: string;
}

/**
 * Demo and staff account picker for local testing and vendor/admin consoles.
 */
export function SignInPicker({
  accounts,
  redirectTo,
}: {
  accounts: SignInAccount[];
  redirectTo: string | null;
}) {
  const [pending, setPending] = useState<string | null>(null);

  const choose = async (account: SignInAccount): Promise<void> => {
    setPending(account.userId);
    const result = await signInAsDemoUser({
      userId: account.userId,
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (result.status === "error") setPending(null);
  };

  const groups: { heading: string; blurb: string; roles: Role[]; icon: typeof GraduationCap }[] = [
    {
      heading: "Restaurants",
      blurb: "The live board, the menu, and the earnings statement.",
      roles: [ROLE.VENDOR_OWNER, ROLE.VENDOR_STAFF],
      icon: ChefHat,
    },
    {
      heading: "TREFOOD ops",
      blurb: "Radar, disputes, settlements and campus data.",
      roles: [ROLE.ADMIN, ROLE.SUPER_ADMIN],
      icon: Wrench,
    },
  ];

  const vendorOrAdminAccounts = accounts.filter(
    (a) => a.role !== ROLE.STUDENT,
  );

  if (vendorOrAdminAccounts.length === 0) return null;

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-line bg-surface px-3.5 py-3 text-xs leading-relaxed text-muted">
        <p className="font-semibold text-bone mb-0.5">Staff & Partner Accounts</p>
        Use these seeded accounts to test the Restaurant Order Board and the Admin Radar.
      </div>

      {groups.map((group) => {
        const members = accounts.filter((account) => group.roles.includes(account.role));
        if (members.length === 0) return null;

        return (
          <section key={group.heading}>
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
              <group.icon className="size-3.5" />
              {group.heading}
            </h2>
            <p className="mt-1 text-xs text-muted">{group.blurb}</p>

            <div className="mt-2.5 space-y-2">
              {members.map((account) => (
                <button
                  key={account.userId}
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void choose(account)}
                  className="block w-full text-left disabled:opacity-60"
                >
                  <Card
                    className={cn(
                      "flex min-h-16 items-center gap-3 p-3.5 transition-colors",
                      pending === account.userId
                        ? "border-saffron/60"
                        : "hover:border-saffron/40",
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised font-display text-sm font-semibold text-bone">
                      {account.name.charAt(0)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-bone">
                        {account.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {account.restaurantName ?? account.email}
                      </span>
                    </span>

                    {pending === account.userId ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-saffron" />
                    ) : account.codBlocked ? (
                      <Badge tone="danger" className="shrink-0">
                        <ShieldAlert className="size-3" />
                        COD blocked
                      </Badge>
                    ) : null}
                  </Card>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
