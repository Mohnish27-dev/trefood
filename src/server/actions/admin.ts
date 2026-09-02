"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ACTOR, ORDER_STATUS, ZONE_TYPE } from "@/lib/constants";
import { newId } from "@/lib/ids";
import { requireAdmin } from "@/server/auth/session";
import {
  createVendorDirectly,
  deleteVendor,
  reviewKyc,
  setCommissionOverride,
  setZoneActive,
  updateCampusSettings,
  updateGeofence,
  updatePayoutDetails,
  upsertZone,
} from "@/server/services/admin";
import { getCampusById } from "@/server/services/catalog";
import { getOrder, transitionOrder } from "@/server/services/orders";
import { issueRefund } from "@/server/services/refunds";
import { ruleDispute } from "@/server/services/disputes";
import { markSettlementPaid, runSettlement } from "@/server/services/settlement";
import { clearStrikes, setCodBlocked } from "@/server/services/students";
import { runAllSweeps } from "@/server/services/sweeps";
import { notifyOrderEvent } from "@/server/services/push";
import type { DeliveryZone } from "@/types/campus";

/**
 * Admin Server Actions.
 *
 * `requireAdmin()` is the first line of every one of them. The admin route
 * group is also gated in `proxy.ts`, but that is a redirect for humans, not
 * authorisation: a Server Action is reachable by a direct POST and has to
 * defend itself (PRD Part 4.9).
 */

export type AdminActionState =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/* ══════════════════════════════════════════════════════════════════════
   Campus, zones, pricing
   ══════════════════════════════════════════════════════════════════════ */

const settingsSchema = z.object({
  campusId: z.string().min(1),
  deliveryFeePaise: z.number().int().min(0).max(100_000),
  commissionBps: z.number().int().min(0).max(3_000),
  gatewayFeeBps: z.number().int().min(0).max(1_000),
  codHandlingFeePaise: z.number().int().min(0).max(10_000),
  transitMinutes: z.number().int().min(1).max(60),
  vendorAckSeconds: z.number().int().min(30).max(900),
  vendorAutoExpireSeconds: z.number().int().min(60).max(1_800),
  gateGraceSeconds: z.number().int().min(120).max(3_600),
  curfewBufferMinutes: z.number().int().min(0).max(60),
  stockoutResolutionSeconds: z.number().int().min(60).max(1_800),
  disputeWindowMinutes: z.number().int().min(5).max(240),
  codEnabled: z.boolean(),
});

export async function saveCampusSettings(input: unknown): Promise<AdminActionState> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }

  const { user } = await requireAdmin();
  const { campusId, ...rest } = parsed.data;

  const campus = await getCampusById(campusId);
  if (!campus) return { status: "error", message: "That campus does not exist." };

  // The expire window must outlast the ack window, or the countdown a vendor
  // watches would end after the order was already auto-cancelled.
  if (rest.vendorAutoExpireSeconds <= rest.vendorAckSeconds) {
    return {
      status: "error",
      message: "The auto-expire window must be longer than the acknowledgement window.",
    };
  }

  const updated = await updateCampusSettings({
    campusId,
    // `couponFundedBy` and `roundingMode` are locked decisions (A1, A4), not
    // levers. They are carried forward rather than exposed as fields.
    settings: {
      ...rest,
      couponFundedBy: campus.settings.couponFundedBy,
      roundingMode: campus.settings.roundingMode,
    },
    actorId: user._id,
  });

  if (!updated) return { status: "error", message: "Could not save those settings." };

  revalidatePath("/admin/pricing");
  return { status: "ok", message: `${updated.name} pricing updated` };
}

const zoneSchema = z.object({
  campusId: z.string().min(1),
  zoneId: z.string().optional(),
  name: z.string().trim().min(2).max(60),
  zoneType: z.enum([
    ZONE_TYPE.HOSTEL_BOYS,
    ZONE_TYPE.HOSTEL_GIRLS,
    ZONE_TYPE.ACADEMIC,
    ZONE_TYPE.MAIN_GATE,
    ZONE_TYPE.RESIDENTIAL,
  ]),
  /** Minutes from midnight, campus-local. Null is a 24x7 gate. */
  curfewMinutes: z.number().int().min(0).max(1_439).nullable(),
  opensMinutes: z.number().int().min(0).max(1_439),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  instructions: z.string().trim().min(3).max(200),
  isActive: z.boolean(),
  isFallback: z.boolean(),
});

