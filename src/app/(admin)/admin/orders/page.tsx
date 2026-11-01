import type { Metadata } from "next";

import { LiveRadar } from "@/components/admin/radar";
import { isFullAdmin } from "@/lib/constants";
import { requireStaff } from "@/server/auth/session";
import { getRadar, withoutStudents } from "@/server/services/admin";

export const metadata: Metadata = { title: "Live radar" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const session = await requireStaff();
  const fullAdmin = isFullAdmin(session.role);
  const snapshot = await getRadar({});
  return (
    <LiveRadar
      initial={fullAdmin ? snapshot : withoutStudents(snapshot)}
      canIntervene={fullAdmin}
    />
  );
}
