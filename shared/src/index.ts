/**
 * @trefood/shared — the contract between the two services.
 *
 * What belongs here: anything both `backend` and `frontend` must agree on exactly.
 * Domain types, the order-status union, money arithmetic, campus timers, and (later)
 * the request/response shapes of the API.
 *
 * What does NOT belong here: database access, sessions, Razorpay, React, or the DOM.
 * If a module needs one of those, it belongs in `backend/` or `frontend/`.
 *
 * The reason this package exists is that a process boundary sits between the two
 * halves. Without one shared definition of `IOrder` and `OrderStatus`, the frontend's
 * idea of an order and the backend's would drift silently, and the first symptom
 * would be a student seeing a price the server never computed.
 */

// Environment helpers, used by both services' env schemas.
export { formatEnvError } from "./env-error.js";
export { optional, optionalWithDefault } from "./env-optional.js";

// ★ Money. Every rupee in the system flows through here.
export * from "./money.js";

// The vocabulary: statuses, roles, timers, pricing defaults.
export * from "./constants.js";

// Domain types, shaped exactly like the MongoDB documents.
export * from "./types/index.js";

// Typed fixtures for the UI phases and the Phase 5 seed script.
export * from "./fixtures/index.js";

// Added in Phase 5:
//   export * from "./api/contracts.js";    request/response Zod schemas
