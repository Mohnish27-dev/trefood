import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/server/auth/session";
import { getCampusById, getRestaurantById } from "@/server/services/catalog";
import { listAdminCouponsForRestaurant } from "@/server/services/coupons";
import { RestaurantCouponsManager } from "@/components/admin/restaurant-coupons-manager";

export const metadata: Metadata = { title: "Restaurant Coupons" };
export const dynamic = "force-dynamic";

export default async function RestaurantCouponsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  await requireAdmin();
  const { restaurantId } = await params;

  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) notFound();

  const campus = await getCampusById(restaurant.campusId);
  const coupons = await listAdminCouponsForRestaurant(restaurantId);

  return (
    <RestaurantCouponsManager
      restaurant={restaurant}
      campusName={campus?.name ?? "Campus"}
      coupons={coupons}
    />
  );
}
