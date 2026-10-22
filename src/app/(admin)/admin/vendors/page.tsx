import type { Metadata } from "next";

import { AdminVendorTable, type AdminVendorRow } from "@/components/admin/vendor-table";
import { isFullAdmin } from "@/lib/constants";
import { restaurantPhones } from "@/lib/restaurant-phones";
import { requireStaff } from "@/server/auth/session";
import { listAllCampuses, listVendors } from "@/server/services/admin";

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

/** What a co-admin's rows carry instead of KYC, commission and bank details. */
const REDACTED = {
  ownerPhone: "",
  gstin: null,
  fssai: null,
  commissionBpsOverride: null,
  campusCommissionBps: 0,
  platformFeePaise: 0,
  payout: { accountName: "", accountNumber: "", ifsc: "", upiId: null },
} satisfies Partial<AdminVendorRow>;

export default async function AdminVendorsPage() {
  const session = await requireStaff();
  const canManage = isFullAdmin(session.role);

  const [vendors, campuses] = await Promise.all([listVendors({}), listAllCampuses()]);
  const campusById = new Map(campuses.map((campus) => [campus._id, campus]));

  const rows: AdminVendorRow[] = vendors.map((vendor) => {
    const campus = campusById.get(vendor.campusId);
    const row: AdminVendorRow = {
      restaurantId: vendor._id,
      name: vendor.name,
      slug: vendor.slug,
      isApproved: vendor.isApproved,
      displayOrder: vendor.displayOrder ?? null,
      campusName: campus?.name ?? "Unknown campus",
      ownerName: vendor.kyc.ownerName,
      ownerPhone: vendor.kyc.ownerPhone,
      phones: restaurantPhones(vendor),
      gstin: vendor.kyc.gstin,
      fssai: vendor.kyc.fssai,
      kycStatus: vendor.kyc.status,
      rejectionReason: vendor.kyc.rejectionReason,
      isOpen: vendor.isOpen,
      adminClosed: Boolean(vendor.adminClosed),
      isDineInAvailable: Boolean(vendor.isDineInAvailable),
      zoneCount: vendor.servedZoneIds.length,
      minOrderPaise: vendor.minOrderPaise,
      packagingFeePaise: vendor.packagingFeePaise,
      commissionBpsOverride: vendor.commissionBpsOverride,
      platformFeePaise: vendor.platformFeePaise ?? 0,
      campusCommissionBps: campus?.settings.commissionBps ?? 1_000,
      payout: vendor.payout,
    };
    // Stripped here, on the server, so none of it reaches a co-admin's
    // browser. Hiding it in the table alone would still ship it in the payload.
    return canManage ? row : { ...row, ...REDACTED };
  });

  const campusOptions = campuses.map((campus) => ({
    id: campus._id,
    name: campus.name,
    city: campus.city,
  }));

  return <AdminVendorTable vendors={rows} campuses={campusOptions} canManage={canManage} />;
}
