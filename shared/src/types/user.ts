import type { UserRole } from "../constants.js";
import type { Id, IsoDateTime } from "./common.js";

/**
 * A profile mirror of the Supabase identity.
 *
 * Auth lives in Supabase; this document holds what TREFOOD needs to reason about a
 * person — their role, their campus, and their standing.
 */
export interface IUser {
  _id: Id;
  /** The Supabase auth user id. Unique. */
  authId: string;

  name: string;
  email: string;

  /**
   * Collected at first checkout, not at sign-up (D7). The vendor phones this number
   * when a student does not appear at the gate, so it is operationally load-bearing.
   */
  phone?: string;

  role: UserRole;
  campusId?: Id;

  /** Vendor staff and owners only. Scopes every vendor route. */
  restaurantId?: Id;

  /**
   * F8/F9 — set after two no-shows, or immediately on a refused COD payment.
   *
   * When true, COD is hidden ENTIRELY at checkout rather than shown and rejected. The
   * account is never banned: a student who must prepay is a better customer than a
   * lost one, and prepaid orders carry zero collection risk.
   */
  codBlocked: boolean;
  /** F8 — two strikes flips codBlocked. */
  noShowStrikes: number;

  createdAt: IsoDateTime;
}
