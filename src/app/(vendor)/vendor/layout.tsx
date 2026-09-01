import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { VendorShell } from "@/components/vendor/vendor-shell";
import { getSession } from "@/server/auth/session";
import { getRestaurantById } from "@/server/services/catalog";
import { ROLE } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: "Vendor console", template: "%s · TREFOOD vendor" },
};

export const dynamic = "force-dynamic";

/**
 * The vendor console shell.
 *
 * Tablet-first: this runs all evening on a device propped against a wall
 * behind a counter, so targets are large and the layout does not reflow when
 * an order arrives.
 *
 * The role gate here is a redirect for humans, not authorisation. Every action
 * underneath calls `requireVendor()` for itself, because a Server Action is
 * reachable by direct POST and a layout check would not stop one.
 */
export default async function VendorLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/signin?next=/vendor/orders");
  if (session.role !== ROLE.VENDOR_OWNER && session.role !== ROLE.VENDOR_STAFF) {
    redirect("/signin?next=/vendor/orders&reason=vendor");
  }

  const restaurant = session.user.restaurantId
    ? await getRestaurantById(session.user.restaurantId)
    : null;

  if (!restaurant) redirect("/signin?next=/vendor/orders&reason=vendor");

  return (
    <VendorShell
      restaurantName={restaurant.name}
      staffName={session.user.name}
      isOpen={restaurant.isOpen}
      autoClosed={restaurant.autoClosedAt !== null}
    >
      {children}
    </VendorShell>
  );
}
