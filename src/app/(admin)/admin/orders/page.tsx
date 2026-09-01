import type { Metadata } from "next";

import { LiveRadar } from "@/components/admin/radar";
import { requireAdmin } from "@/server/auth/session";
import { getRadar } from "@/server/services/admin";

export const metadata: Metadata = { title: "Live radar" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();
  const snapshot = await getRadar({});
  return <LiveRadar initial={snapshot} />;
}