export async function saveZone(input: unknown): Promise<AdminActionState> {
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid gate." };
  }

  const { user } = await requireAdmin();
  const data = parsed.data;

  // A fallback gate must genuinely be open around the clock — the curfew guard
  // offers it by name to a student whose own gate just shut, and offering
  // another closed gate would be worse than offering nothing.
  if (data.isFallback && data.curfewMinutes !== null) {
    return { status: "error", message: "A fallback gate has to be open 24x7." };
  }

  const zone: DeliveryZone = {
    id: data.zoneId && data.zoneId.length > 0 ? data.zoneId : newId("zone"),
    name: data.name,
    zoneType: data.zoneType,
    curfewMinutes: data.curfewMinutes,
    opensMinutes: data.opensMinutes,
    lat: data.lat,
    lng: data.lng,
    instructions: data.instructions,
    isActive: data.isActive,
    isFallback: data.isFallback,
  };

  const result = await upsertZone({ campusId: data.campusId, zone, actorId: user._id });
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath(`/admin/campuses/${data.campusId}/zones`);
  return { status: "ok", message: `${zone.name} saved` };
}

export async function toggleZoneActive(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({ campusId: z.string().min(1), zoneId: z.string().min(1), isActive: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid request." };

  const { user } = await requireAdmin();
  const updated = await setZoneActive({ ...parsed.data, actorId: user._id });
  if (!updated) return { status: "error", message: "That gate no longer exists." };

  revalidatePath(`/admin/campuses/${parsed.data.campusId}/zones`);
  return { status: "ok", message: parsed.data.isActive ? "Gate reopened" : "Gate closed" };
}

const geofenceSchema = z.object({
  campusId: z.string().min(1),
  /** GeoJSON ring of [lng, lat] pairs. Null clears the boundary. */
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(3).nullable(),
});

export async function saveGeofence(input: unknown): Promise<AdminActionState> {
  const parsed = geofenceSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "A boundary needs at least three points." };
  }

  const { user } = await requireAdmin();
  const ring = parsed.data.coordinates;

  const updated = await updateGeofence({
    campusId: parsed.data.campusId,
    geofence:
      ring === null
        ? null
        : // GeoJSON requires the ring to close on itself.
          { type: "Polygon", coordinates: [closeRing(ring)] },
    actorId: user._id,
  });

  if (!updated) return { status: "error", message: "That campus does not exist." };

  revalidatePath(`/admin/campuses/${parsed.data.campusId}/zones`);
  return { status: "ok", message: ring === null ? "Boundary cleared" : "Boundary saved" };
}

function closeRing(ring: [number, number][]): [number, number][] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return ring;
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

/* ══════════════════════════════════════════════════════════════════════
   Vendors
   ══════════════════════════════════════════════════════════════════════ */

