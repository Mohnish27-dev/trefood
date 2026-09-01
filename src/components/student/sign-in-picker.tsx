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
 * The demo account picker.
 *
 * Grouped by role because that is how a demo is actually run: open the student
 * in one tab and the vendor in another, then watch a tap on one move the
 * other. The COD-blocked student is called out rather than hidden — it is the
 * fastest way to show the F9 screen, which is otherwise reachable only by
 * refusing to pay a rider.
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
    // A successful sign-in redirects from the server, so this promise never
    // resolves on the happy path. Only a failure comes back here.
    const result = await signInAsDemoUser({
      userId: account.userId,
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (result.status === "error") setPending(null);
  };

  const groups: { heading: string; blurb: string; roles: Role[]; icon: typeof GraduationCap }[] = [
    {
      heading: "Students",
      blurb: "Order, track, and confirm at the gate.",
      roles: [ROLE.STUDENT],
      icon: GraduationCap,
    },
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

  return (
    <div className="mt-8 space-y-6">
      <p className="rounded-xl border border-line bg-surface px-3.5 py-3 text-xs leading-relaxed text-muted">
        These are seeded demo accounts, not real authentication — they exist so the whole flow
        can be shown before Google sign-in is wired, and they are refused outright in
        production.
      </p>

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
