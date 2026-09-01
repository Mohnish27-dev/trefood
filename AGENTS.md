<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# TREFOOD

Read `docs/DECISIONS.md` first — it is the source of truth, and any doc that
contradicts it is a bug. `docs/PHASES.md` is the build plan (P0 → P15); work in order
and do not start a phase whose dependencies are not green.

## Standing rules — true in every phase

1. All money is **integer paise**. Format to rupees only at render.
2. The **server recomputes every price**. A client-supplied price is a security bug.
3. **Exactly one pricing function** (`backend/src/services/pricing.ts`). Cart preview
   and order creation call the same one. The frontend computes no money.
4. Orders store **snapshots**, not references.
5. Every webhook is **signature-verified, then made idempotent** via the
   `webhookEvents` unique index — in that order — and only then acted on.
6. Every state transition writes an **append-only `auditLogs` entry**.
7. **One guarded FSM function** owns `order.status`. Nothing else writes it.
8. Cron routes are **gated by `CRON_SECRET`**.
9. Every backend route re-checks **role AND resource ownership**. Frontend middleware
   is routing, not authorisation.
10. **Never cache order state** in the service worker.
11. Gate codes are **server-generated** and absent from the student's API payload
    until `status === AT_GATE`.
12. **The COD invariant is sacred:** `codOnlineToken === platformCommission` and
    `cashDueOnDelivery === vendorReceivable`.
13. **The frontend never reaches past the backend.** No MongoDB driver, no Razorpay
    SDK, no secret. If the UI needs data, add a backend route and call it through
    `frontend/src/api-client`.

## Never build these

A rider app, rider login, rider GPS, or any moving dot on a map — riders have no
phones (D4). Also: stock *counting* (availability is a boolean), multi-restaurant
carts, scheduled orders, student wallets, order editing after placement, and
student-initiated cancellation after vendor acceptance. Full list and reasoning:
`docs/MASTER_PROMPT_PRD.md` Part 7.

UI copy says **"Live Order Status"**, never "Live Rider Tracking".

## Layout

An npm-workspaces monorepo with two runnable services:

- **`shared/`** (`@trefood/shared`) — types, money, constants, API contracts.
  Imported by both. No database, no session, no React, no DOM.
- **`backend/`** (`@trefood/backend`, Express, :4000) — owns MongoDB, every business
  rule, Razorpay, the cron routes, and every secret.
- **`frontend/`** (`@trefood/frontend`, Next.js, :3000) — UI only.

Business logic lives in `backend/src/services/`. Routes and components are thin
adapters: authenticate, parse, call a service, render. A service must be callable from
a unit test with no HTTP, no session, and no React.

Backend and shared are ESM with `NodeNext` resolution — relative imports carry a
`.js` extension even though the source is `.ts`. Build `@trefood/shared` before
typechecking the others.

See `docs/PROJECT_STRUCTURE.md`.
