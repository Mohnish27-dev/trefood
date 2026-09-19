import "server-only";

import * as db from "@/server/db/collections";
import {
  ACTOR,
  DEFAULTS,
  ORDER_STATUS,
  STUCK_REASON,
  TERMINAL_STATUSES,
  type OrderStatus,
  type StuckReason,
} from "@/lib/constants";
import type { Paise } from "@/lib/money";
import type { Campus } from "@/types/campus";
import type { Order } from "@/types/order";
import { writeAudit } from "./audit";

export type IssueCategory = "REJECTED" | "VENDOR_NOT_ACCEPTED" | "DELAYED";

export interface IssueDeskItem {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  campusId: string;
  campusName: string;
  restaurantName: string;
  restaurantPhone: string;
  customerName: string;
  customerPhone: string;
  zoneName: string;
  itemsSummary: string;
  grandTotalPaise: Paise;
  createdAt: string;
  minutesInState: number;
  issueCategory: IssueCategory;
  issueReason: string;
  stuckReasons: StuckReason[];
  assignedTeammate: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  cancellationReason: string | null;
}

export interface IssueDeskSnapshot {
  items: IssueDeskItem[];
  totalOpenCount: number;
  rejectedCount: number;
  vendorNotAcceptedCount: number;
  delayedCount: number;
  resolvedCount: number;
  serverTime: string;
}

/**
 * Fetch issue desk snapshot including rejected, delayed, and vendor-not-accepted orders.
 */
