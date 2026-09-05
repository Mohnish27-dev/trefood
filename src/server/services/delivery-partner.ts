import "server-only";

import * as db from "@/server/db/collections";
import { newId } from "@/lib/ids";
import type { DeliveryPartner, DeliveryPartnerStatus } from "@/types/delivery-partner";

export interface DeliveryPartnerVerificationResult {
  partner: DeliveryPartner;
  restaurant: {
    name: string;
    phone: string;
    isApproved: boolean;
    fssai: string | null;
  } | null;
  campus: {
    name: string;
  } | null;
  isAuthorized: boolean;
}

/**
 * Fetch delivery partner by Badge ID (e.g. "TF-NITP-001") or fallback by _id.
 * Used by the public campus gate verification page.
 */
export async function getDeliveryPartnerForVerification(
  identifier: string
): Promise<DeliveryPartnerVerificationResult | null> {
  const col = await db.deliveryPartners();
  // Match either human badgeId or internal _id
  const partner = await col.findOne({
    $or: [{ badgeId: identifier }, { _id: identifier }],
  });

  if (!partner) {
    // Fallback: Check if identifier corresponds to a Vendor / Restaurant directly (e.g. TF-VND-CSB, csb, rest_csb)
    const [restaurantsCol, campusesCol] = await Promise.all([
      db.restaurants(),
      db.campuses(),
    ]);

    const cleanSlug = identifier.replace(/^TF-VND-/i, "").toLowerCase();
    const restaurant = await restaurantsCol.findOne({
      $or: [
        { _id: identifier },
        { slug: identifier },
        { slug: cleanSlug },
        { _id: `rest_${cleanSlug}_nitp` },
      ],
    });

    if (!restaurant) return null;

    const campus = await campusesCol.findOne({ _id: restaurant.campusId });
    const isAuthorized = restaurant.isApproved;

    const vendorPartner: DeliveryPartner = {
      _id: `vnd_${restaurant._id}`,
      badgeId: `TF-VND-${restaurant.slug.toUpperCase()}`,
      name: "Authorized Delivery Staff",
      phone: restaurant.phone,
      photoUrl: restaurant.imageUrl || null,
      restaurantId: restaurant._id,
      restaurantName: restaurant.name,
      campusId: restaurant.campusId,
      campusName: campus?.name || "Campus",
      vehicleNumber: "Canteen Delivery Fleet",
      status: isAuthorized ? "ACTIVE" : "INACTIVE",
      allowedGates: ["All Campus Gates", "Hostel Delivery Points"],
      emergencyContact: restaurant.kyc?.ownerPhone ?? null,
      issuedAt: restaurant.createdAt,
      expiresAt: null,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
    };

    return {
      partner: vendorPartner,
      restaurant: {
        name: restaurant.name,
        phone: restaurant.phone,
        isApproved: restaurant.isApproved,
        fssai: restaurant.kyc?.fssai ?? null,
      },
      campus: campus ? { name: campus.name } : null,
      isAuthorized,
    };
  }

  const [restaurantsCol, campusesCol] = await Promise.all([
    db.restaurants(),
    db.campuses(),
  ]);

  const [restaurant, campus] = await Promise.all([
    restaurantsCol.findOne({ _id: partner.restaurantId }),
    campusesCol.findOne({ _id: partner.campusId }),
  ]);

  const now = new Date();
  const isExpired = partner.expiresAt ? new Date(partner.expiresAt) < now : false;
  const isAuthorized = partner.status === "ACTIVE" && !isExpired;

  return {
    partner,
    restaurant: restaurant
      ? {
          name: restaurant.name,
          phone: restaurant.phone,
          isApproved: restaurant.isApproved,
          fssai: restaurant.kyc?.fssai ?? null,
        }
      : null,
    campus: campus
      ? {
          name: campus.name,
        }
      : null,
    isAuthorized,
  };
}

export async function listDeliveryPartnersByRestaurant(
  restaurantId: string
): Promise<DeliveryPartner[]> {
  const col = await db.deliveryPartners();
  return col.find({ restaurantId }).sort({ createdAt: -1 }).toArray();
}

export async function listDeliveryPartnersByCampus(
  campusId: string
): Promise<DeliveryPartner[]> {
  const col = await db.deliveryPartners();
  return col.find({ campusId }).sort({ createdAt: -1 }).toArray();
}

export async function createDeliveryPartner(data: {
  badgeId: string;
  name: string;
  phone: string;
  photoUrl?: string | null;
  restaurantId: string;
  restaurantName: string;
  campusId: string;
  campusName: string;
  vehicleNumber?: string | null;
  allowedGates?: string[];
  emergencyContact?: string | null;
  expiresAt?: Date | null;
}): Promise<DeliveryPartner> {
  const col = await db.deliveryPartners();
  const now = new Date();

  const partner: DeliveryPartner = {
    _id: newId("del"),
    badgeId: data.badgeId.trim().toUpperCase(),
    name: data.name.trim(),
    phone: data.phone.trim(),
    photoUrl: data.photoUrl ?? null,
    restaurantId: data.restaurantId,
    restaurantName: data.restaurantName,
    campusId: data.campusId,
    campusName: data.campusName,
    vehicleNumber: data.vehicleNumber?.trim() ?? null,
    status: "ACTIVE",
    allowedGates: data.allowedGates && data.allowedGates.length > 0 ? data.allowedGates : ["All Campus Gates"],
    emergencyContact: data.emergencyContact?.trim() ?? null,
    issuedAt: now,
    expiresAt: data.expiresAt ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(partner);
  return partner;
}

export async function updateDeliveryPartnerStatus(
  id: string,
  status: DeliveryPartnerStatus
): Promise<boolean> {
  const col = await db.deliveryPartners();
  const res = await col.updateOne(
    { _id: id },
    { $set: { status, updatedAt: new Date() } }
  );
  return res.matchedCount > 0;
}
