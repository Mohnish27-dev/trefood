import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OrderBoard } from "@/components/vendor/order-board";
import { requireVendor } from "@/server/auth/session";
import { getVendorBoard } from "@/server/services/vendor";

export const metadata: Metadata = { title: "On the way" };
export const dynamic = "force-dynamic";

/** Orders out for delivery or waiting at the gate. */
export default async function VendorOnTheWayPage() {
  const { restaurantId } = await requireVendor();

  const board = await getVendorBoard({ restaurantId });
  if (!board) redirect("/signin?next=/vendor/on-the-way&reason=vendor");

  return <OrderBoard initial={board} stage="on_the_way" />;
}
