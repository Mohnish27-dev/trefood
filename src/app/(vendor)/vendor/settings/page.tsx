import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorSettingsForm, type SettingsZone } from "@/components/vendor/settings-form";
import { requireVendor } from "@/server/auth/session";
import { getCampusById, getRestaurantById } from "@/server/services/catalog";
import { formatMinutes } from "@/server/services/curfew";
import { bpsToPct } from "@/lib/money";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function VendorSettingsPage() {
  const { restaurantId } = await requireVendor();

  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) notFound();

  const campus = await getCampusById(restaurant.campusId);
  if (!campus) notFound();

  const zones: SettingsZone[] = campus.zones
    .filter((zone) => zone.isActive)
    .map((zone) => ({
      id: zone.id,
      name: zone.name,
      curfewLabel: zone.curfewMinutes === null ? null : formatMinutes(zone.curfewMinutes),
    }));

  const commissionBps = restaurant.commissionBpsOverride ?? campus.settings.commissionBps;

  return (
    <VendorSettingsForm
      deliveryFeePaise={campus.settings.deliveryFeePaise}
      commissionPct={String(bpsToPct(commissionBps))}
      zones={zones}
      initial={{
        phone: restaurant.phone,
        prepMinutes: restaurant.prepMinutes,
        opensMinutes: restaurant.opensMinutes,
        closesMinutes: restaurant.closesMinutes,
        packagingFeePaise: restaurant.packagingFeePaise,
        minOrderPaise: restaurant.minOrderPaise,
        servedZoneIds: restaurant.servedZoneIds,
      }}
    />
  );
}
