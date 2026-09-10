import "server-only";

import type { Collection } from "mongodb";

import { getDb } from "./client";
import type {
  AuditLog,
  AuthSession,
  Campus,
  CommissionStatement,
  Coupon,
  Counter,
  DeliveryPartner,
  EmailOtp,
  LedgerEntry,
  MenuCategory,
  MenuItem,
  Order,
  PushSubscription,
  Restaurant,
  User,
} from "@/types";

/**
 * Typed collection accessors.
 *
 * Every read and write in the system goes through this file. That is what
 * makes adding a read replica, a cache layer or a metrics wrapper a
 * single-file change rather than a codebase-wide one.
 *
 * Ids are strings (see lib/ids.ts), so `Collection<T>` uses the document's own
 * `_id: string` and nothing needs `.toString()` at the RSC boundary.
 */

export const COLLECTION = {
  campuses: "campuses",
  users: "users",
  restaurants: "restaurants",
  menuCategories: "menuCategories",
  menuItems: "menuItems",
  orders: "orders",
  coupons: "coupons",
  ledgerEntries: "ledgerEntries",
  commissionStatements: "commissionStatements",
  auditLogs: "auditLogs",
  pushSubscriptions: "pushSubscriptions",
  counters: "counters",
  deliveryPartners: "deliveryPartners",
  sessions: "sessions",
  emailOtps: "emailOtps",
} as const;

export type CollectionName = (typeof COLLECTION)[keyof typeof COLLECTION];

export const campuses = async (): Promise<Collection<Campus>> =>
  (await getDb()).collection<Campus>(COLLECTION.campuses);

export const users = async (): Promise<Collection<User>> =>
  (await getDb()).collection<User>(COLLECTION.users);

/** One document per signed-in browser. See `@/server/auth/session-store`. */
export const sessions = async (): Promise<Collection<AuthSession>> =>
  (await getDb()).collection<AuthSession>(COLLECTION.sessions);

/** Pending six-digit codes, and the signups waiting on them. */
export const emailOtps = async (): Promise<Collection<EmailOtp>> =>
  (await getDb()).collection<EmailOtp>(COLLECTION.emailOtps);

export const restaurants = async (): Promise<Collection<Restaurant>> =>
  (await getDb()).collection<Restaurant>(COLLECTION.restaurants);

export const menuCategories = async (): Promise<Collection<MenuCategory>> =>
  (await getDb()).collection<MenuCategory>(COLLECTION.menuCategories);

export const menuItems = async (): Promise<Collection<MenuItem>> =>
  (await getDb()).collection<MenuItem>(COLLECTION.menuItems);

export const orders = async (): Promise<Collection<Order>> =>
  (await getDb()).collection<Order>(COLLECTION.orders);

export const coupons = async (): Promise<Collection<Coupon>> =>
  (await getDb()).collection<Coupon>(COLLECTION.coupons);

export const ledgerEntries = async (): Promise<Collection<LedgerEntry>> =>
  (await getDb()).collection<LedgerEntry>(COLLECTION.ledgerEntries);

export const commissionStatements = async (): Promise<Collection<CommissionStatement>> =>
  (await getDb()).collection<CommissionStatement>(COLLECTION.commissionStatements);

export const auditLogs = async (): Promise<Collection<AuditLog>> =>
  (await getDb()).collection<AuditLog>(COLLECTION.auditLogs);

export const pushSubscriptions = async (): Promise<Collection<PushSubscription>> =>
  (await getDb()).collection<PushSubscription>(COLLECTION.pushSubscriptions);

export const counters = async (): Promise<Collection<Counter>> =>
  (await getDb()).collection<Counter>(COLLECTION.counters);

export const deliveryPartners = async (): Promise<Collection<DeliveryPartner>> =>
  (await getDb()).collection<DeliveryPartner>(COLLECTION.deliveryPartners);
