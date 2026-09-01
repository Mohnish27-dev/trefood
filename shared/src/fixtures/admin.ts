import { negatePaise, paise, rupees, subtractPaise } from "../money.js";
import type {
  IAuditLog,
  IDispute,
  ILedgerEntry,
  ISettlement,
  IUser,
} from "../types/index.js";

/**
 * Fixtures for the admin console.
 *
 * Chosen so every state an admin has to act on exists: an open dispute and a ruled
 * one, a settlement that is payable and one that carries forward, a student one
 * strike from a COD block and one already blocked, and audit entries covering both
 * an automated transition and a discretionary human ruling.
 */

// ── Students ──────────────────────────────────────────────────────────────

export const students: IUser[] = [
  {
    _id: "user-student-aditi",
    authId: "auth-aditi",
    name: "Aditi Raman",
    email: "aditi@nitp.ac.in",
    phone: "+919812345678",
    role: "STUDENT",
    campusId: "campus-nitp",
    codBlocked: false,
    noShowStrikes: 0,
    createdAt: "2026-08-02T10:00:00.000Z",
  },
  {
    _id: "user-student-rohit",
    authId: "auth-rohit",
    name: "Rohit Kumar",
    email: "rohit@nitp.ac.in",
    phone: "+919812345679",
    role: "STUDENT",
    campusId: "campus-nitp",
    codBlocked: false,
    // One more no-show flips codBlocked. The admin screen must make that visible
    // BEFORE it happens, so a warning is possible instead of a surprise.
    noShowStrikes: 1,
    createdAt: "2026-08-05T10:00:00.000Z",
  },
  {
    _id: "user-student-neha",
    authId: "auth-neha",
    name: "Neha Singh",
    email: "neha@nitp.ac.in",
    phone: "+919812345680",
    role: "STUDENT",
    campusId: "campus-nitp",
    // Blocked immediately after refusing to pay COD cash (F9) — deliberate, not
    // accidental, so it does not wait for two strikes. Prepaid still works: the
    // account is never banned.
    codBlocked: true,
    noShowStrikes: 2,
    createdAt: "2026-08-06T10:00:00.000Z",
  },
];

// ── Disputes ──────────────────────────────────────────────────────────────

export const disputes: IDispute[] = [
  {
    _id: "dispute-open",
    orderId: "order-delivered",
    customerId: "user-student-aditi",
    restaurantId: "rest-nit-canteen",
    reason: "WRONG_ITEM",
    note: "Ordered Paneer Roll, received Egg Roll. I do not eat egg.",
    photoUrls: ["https://placeholder.supabase.co/storage/v1/object/public/disputes/1.jpg"],
    status: "OPEN",
    createdAt: "2026-09-01T17:10:00.000Z",
  },
  {
    _id: "dispute-upheld",
    orderId: "order-settled",
    customerId: "user-student-rohit",
    restaurantId: "rest-nit-canteen",
    reason: "SPILLED_OR_COLD",
    note: "Gravy leaked through the bag.",
    photoUrls: ["https://placeholder.supabase.co/storage/v1/object/public/disputes/2.jpg"],
    status: "UPHELD",
    ruling: {
      by: "user-admin",
      refundAmountPaise: rupees(120),
      reason: "Photo shows clear leakage. Partial refund for the affected item.",
      at: "2026-08-31T18:40:00.000Z",
    },
    createdAt: "2026-08-31T18:20:00.000Z",
  },
];

// ── Ledger ────────────────────────────────────────────────────────────────

export const ledgerEntries: ILedgerEntry[] = [
  {
    _id: "ledger-1",
    restaurantId: "rest-nit-canteen",
    orderId: "order-rejected_by_vendor",
    type: "REFUND_GATEWAY_RECOVERY",
    // D3 — Razorpay keeps its fee on a refund, and that loss is the vendor's.
    amountPaise: negatePaise(paise(531)),
    note: "Gateway fee not returned on refund of TRF-NITP-8912",
    createdAt: "2026-09-01T16:45:00.000Z",
  },
  {
    _id: "ledger-2",
    restaurantId: "rest-nit-canteen",
    orderId: "order-settled",
    type: "DISPUTE_DEBIT",
    amountPaise: negatePaise(rupees(120)),
    note: "Dispute upheld on TRF-NITP-8918 — spilled order",
    createdAt: "2026-08-31T18:40:00.000Z",
  },
];

