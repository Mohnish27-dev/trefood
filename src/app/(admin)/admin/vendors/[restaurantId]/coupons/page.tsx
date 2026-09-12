import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/server/auth/session";
import { getCampusById, getMenu, getRestaurantById } from "@/server/services/catalog";
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
  const [coupons, menu] = await Promise.all([
    listAdminCouponsForRestaurant(restaurantId),
    getMenu(restaurantId),
  ]);

  // Only what the item picker needs crosses to the client.
  const menuSections = menu.map((section) => ({
    categoryName: section.category.name,
    items: section.items.map((item) => ({
      id: item._id,
      name: item.name,
      isVeg: item.isVeg,
      pricePaise: item.pricePaise,
    })),
  }));

  return (
    <RestaurantCouponsManager
      restaurant={restaurant}
      campusName={campus?.name ?? "Campus"}
      coupons={coupons}
      menuSections={menuSections}
    />
  );
}
