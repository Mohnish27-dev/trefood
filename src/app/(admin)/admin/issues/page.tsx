import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { IssueDeskDashboard } from "@/components/admin/issue-desk";
import { getSession } from "@/server/auth/session";
import { listAllCampuses } from "@/server/services/admin";
import { getIssueDeskSnapshot } from "@/server/services/issues";
import { ROLE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Issue Desk",
};

export const dynamic = "force-dynamic";

export default async function IssueDeskPage() {
  const session = await getSession();

  if (!session) {
    redirect("/signin?next=/admin/issues");
  }

  if (session.role !== ROLE.ADMIN && session.role !== ROLE.SUPER_ADMIN) {
    redirect("/signin?next=/admin/issues&reason=admin");
  }

  const [campuses, snapshot] = await Promise.all([
    listAllCampuses(),
    getIssueDeskSnapshot({}),
  ]);

  return <IssueDeskDashboard initialSnapshot={snapshot} campuses={campuses} />;
}
