import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OrderBoard } from "@/components/vendor/order-board";
import { requireVendor } from "@/server/auth/session";
import { getVendorBoard } from "@/server/services/vendor";

export const metadata: Metadata = { title: "Preparing" };
export const dynamic = "force-dynamic";

/** Accepted orders in the kitchen, waiting to be marked on the way. */
export default async function VendorPreparingPage() {
  const { restaurantId } = await requireVendor();

  const board = await getVendorBoard({ restaurantId });
  if (!board) redirect("/signin?next=/vendor/preparing&reason=vendor");

  return <OrderBoard initial={board} stage="preparing" />;
}