export async function getIssueDeskSnapshot(params: {
  campusId?: string;
  issueCategory?: "ALL" | IssueCategory;
  statusFilter?: "open" | "resolved" | "all";
  search?: string;
  now?: Date;
}): Promise<IssueDeskSnapshot> {
  const now = params.now ?? new Date();

  const campuses = await (await db.campuses()).find({}).toArray();
  const campusById = new Map(campuses.map((c) => [c._id, c]));

  // Base filter for order query
  const queryFilter: Record<string, unknown> = {};
  if (params.campusId) {
    queryFilter.campusId = params.campusId;
  }

  // Fetch candidate orders from DB (limit 300 to keep responsive)
  const orders = await (await db.orders())
    .find(queryFilter)
    .sort({ "timestamps.createdAt": -1 })
    .limit(300)
    .toArray();

  const allItems: IssueDeskItem[] = [];

  for (const order of orders) {
    const campus = campusById.get(order.campusId);
    const categoryInfo = classifyOrderIssue(order, campus, now);

    if (!categoryInfo) {
      continue; // Not an issue order
    }

    const itemsSummary = order.items
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(", ");

    const minutesInState = computeMinutesInState(order, now);

    const isResolved = order.issueDesk?.isResolved ?? false;

    const item: IssueDeskItem = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      campusId: order.campusId,
      campusName: campus?.name ?? "Unknown campus",
      restaurantName: order.restaurantSnapshot.name,
      restaurantPhone: order.restaurantSnapshot.phone,
      customerName: order.customerSnapshot.name,
      customerPhone: order.customerSnapshot.phone,
      zoneName: order.deliveryZoneSnapshot.name,
      itemsSummary,
      grandTotalPaise: order.pricing.grandTotalPaise,
      createdAt: order.timestamps.createdAt.toISOString(),
      minutesInState,
      issueCategory: categoryInfo.category,
      issueReason: categoryInfo.reason,
      stuckReasons: categoryInfo.stuckReasons,
      assignedTeammate: order.issueDesk?.assignedTeammate ?? null,
      isResolved,
      resolvedAt: order.issueDesk?.resolvedAt
        ? new Date(order.issueDesk.resolvedAt).toISOString()
        : null,
      resolvedBy: order.issueDesk?.resolvedBy ?? null,
      resolutionNote: order.issueDesk?.resolutionNote ?? null,
      cancellationReason: order.cancellation?.reason ?? null,
    };

    allItems.push(item);
  }

  // Compute counts
  const totalOpenCount = allItems.filter((i) => !i.isResolved).length;
  const rejectedCount = allItems.filter((i) => !i.isResolved && i.issueCategory === "REJECTED").length;
  const vendorNotAcceptedCount = allItems.filter(
    (i) => !i.isResolved && i.issueCategory === "VENDOR_NOT_ACCEPTED",
  ).length;
  const delayedCount = allItems.filter((i) => !i.isResolved && i.issueCategory === "DELAYED").length;
  const resolvedCount = allItems.filter((i) => i.isResolved).length;

  // Apply filters
  let filtered = allItems;

  const statusFilter = params.statusFilter ?? "open";
  if (statusFilter === "open") {
    filtered = filtered.filter((i) => !i.isResolved);
  } else if (statusFilter === "resolved") {
    filtered = filtered.filter((i) => i.isResolved);
  }

  if (params.issueCategory && params.issueCategory !== "ALL") {
    filtered = filtered.filter((i) => i.issueCategory === params.issueCategory);
  }

  if (params.search && params.search.trim().length > 0) {
    const q = params.search.trim().toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.orderNumber.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        i.customerPhone.toLowerCase().includes(q) ||
        i.restaurantName.toLowerCase().includes(q) ||
        (i.assignedTeammate && i.assignedTeammate.toLowerCase().includes(q)),
    );
  }

  // Sort: open items first, then by createdAt desc
  filtered.sort((a, b) => {
    if (a.isResolved !== b.isResolved) {
      return a.isResolved ? 1 : -1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    items: filtered,
    totalOpenCount,
    rejectedCount,
    vendorNotAcceptedCount,
    delayedCount,
    resolvedCount,
    serverTime: now.toISOString(),
  };
}

/**
 * Classify if an order has an issue and categorize it.
 */
function classifyOrderIssue(
  order: Order,
  campus: Campus | undefined,
  now: Date,
): { category: IssueCategory; reason: string; stuckReasons: StuckReason[] } | null {
  const ms = now.getTime();
  const settings = campus?.settings;

  // 1. REJECTED orders
  if (order.status === ORDER_STATUS.REJECTED_BY_VENDOR) {
    return {
      category: "REJECTED",
      reason: order.cancellation?.reason || "Vendor rejected order",
      stuckReasons: [],
    };
  }

  // 2. VENDOR_NOT_ACCEPTED orders
  if (order.status === ORDER_STATUS.EXPIRED_NO_ACK) {
    return {
      category: "VENDOR_NOT_ACCEPTED",
      reason: "Order expired because vendor did not accept in time",
      stuckReasons: ["ACK_OVERDUE"],
    };
  }

  const placedAt = order.timestamps.placedAt?.getTime() ?? null;
  const ackSec = settings?.vendorAckSeconds ?? DEFAULTS.vendorAckSeconds;
  if (
    (order.status === ORDER_STATUS.PLACED || order.status === ORDER_STATUS.PENDING_CONFIRMATION) &&
    placedAt !== null &&
    ms > placedAt + ackSec * 1_000
  ) {
    return {
      category: "VENDOR_NOT_ACCEPTED",
      reason: "Vendor has not accepted order within threshold",
      stuckReasons: ["ACK_OVERDUE"],
    };
  }

  // 3. DELAYED orders (Active orders exceeding timeline)
  const isTerminal = TERMINAL_STATUSES.includes(order.status);
  const isDelivered = order.status === ORDER_STATUS.DELIVERED || order.status === ORDER_STATUS.SETTLED;

  if (!isTerminal && !isDelivered) {
    const stuck: StuckReason[] = [];

    const atGateAt = order.timestamps.atGateAt?.getTime() ?? null;
    const gateGraceSec = settings?.gateGraceSeconds ?? DEFAULTS.gateGraceSeconds;
    if (order.status === ORDER_STATUS.AT_GATE && atGateAt !== null && ms > atGateAt + gateGraceSec * 1_000) {
      stuck.push("GATE_OVERDUE");
    }

    const acceptedAt = order.timestamps.acceptedAt?.getTime() ?? null;
    if (
      order.status === ORDER_STATUS.OUT_FOR_DELIVERY &&
      acceptedAt !== null &&
      order.prepMinutes !== null &&
      ms > acceptedAt + order.prepMinutes * DEFAULTS.atGateNagMultiplier * 60_000
    ) {
      stuck.push("AT_GATE_NOT_TAPPED");
    }

    if (order.stockout && order.stockout.resolvedAt === null && ms > order.stockout.expiresAt.getTime()) {
      stuck.push("STOCKOUT_UNANSWERED");
    }

    // Check general prep/delivery delay
    const minutesInState = computeMinutesInState(order, now);
    const expectedPrep = order.prepMinutes ?? 20;

    const isPreparingDelayed =
      (order.status === ORDER_STATUS.ACCEPTED || order.status === ORDER_STATUS.PREPARING) &&
      minutesInState > expectedPrep;

    const isDeliveryDelayed =
      (order.status === ORDER_STATUS.OUT_FOR_DELIVERY || order.status === ORDER_STATUS.AT_GATE) &&
      minutesInState > 25;

    if (stuck.length > 0 || isPreparingDelayed || isDeliveryDelayed) {
      let delayReason = "Order preparation or delivery is delayed";
      if (stuck.length > 0) {
        if (stuck.includes("GATE_OVERDUE")) delayReason = "Customer delayed at delivery gate";
        else if (stuck.includes("AT_GATE_NOT_TAPPED")) delayReason = "Vendor delayed in dispatch/gate arrival";
        else if (stuck.includes("STOCKOUT_UNANSWERED")) delayReason = "Stockout replacement unanswered";
      } else if (isPreparingDelayed) {
        delayReason = `Order in preparation for ${minutesInState} mins (expected ${expectedPrep} mins)`;
      } else if (isDeliveryDelayed) {
        delayReason = `Order in delivery for ${minutesInState} mins`;
      }

      return {
        category: "DELAYED",
        reason: delayReason,
        stuckReasons: stuck,
      };
    }
  }

  // Also include explicitly flagged issue orders (if marked unresolved manually)
  if (order.issueDesk && !order.issueDesk.isResolved) {
    return {
      category: "DELAYED",
      reason: order.issueDesk.resolutionNote || "Manually flagged issue",
      stuckReasons: [],
    };
  }

  return null;
}

function computeMinutesInState(order: Order, now: Date): number {
  const t = order.timestamps;
  const last =
    t.atGateAt ?? t.dispatchedAt ?? t.readyAt ?? t.acceptedAt ?? t.placedAt ?? t.createdAt;
  return Math.max(0, Math.trunc((now.getTime() - last.getTime()) / 60_000));
}

/**
 * Assign teammate to an order issue.
 */
export async function assignIssueTeammate(params: {
  orderId: string;
  teammateName: string | null;
  actorId: string;
}): Promise<{ ok: true; order: Order } | { ok: false; message: string }> {
  const orders = await db.orders();
  const before = await orders.findOne({ _id: params.orderId });
  if (!before) return { ok: false, message: "Order not found." };

  const updated = await orders.findOneAndUpdate(
    { _id: params.orderId },
    {
      $set: {
        "issueDesk.assignedTeammate": params.teammateName?.trim() || null,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) return { ok: false, message: "Failed to update order teammate assignment." };

  await writeAudit({
    entity: "ORDER",
    entityId: updated._id,
    orderId: updated._id,
    from: before.issueDesk?.assignedTeammate ?? "unassigned",
    to: params.teammateName?.trim() ?? "unassigned",
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: params.teammateName
      ? `Issue assigned to teammate ${params.teammateName}`
      : "Issue unassigned",
  });

  return { ok: true, order: updated };
}

/**
 * Mark issue as resolved.
 */
export async function resolveIssueDeskItem(params: {
  orderId: string;
  resolutionNote?: string | undefined;
  actorId: string;
}): Promise<{ ok: true; order: Order } | { ok: false; message: string }> {
  const orders = await db.orders();
  const before = await orders.findOne({ _id: params.orderId });
  if (!before) return { ok: false, message: "Order not found." };

  const now = new Date();
  const note = params.resolutionNote?.trim() || "Issue marked as resolved by admin";

  const updated = await orders.findOneAndUpdate(
    { _id: params.orderId },
    {
      $set: {
        "issueDesk.isResolved": true,
        "issueDesk.resolvedAt": now,
        "issueDesk.resolvedBy": params.actorId,
        "issueDesk.resolutionNote": note,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) return { ok: false, message: "Failed to resolve issue." };

  await writeAudit({
    entity: "ORDER",
    entityId: updated._id,
    orderId: updated._id,
    from: "OPEN_ISSUE",
    to: "RESOLVED_ISSUE",
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: note,
  });

  return { ok: true, order: updated };
}

/**
 * Reopen a resolved issue.
 */
export async function reopenIssueDeskItem(params: {
  orderId: string;
  actorId: string;
}): Promise<{ ok: true; order: Order } | { ok: false; message: string }> {
  const orders = await db.orders();
  const before = await orders.findOne({ _id: params.orderId });
  if (!before) return { ok: false, message: "Order not found." };

  const updated = await orders.findOneAndUpdate(
    { _id: params.orderId },
    {
      $set: {
        "issueDesk.isResolved": false,
        "issueDesk.resolvedAt": null,
        "issueDesk.resolvedBy": null,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) return { ok: false, message: "Failed to reopen issue." };

  await writeAudit({
    entity: "ORDER",
    entityId: updated._id,
    orderId: updated._id,
    from: "RESOLVED_ISSUE",
    to: "OPEN_ISSUE",
    actorId: params.actorId,
    actorRole: ACTOR.ADMIN,
    reason: "Issue reopened by admin",
  });

  return { ok: true, order: updated };
}
