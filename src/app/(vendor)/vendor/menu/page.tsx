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
    items: section.items.map((item) => ({
      itemId: item._id,
      name: item.name,
      description: item.description,
      isVeg: item.isVeg,
      pricePaise: item.pricePaise,
      isAvailable: item.isAvailable,
      addOnGroupCount: item.addOnGroups.length,
    })),
  }));

  return <MenuManager sections={view} />;
}
