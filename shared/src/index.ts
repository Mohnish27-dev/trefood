/**
 * @trefood/shared — the contract between the two services.
 *
 * What belongs here: anything both `backend` and `frontend` must agree on exactly.
 * Domain types, the order-status union, money arithmetic, campus timers, and the
 * request/response shapes of the API.
 *
 * What does NOT belong here: database access, sessions, Razorpay, React, or the DOM.
 * If a module needs one of those, it belongs in `backend/` or `frontend/`.
 *
 * The reason this package exists at all is that a process boundary now sits between
 * the two halves. Without one shared definition of `IOrder` and `OrderStatus`, the
 * frontend's idea of an order and the backend's would drift silently, and the first
 * symptom would be a student seeing a price the server never computed.
 */

export { formatEnvError } from "./env-error.js";
export { optional, optionalWithDefault } from "./env-optional.js";

// Added in Phase 1 (docs/PHASES.md):
//   export * from "./types/order.js";      domain types
//   export * from "./money.js";            paise arithmetic, ceilToRupee, formatINR
//   export * from "./constants.js";        OrderStatus, roles, timers
//   export * from "./api/contracts.js";    request/response schemas
