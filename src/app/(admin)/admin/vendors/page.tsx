import type { Metadata } from "next";

import { AdminVendorTable, type AdminVendorRow } from "@/components/admin/vendor-table";
import { requireAdmin } from "@/server/auth/session";
import { listAllCampuses, listVendors } from "@/server/services/admin";

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

export default async function AdminVendorsPage() {
  await requireAdmin();

  const [vendors, campuses] = await Promise.all([listVendors({}), listAllCampuses()]);
  const campusById = new Map(campuses.map((campus) => [campus._id, campus]));

  const rows: AdminVendorRow[] = vendors.map((vendor) => {
    const campus = campusById.get(vendor.campusId);
    return {
      restaurantId: vendor._id,
      name: vendor.name,
      campusName: campus?.name ?? "Unknown campus",
      ownerName: vendor.kyc.ownerName,
      ownerPhone: vendor.kyc.ownerPhone,
      gstin: vendor.kyc.gstin,
      fssai: vendor.kyc.fssai,
      kycStatus: vendor.kyc.status,
      rejectionReason: vendor.kyc.rejectionReason,
      isOpen: vendor.isOpen,
      zoneCount: vendor.servedZoneIds.length,
      minOrderPaise: vendor.minOrderPaise,
      packagingFeePaise: vendor.packagingFeePaise,
      commissionBpsOverride: vendor.commissionBpsOverride,
      campusCommissionBps: campus?.settings.commissionBps ?? 1_000,
      payout: vendor.payout,
    };
  });

  const campusOptions = campuses.map((campus) => ({
    id: campus._id,
    name: campus.name,
    city: campus.city,
  }));

  return <AdminVendorTable vendors={rows} campuses={campusOptions} />;
}
