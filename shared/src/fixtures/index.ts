/**
 * Typed fixtures, shaped exactly like the real MongoDB documents.
 *
 * These exist so the UI phases (P2–P4) can be built before the database does, and
 * they are the contract the seed script in Phase 5 reproduces. A fixture that invents
 * a field the data model does not have is a schema change in disguise.
 */
export * from "./campus.js";
export * from "./restaurants.js";
export * from "./menu.js";
export * from "./orders.js";
export * from "./admin.js";
