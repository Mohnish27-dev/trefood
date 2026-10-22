import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { IssueDeskDashboard } from "@/components/admin/issue-desk";
import { getSession } from "@/server/auth/session";
import { listAllCampuses } from "@/server/services/admin";
import { getIssueDeskSnapshot } from "@/server/services/issues";
import { ROLE, isFullAdmin } from "@/lib/constants";
import { ADMIN_HOME } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Issue Desk",
};

export const dynamic = "force-dynamic";

export default async function IssueDeskPage() {
  const session = await getSession();

  if (!session) {
    redirect("/signin?next=/admin/issues");
  }

  // The Issue Desk carries customer phones and order values; co-admins go
  // back to the radar.
  if (session.role === ROLE.CO_ADMIN) redirect(ADMIN_HOME);

  if (!isFullAdmin(session.role)) {
    redirect("/signin?next=/admin/issues&reason=admin");
  }

  const [campuses, snapshot] = await Promise.all([
    listAllCampuses(),
    getIssueDeskSnapshot({}),
  ]);

  return <IssueDeskDashboard initialSnapshot={snapshot} campuses={campuses} />;
}
