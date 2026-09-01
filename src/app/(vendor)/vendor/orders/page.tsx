import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OrderBoard } from "@/components/vendor/order-board";
import { requireVendor } from "@/server/auth/session";
import { getVendorBoard } from "@/server/services/vendor";

export const metadata: Metadata = { title: "Live board" };
export const dynamic = "force-dynamic";

/**
 * The live order board.
 *
 * Server-rendered first, then polled. The first paint matters more here than
 * almost anywhere else in the product: a tablet coming back from sleep at
 * 22:40 must show the current orders immediately, not a skeleton while
 * hydration finishes on a bad connection.
 */
export default async function VendorOrdersPage() {
  const { restaurantId } = await requireVendor();

  const board = await getVendorBoard({ restaurantId });
  if (!board) redirect("/signin?next=/vendor/orders&reason=vendor");

  return <OrderBoard initial={board} />;
}
