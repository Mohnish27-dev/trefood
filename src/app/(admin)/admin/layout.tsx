import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { getSession } from "@/server/auth/session";
import { ROLE } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: "Admin console", template: "%s · TREFOOD admin" },
};

export const dynamic = "force-dynamic";

/**
 * A redirect for humans who took a wrong turn — not authorisation. Every
 * action and every service call underneath re-checks the role for itself,
 * because a Server Action is reachable by direct POST (PRD Part 4.9).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/signin?next=/admin/orders");
  if (session.role !== ROLE.ADMIN && session.role !== ROLE.SUPER_ADMIN) {
    redirect("/signin?next=/admin/orders&reason=admin");
  }

  return <AdminShell adminName={session.user.name}>{children}</AdminShell>;
}
