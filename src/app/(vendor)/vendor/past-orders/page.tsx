import type { Metadata } from "next";
import { requireVendor } from "@/server/auth/session";
import { getCampusById, getRestaurantById } from "@/server/services/catalog";
import { getVendorOrderHistory } from "@/server/services/vendor-history";
import { VendorHistoryView } from "@/components/vendor/history-view";

export const metadata: Metadata = { title: "Past orders" };
export const dynamic = "force-dynamic";

export default async function VendorHistoryPage({ searchParams }: PageProps<"/vendor/past-orders">) {
  const { restaurantId } = await requireVendor();
  const search = await searchParams;
  const history = await getVendorOrderHistory({
    restaurantId,
    filter: typeof search.filter === "string" ? search.filter : "all",
    page: typeof search.page === "string" ? Number(search.page) : 1,
  });
  const restaurant = await getRestaurantById(restaurantId);
  const campus = restaurant ? await getCampusById(restaurant.campusId) : null;
  return <VendorHistoryView history={history} timezone={campus?.timezone ?? "Asia/Kolkata"} />;
}
