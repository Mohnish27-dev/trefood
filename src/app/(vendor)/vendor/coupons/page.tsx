import type { Metadata } from "next";

import { CouponsView } from "@/components/vendor/coupons-view";
import { requireVendor } from "@/server/auth/session";
import { listAdminCouponsForRestaurant } from "@/server/services/coupons";

export const metadata: Metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

/**
 * Coupons an admin created for this restaurant.
 *
 * Admins create and delete them; the vendor can only switch one on or off,
 * because it is the kitchen that has to honour the discount.
 */
export default async function VendorCouponsPage() {
  const { restaurantId } = await requireVendor();
  const coupons = await listAdminCouponsForRestaurant(restaurantId);

  return <CouponsView coupons={coupons} />;
}
