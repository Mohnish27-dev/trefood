import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CouponsView } from "@/components/vendor/coupons-view";
import { requireVendor } from "@/server/auth/session";
import { getMenu, getRestaurantById } from "@/server/services/catalog";
import { listAdminCouponsForRestaurant } from "@/server/services/coupons";

export const metadata: Metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

export default async function VendorCouponsPage() {
  const { restaurantId } = await requireVendor();
  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) notFound();

  const [coupons, menu] = await Promise.all([
    listAdminCouponsForRestaurant(restaurantId),
    getMenu(restaurantId),
  ]);

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
    <CouponsView
      coupons={coupons}
      restaurant={restaurant}
      menuSections={menuSections}
    />
  );
}
