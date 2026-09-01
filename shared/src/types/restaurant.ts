import type { Paise } from "../money.js";
import type { Id, IsoDateTime, MinutesFromMidnight } from "./common.js";

export interface IOpeningHours {
  /** 0 = Sunday. */
  dayOfWeek: number;
  opensAt: MinutesFromMidnight;
  closesAt: MinutesFromMidnight;
}

/** Bank details for the nightly CSV payout. Backend-only; never sent to a client. */
export interface IBankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  upiId?: string;
}

export interface IRestaurant {
  _id: Id;
  campusId: Id;
  slug: string;

  name: string;
  cuisine: string[];
  phone: string;
  imageUrl?: string;

  /**
   * Which delivery zones this vendor will serve. The student's zone choice filters
   * the restaurant list against this array — the structural inversion described in
   * docs/SYSTEM_ARCHITECTURE_AND_FLOWS.md §4.
   */
  servedZoneIds: string[];

  /**
   * The release valve. One tap during an exam-week surge, and no new orders arrive —
   * which is what prevents a cascade of F4 expiries. Teach it on day one.
   */
  isOpen: boolean;
  openingHours: IOpeningHours[];

  /** Feeds the ETA: acceptedAt + prepMinutes + campus.transitMinutes. */
  defaultPrepMinutes: number;
  minOrderPaise: Paise;
  packagingFeePaise: Paise;

  /** A2 — 0 is correct only below the ₹20 L registration threshold. */
  foodGstPct: number;
  /** Set by an admin, and never below the campus floor. */
  commissionPctOverride?: number;

  kycStatus: "PENDING" | "APPROVED" | "REJECTED";
  bankDetails?: IBankDetails;

  createdAt: IsoDateTime;
}
