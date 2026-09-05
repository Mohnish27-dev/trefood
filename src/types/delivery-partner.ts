export type DeliveryPartnerStatus = "ACTIVE" | "INACTIVE" | "REVOKED";

export interface DeliveryPartner {
  _id: string;
  /** Human-readable unique badge identifier printed on ID card, e.g. "TF-NITP-001" */
  badgeId: string;
  name: string;
  phone: string;
  /** Supabase Storage URL or avatar image */
  photoUrl: string | null;

  restaurantId: string;
  restaurantName: string;

  campusId: string;
  campusName: string;

  /** Bike / scooter / cycle number or vehicle type */
  vehicleNumber?: string | null;

  status: DeliveryPartnerStatus;

  /** Which gates this delivery partner is authorized to enter (e.g. ["Main Gate", "Hostel Gate"]) */
  allowedGates: string[];

  emergencyContact?: string | null;

  issuedAt: Date;
  expiresAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}
