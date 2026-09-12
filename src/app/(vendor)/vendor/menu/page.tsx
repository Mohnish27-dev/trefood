import type { Metadata } from "next";

import { MenuManager, type MenuManagerSection } from "@/components/vendor/menu-manager";
import { requireVendor } from "@/server/auth/session";
import { getVendorMenu } from "@/server/services/vendor";

export const metadata: Metadata = { title: "Menu" };
export const dynamic = "force-dynamic";

/**
 * Menu and the 86 toggles.
 *
 * Read through `getVendorMenu` rather than the student-facing `getMenu`,
 * because a vendor needs to see empty categories and unavailable items — the
 * two things a student has no use for.
 */
export default async function VendorMenuPage() {
  const { restaurantId } = await requireVendor();
  const sections = await getVendorMenu(restaurantId);

  const view: MenuManagerSection[] = sections.map((section) => ({
    categoryId: section.category._id,
    categoryName: section.category.name,
    category: section.category,
    items: section.items.map((item) => ({
      itemId: item._id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      isVeg: item.isVeg,
      pricePaise: item.pricePaise,
      isAvailable: item.isAvailable,
      isPopular: item.isPopular ?? false,
      packingFeeEnabled: item.packingFeeEnabled ?? false,
      packingFeePaise: item.packingFeePaise ?? 0,
      addOnGroups: item.addOnGroups ?? [],
      addOnGroupCount: item.addOnGroups?.length ?? 0,
    })),
  }));

  return <MenuManager sections={view} />;
}