// ── Settlements ───────────────────────────────────────────────────────────

const gangaGross = rupees(84);

export const settlements: ISettlement[] = [
  {
    _id: "settlement-1",
    restaurantId: "rest-nit-canteen",
    settlementDate: "2026-09-01",
    grossPrepaidPaise: rupees(2424),
    adjustmentsPaise: negatePaise(paise(17631)),
    netPayoutPaise: subtractPaise(rupees(2424), paise(17631)),
    codOrderCount: 7,
    prepaidOrderCount: 12,
    status: "PENDING",
    createdAt: "2026-09-01T18:29:00.000Z",
  },
  {
    _id: "settlement-2",
    restaurantId: "rest-ganga-dhaba",
    settlementDate: "2026-09-01",
    grossPrepaidPaise: gangaGross,
    adjustmentsPaise: paise(0),
    netPayoutPaise: gangaGross,
    codOrderCount: 2,
    prepaidOrderCount: 1,
    // Under ₹100 rolls forward, so a per-transfer fee does not eat the payout.
    status: "CARRIED_FORWARD",
    createdAt: "2026-09-01T18:29:00.000Z",
  },
  {
    _id: "settlement-3",
    restaurantId: "rest-momo-junction",
    settlementDate: "2026-08-31",
    grossPrepaidPaise: rupees(1810),
    adjustmentsPaise: paise(0),
    netPayoutPaise: rupees(1810),
    codOrderCount: 4,
    prepaidOrderCount: 9,
    status: "PAID",
    utr: "UTRN2608311742",
    createdAt: "2026-08-31T18:29:00.000Z",
    paidAt: "2026-09-01T05:15:00.000Z",
  },
];

// ── Audit log ─────────────────────────────────────────────────────────────

export const auditLogs: IAuditLog[] = [
  {
    _id: "audit-1",
    action: "ORDER_TRANSITION",
    orderId: "order-at_gate",
    restaurantId: "rest-nit-canteen",
    actorId: "user-vendor-staff",
    actorRole: "VENDOR_STAFF",
    from: "OUT_FOR_DELIVERY",
    to: "AT_GATE",
    at: "2026-09-01T17:00:00.000Z",
  },
  {
    _id: "audit-2",
    action: "ORDER_TRANSITION",
    orderId: "order-expired_no_ack",
    restaurantId: "rest-ganga-dhaba",
    // Cron-driven, so the actor is the system. Still logged — an automated action
    // that leaves no trail is indistinguishable from a bug.
    actorId: "SYSTEM",
    actorRole: "SYSTEM",
    from: "PLACED",
    to: "EXPIRED_NO_ACK",
    reason: "No vendor acknowledgement within 240s",
    at: "2026-09-01T16:44:00.000Z",
  },
  {
    _id: "audit-3",
    action: "DISPUTE_RULING",
    orderId: "order-settled",
    restaurantId: "rest-nit-canteen",
    actorId: "user-admin",
    actorRole: "ADMIN",
    reason: "Photo shows clear leakage. Partial refund for the affected item.",
    metadata: { refundPaise: 12000 },
    at: "2026-08-31T18:40:00.000Z",
  },
  {
    _id: "audit-4",
    action: "COMMISSION_OVERRIDE",
    restaurantId: "rest-momo-junction",
    actorId: "user-super-admin",
    actorRole: "SUPER_ADMIN",
    reason: "Launch promotion for the first month",
    metadata: { from: 10, to: 8 },
    at: "2026-08-15T09:00:00.000Z",
  },
  {
    _id: "audit-5",
    action: "COD_BLOCK",
    actorId: "SYSTEM",
    actorRole: "SYSTEM",
    reason: "Student refused COD payment at the gate",
    metadata: { studentId: "user-student-neha" },
    at: "2026-08-28T19:12:00.000Z",
  },
  {
    _id: "audit-6",
    action: "SETTLEMENT_RUN",
    actorId: "SYSTEM",
    actorRole: "SYSTEM",
    metadata: { date: "2026-09-01", vendors: 3 },
    at: "2026-09-01T18:29:00.000Z",
  },
];
