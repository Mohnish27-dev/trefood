import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/server/auth/session";
import { getCampusById } from "@/server/services/catalog";
import { getVendorMenuForAdmin } from "@/server/services/admin-menu";
import { RestaurantMenuManager } from "@/components/admin/restaurant-menu-manager";

export const metadata: Metadata = { title: "Restaurant Menu" };
export const dynamic = "force-dynamic";

export default async function RestaurantMenuPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  await requireAdmin();
  const { restaurantId } = await params;

  const { restaurant, sections } = await getVendorMenuForAdmin(restaurantId);
  if (!restaurant) notFound();

  const campus = await getCampusById(restaurant.campusId);

  return (
    <RestaurantMenuManager
      restaurant={restaurant}
      campusName={campus?.name ?? "Campus"}
      sections={sections}
    />
  );
}
