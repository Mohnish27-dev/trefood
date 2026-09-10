import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorAppLock } from "@/components/vendor/vendor-app-lock";
import { VendorSettingsForm, type SettingsZone } from "@/components/vendor/settings-form";
import { requireVendor } from "@/server/auth/session";
import { getCampusById, getRestaurantById } from "@/server/services/catalog";
import { formatMinutes } from "@/server/services/curfew";
import { bpsToPct } from "@/lib/money";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function VendorSettingsPage() {
  const { restaurantId, user } = await requireVendor();

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
    <div className="max-w-3xl space-y-5">
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

      {/*
        Sign-in, not shop settings, so it sits below the form rather than
        inside it: nothing here is visible to a student, and saving the form
        must not be entangled with changing a credential.
      */}
      <VendorAppLock
        user={{
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          quickUnlock: user.quickUnlock ?? null,
        }}
      />
    </div>
  );
}