export async function reviewVendorKyc(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({
      restaurantId: z.string().min(1),
      approve: z.boolean(),
      reason: z.string().trim().min(3, "Write a reason. It goes in the audit log."),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid review." };
  }

  const { user } = await requireAdmin();
  const result = await reviewKyc({ ...parsed.data, actorId: user._id });
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/admin/vendors");
  return {
    status: "ok",
    message: `${result.restaurant.name} ${parsed.data.approve ? "approved" : "rejected"}`,
  };
}

export async function saveCommissionOverride(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({
      restaurantId: z.string().min(1),
      commissionBpsOverride: z.number().int().min(0).max(3_000).nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { status: "error", message: "Commission must be 0-30%." };

  const { user } = await requireAdmin();
  const updated = await setCommissionOverride({ ...parsed.data, actorId: user._id });
  if (!updated) return { status: "error", message: "That restaurant does not exist." };

  revalidatePath("/admin/vendors");
  return { status: "ok", message: "Commission updated" };
}

export async function savePayoutDetails(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({
      restaurantId: z.string().min(1),
      accountName: z.string().trim().min(2).max(80),
      accountNumber: z.string().trim().min(6).max(30),
      ifsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "That is not a valid IFSC"),
      upiId: z.string().trim().max(60).nullable(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid bank details." };
  }

  const { user } = await requireAdmin();
  const { restaurantId, ...payout } = parsed.data;

  const updated = await updatePayoutDetails({ restaurantId, payout, actorId: user._id });
  if (!updated) return { status: "error", message: "That restaurant does not exist." };

  revalidatePath("/admin/vendors");
  return { status: "ok", message: "Bank details saved" };
}

const createVendorSchema = z.object({
  ownerName: z.string().trim().min(2, "Owner name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().min(10, "Enter a valid phone number (at least 10 digits)").max(15),
  password: z.string().min(6, "Password must be at least 6 characters"),
  restaurantName: z.string().trim().min(2, "Restaurant name must be at least 2 characters"),
  campusId: z.string().min(1, "Select a campus"),
  cuisines: z
    .string()
    .trim()
    .transform((val) =>
      val
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
    ),
  description: z.string().trim().optional(),
  packagingFeeRupees: z.coerce.number().int().min(0, "Packaging fee cannot be negative"),
  minOrderRupees: z.coerce.number().int().min(0, "Min order cannot be negative"),
  prepMinutes: z.coerce.number().int().min(1, "Prep time must be at least 1 minute"),
  fssai: z.string().trim().optional(),
  gstin: z.string().trim().optional(),
  accountName: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  ifsc: z.string().trim().optional(),
  upiId: z.string().trim().optional(),
});

export async function createVendorAccount(input: unknown): Promise<AdminActionState> {
  const parsed = createVendorSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid vendor details.",
    };
  }

  const { user } = await requireAdmin();
  const result = await createVendorDirectly({
    ...parsed.data,
    actorId: user._id,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/admin/vendors");
  return {
    status: "ok",
    message: `Vendor "${result.restaurant.name}" created! They can now sign in with ${parsed.data.email}.`,
  };
}

export async function deleteVendorAccount(input: unknown): Promise<AdminActionState> {
  const parsed = z.object({ restaurantId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid request." };

  const { user } = await requireAdmin();
  const result = await deleteVendor({
    restaurantId: parsed.data.restaurantId,
    actorId: user._id,
  });

  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/admin/vendors");
  return { status: "ok", message: "Restaurant and vendor account deleted" };
}

/* ══════════════════════════════════════════════════════════════════════
   Orders and disputes
   ══════════════════════════════════════════════════════════════════════ */

/** The override for a power cut, a closure, an emergency. Always a full refund. */
export async function cancelOrderAsAdmin(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({
      orderId: z.string().min(1),
      reason: z.string().trim().min(5, "Write a reason. The student sees this."),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const { user } = await requireAdmin();

  const order = await getOrder(parsed.data.orderId);
  if (!order) return { status: "error", message: "That order does not exist." };

  const result = await transitionOrder({
    orderId: order._id,
    to: ORDER_STATUS.CANCELLED_BY_ADMIN,
    actor: ACTOR.ADMIN,
    actorId: user._id,
    reason: parsed.data.reason,
  });
  if (!result.ok) return { status: "error", message: result.message };

  const refund = await issueRefund({
    order: result.order,
    reason: `Cancelled by TREFOOD: ${parsed.data.reason}`,
    actorId: user._id,
    // Platform-side cancellation, so the vendor does not carry the gateway fee.
    recoverGatewayFeeFromVendor: false,
  });
  if (!refund.ok) {
    return { status: "error", message: `Cancelled, but the refund failed: ${refund.message}` };
  }

  await notifyOrderEvent({
    order: result.order,
    title: "Order cancelled",
    body: `${parsed.data.reason}. Your refund is on its way.`,
  });

  revalidatePath("/admin/orders");
  return { status: "ok", message: `${order.orderNumber} cancelled and refunded` };
}

export async function ruleOnDispute(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({
      disputeId: z.string().min(1),
      uphold: z.boolean(),
      refundAmountPaise: z.number().int().min(0).max(1_000_000).optional(),
      vendorDebitPaise: z.number().int().min(0).max(1_000_000).optional(),
      ruling: z.string().trim().min(5, "Write the ruling. Both sides can see it."),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid ruling." };
  }

  const { user } = await requireAdmin();
  const result = await ruleDispute({ ...parsed.data, actorId: user._id });
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/admin/disputes");
  return {
    status: "ok",
    message: parsed.data.uphold ? "Upheld, refunded and vendor debited" : "Report closed",
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Settlement
   ══════════════════════════════════════════════════════════════════════ */

export async function runSettlementNow(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({
      campusId: z.string().min(1),
      settlementDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
        .optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid settlement request." };

  const { user } = await requireAdmin();

  const campus = await getCampusById(parsed.data.campusId);
  if (!campus) return { status: "error", message: "That campus does not exist." };

  const result = await runSettlement({
    campus,
    ...(parsed.data.settlementDate === undefined
      ? {}
      : { settlementDate: parsed.data.settlementDate }),
    actorId: user._id,
  });

  revalidatePath("/admin/settlements");
  return {
    status: "ok",
    message:
      `${result.settlementDate}: ${result.written.length} statement(s) written, ` +
      `${result.ordersSettled} order(s) settled` +
      (result.skipped.length > 0 ? `, ${result.skipped.length} already run` : ""),
  };
}

export async function markPaid(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({
      settlementId: z.string().min(1),
      utrReference: z.string().trim().min(4, "Enter the bank's UTR reference"),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid reference." };
  }

  const { user } = await requireAdmin();
  const result = await markSettlementPaid({ ...parsed.data, actorId: user._id });
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/admin/settlements");
  return { status: "ok", message: "Marked paid" };
}

/* ══════════════════════════════════════════════════════════════════════
   Students
   ══════════════════════════════════════════════════════════════════════ */

export async function toggleStudentCod(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({
      userId: z.string().min(1),
      blocked: z.boolean(),
      reason: z.string().trim().min(3, "Write a reason. The student sees it on their account."),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const { user } = await requireAdmin();
  const updated = await setCodBlocked({ ...parsed.data, actorId: user._id });
  if (!updated) return { status: "error", message: "That student does not exist." };

  revalidatePath("/admin/students");
  return {
    status: "ok",
    message: parsed.data.blocked ? "Cash on delivery disabled" : "Cash on delivery restored",
  };
}

export async function clearStudentStrikes(input: unknown): Promise<AdminActionState> {
  const parsed = z
    .object({ userId: z.string().min(1), reason: z.string().trim().min(3) })
    .safeParse(input);
  if (!parsed.success) return { status: "error", message: "A reason is required." };

  const { user } = await requireAdmin();
  const updated = await clearStrikes({ ...parsed.data, actorId: user._id });
  if (!updated) return { status: "error", message: "That student does not exist." };

  revalidatePath("/admin/students");
  return { status: "ok", message: "Strikes cleared" };
}

/* ══════════════════════════════════════════════════════════════════════
   Timers
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Run every sweep now.
 *
 * The same functions the cron routes call, exposed to admin so a stuck order
 * can be resolved without waiting for the next minute — and so the whole
 * failure suite is demonstrable in a pitch without anyone watching a clock.
 */
export async function runSweepsNow(): Promise<AdminActionState> {
  await requireAdmin();
  const reports = await runAllSweeps();

  const acted = reports.reduce((n, r) => n + r.acted, 0);
  const errors = reports.flatMap((r) => r.errors);

  revalidatePath("/admin/orders");
  return {
    status: errors.length > 0 ? "error" : "ok",
    message:
      errors.length > 0
        ? `${acted} order(s) actioned, ${errors.length} error(s): ${errors[0] ?? ""}`
        : acted === 0
          ? "Nothing was overdue"
          : `${acted} order(s) actioned`,
  };
}
