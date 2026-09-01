# TREFOOD — Build Phases

> The execution plan. Derived from
> [MASTER_PROMPT_PRD.md](MASTER_PROMPT_PRD.md) Part 5,
> [SYSTEM_ARCHITECTURE_AND_FLOWS.md](SYSTEM_ARCHITECTURE_AND_FLOWS.md) and
> [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md), and governed by
> [DECISIONS.md](DECISIONS.md). Where this file and DECISIONS.md disagree,
> **DECISIONS.md wins.**
>
> Last updated: 2026-09-01

---

## 0. How to read this file

Every phase below states five things:

| Field | Meaning |
| :-- | :-- |
| **Goal** | The one sentence that justifies the phase existing. |
| **Depends on** | Phases that must be green first. Nothing else. |
| **Build** | The ordered checklist of work. |
| **Exit gate** | The demo that proves the phase is done. Not "code written" — *demonstrated*. |
| **Do not** | The specific wrong turn this phase invites. |

A phase is **not** finished until its exit gate is demonstrated **and** the
[Definition of Done](MASTER_PROMPT_PRD.md#part-6--definition-of-done) holds for every
file it touched.

---

## 1. Sequencing strategy — frontend first, against typed fixtures

The PRD's Part 5 build order is backend-shaped: data → vendor → student → pricing →
payments. This file reorders the *early* phases to build the **frontend step by step
first**, then wire it to the real architecture. That reordering is safe only because
of one rule:

> **Phase 1 freezes the TypeScript types and the fixture data before a single screen
> is drawn. Every UI phase renders from typed fixtures that are shaped exactly like
> the real documents in [SYSTEM_ARCHITECTURE_AND_FLOWS.md §7](SYSTEM_ARCHITECTURE_AND_FLOWS.md#7-data-model-mongodb-collections).**

Those types live in **`@trefood/shared`**, imported by both services. That is what
makes the frontend/backend split survivable: one definition of `IOrder`, one
`OrderStatus` union, one money module. Without it the two halves drift, and the first
symptom is a student seeing a price the server never computed.

Without that rule, frontend-first means building screens against imagined data and
rewriting them all in Phase 7. With it, wiring a screen to real data is a change of
import path, not a rewrite.

Two constraints survive the reordering untouched, because breaking them breaks money:

1. **Pricing (Phase 8) ships before payments (Phase 9).** Every downstream bug in a
   payment system is a pricing bug wearing a disguise.
2. **UI phases never compute a price.** They render `pricing.grandTotalPaise` from a
   fixture. The number is produced by `pricing.ts` in Phase 8 and by nothing else,
   ever. A UI phase that adds two money fields together has introduced the exact
   drift that [PROJECT_STRUCTURE.md §1](PROJECT_STRUCTURE.md#1-the-two-rules-that-shape-everything)
   exists to prevent.

### What the frontend/backend split changed

The repo is an npm-workspaces monorepo: `shared/`, `backend/` (Express, :4000),
`frontend/` (Next.js, :3000). Two things follow, and they apply to every phase below:

- **Server Components and Server Actions do not touch MongoDB.** Reads are HTTP calls
  through `frontend/src/api-client`; writes are `POST`/`PATCH` to a backend route.
  Where an earlier draft of these docs said "Server Action", read "backend route
  called through the api-client".
- **Every rule and every secret lives in `backend/`.** A phase that adds a business
  rule adds it to `backend/src/services/`, and exposes it through a thin route.

### Dependency graph

```
   P0 Foundation  (workspaces: shared · backend · frontend)
      │
   P1 Contracts + Design System ────────────────┐
      │  types/money/constants -> @trefood/shared
      │                                          │
      ├── P2 Student UI ──┐                      │
      ├── P3 Vendor UI ───┤ (parallel, fixtures) │
      └── P4 Admin UI ────┘                      │
                          │                      │
                       P5 Data Layer ────────────┘
                          │
                       P6 Auth + RBAC
                          │
                       P7 Campus / Vendor / Menu wiring
                          │
                       P8 Pricing Engine  ★ tests must be green
                          │
                       P9 Payments
                          │
                      P10 Order Lifecycle + FSM
                          │
                      P11 Gate Handoff (D4)
                          │
                      P12 Failure Handling + Cron
                          │
                      P13 Settlement + Ledger
                          │
                      P14 PWA + Push + Observability
                          │
                      P15 Hardening + Launch Readiness
```

### Map back to the PRD build order

| This file | PRD Part 5 |
| :-- | :-- |
| P0 | Phase 0 Foundation |
| P1 – P4 | *(new)* — the frontend-first split |
| P5 – P7 | Phase 1 Data & admin, Phase 2 Vendor & menu, Phase 3 Student browse |
| P8 | Phase 4 Pricing engine |
| P9 | Phase 5 Payments |
| P10 | Phase 6 Order lifecycle |
| P11 | Phase 7 Gate handoff |
| P12 | Phase 8 Failures |
| P13 | Phase 9 Settlement |
| P14 – P15 | Phase 10 Polish |

---

# PHASE 0 — Foundation & Environment

**Goal.** Both services boot, connect to every external service, and fail loudly when
they cannot.

**Depends on.** Nothing.

### Build

1. **Workspaces monorepo.** Root `package.json` with
   `"workspaces": ["shared", "backend", "frontend"]`, and a `tsconfig.base.json`
   holding the strictness every package inherits.
2. **`shared/` — `@trefood/shared`.** ESM, built with `tsc` to `dist/`, consumed by
   both services. At this phase it holds only the environment helpers; Phase 1 fills
   it with types, money and constants.
3. **`backend/` — `@trefood/backend`.** Express 5 + TypeScript.
   - `src/env.ts` — a Zod schema over **every secret in the system**, validated
     eagerly at import.
   - `src/app.ts` — the app factory: helmet, a CORS **allowlist** with credentials,
     JSON parsing that **preserves the raw body** for later webhook HMAC verification,
     and one error boundary that answers 400 for a Zod failure and a generic 500 for
     everything else.
   - `src/db/client.ts` — the Mongo pool, `maxPoolSize: 10`. This is the free-tier
     ceiling from
     [FAILURES_AND_EDGE_CASES.md §5.5](FAILURES_AND_EDGE_CASES.md#5-operational-runbook--things-that-will-actually-happen-in-week-1),
     not an optimisation.
   - `src/index.ts` — boot order: **env → Sentry → Mongo pool → bind port**, plus
     graceful SIGTERM draining. The port binds last on purpose: a process that accepts
     traffic before its pool is open serves 500s during every deploy.
   - `/health` (liveness, no DB) and `/health/ready` (pings Mongo, 503 on failure).
     Two routes, not one: an orchestrator must not restart a healthy process because
     Atlas blipped for two seconds.
4. **`frontend/` — `@trefood/frontend`.** Next.js 16, App Router, Tailwind, shadcn.
   - `src/lib/env.ts` — `NEXT_PUBLIC_*` only. Nothing here is worth stealing.
   - `src/api-client/` — the typed fetch wrapper. The **only** way the UI reaches the
     backend, so that `credentials: "include"`, `cache: "no-store"` and `ApiError`
     happen on every call instead of on the ones someone remembered.
5. **TypeScript strict**, in `tsconfig.base.json`: `strict`, plus
   `noUncheckedIndexedAccess` — which makes `items[0]` a `T | undefined` and is what
   stops a silent `undefined` entering a money path.
6. **Lint enforces the engineering rules**, in both services: `any` is an error, the
   non-null `!` is an error, `.toFixed()` is banned in money paths, and the frontend
   is forbidden from importing `mongodb` or `razorpay` — so the split cannot be undone
   by accident.
7. **Accounts provisioned.** MongoDB Atlas cluster + IP allowlist; Supabase project
   (auth + a `menu-images` storage bucket); Razorpay **test mode** keys; Sentry
   project; PostHog project; VAPID keypair via `npx web-push generate-vapid-keys`.
8. **Observability wired.** Sentry in the backend boot and on all three Next runtimes;
   PostHog in the browser. Both with `sendDefaultPii: false` and session replay off —
   order payloads carry a student's name, phone, and gate code.
9. **Repo hygiene.** Vitest in `shared` and `backend`, a `verify` script
   (typecheck + lint + test across all packages), and CI running it on every push.

### Exit gate

`npm run dev` starts both services · `/health/ready` returns a Mongo latency ·
the frontend server-renders a page whose data came from the backend over HTTP ·
`npm run verify` is clean · deleting a secret crashes the **backend** at boot with
every missing key listed at once · CORS refuses an origin that is not on the
allowlist · no backend secret exists anywhere under `frontend/`.

### Do not

Do not skip the env schemas because "it is just three variables right now". A missing
`RAZORPAY_WEBHOOK_SECRET` found at 1 AM during a payment surge is not the moment to
learn it was never set.

Do not give the frontend a MongoDB connection "just for one read". That is the split
being undone, and it will be undone one convenient exception at a time.

---

# PHASE 1 — Type Contracts & Design System

**Goal.** Freeze the vocabulary — types, enums, money helpers, fixtures, and UI
primitives — so that three UI phases can be built in parallel without diverging.

**Depends on.** P0.

### Build

1. **`shared/src/types/`.** Transcribe `IOrder`, `ICampus`, `IRestaurant`, `IMenuItem`,
   `IUser`, `IDispute`, `ILedgerEntry`, `ISettlement` from
   [SYSTEM_ARCHITECTURE_AND_FLOWS.md §7](SYSTEM_ARCHITECTURE_AND_FLOWS.md#7-data-model-mongodb-collections)
   verbatim. Every money field ends in `Paise` and is typed `number` (integer paise).
   Every enum is a `SCREAMING_SNAKE` string-literal union.
2. **`shared/src/constants.ts`.** `OrderStatus` union covering all 18 states in the FSM,
   the status display order for the stepper, terminal-state list, role list, and
   every timer from [DECISIONS.md §4](DECISIONS.md#4-open-assumptions-defaults-chosen-flip-these-in-admin-config)
   (`vendorAckSeconds` 180/240, `gateGraceSeconds` 900, curfew buffer 10 min).
3. **`shared/src/money.ts`.** `ceilToRupee`, `formatINR`, `paiseToRupees`, and a
   `Paise` branded type. In `shared` because the backend computes with it and the
   frontend formats with it, and they must round identically. **`toFixed` must not appear in this file or any money path.**
   Unit-test it now — it is the smallest file with the highest blast radius.
4. **`shared/src/fixtures/`.** Hand-written, fully typed fixtures: one campus (NIT Patna
   with 5 zones incl. a 21:30 girls' hostel, a 22:00 boys' hostel and a 24×7 main
   gate), three restaurants (one open, one closed, one with 86-ed items), a full menu
   with add-on groups, and **one order document per FSM state**. The last of these is
   what makes UI phases possible: every screen has a real state to render.
   Fixture money values are hand-computed from
   [MONEY_AND_SETTLEMENT.md §3–4](MONEY_AND_SETTLEMENT.md#3-worked-example-a--100-online-upi--card)
   so Phase 8 can assert against them.
5. **Design tokens.** Tailwind theme: brand colours, a veg-green / non-veg-red pair,
   status-stepper colours, and a **44×44 px minimum touch target** utility. Dark
   surfaces matter: the gate screen is read outdoors at 1 AM.
6. **shadcn primitives** installed unmodified into `components/ui/`.
7. **`frontend/src/components/shared/`.** `MoneyDisplay` (takes paise, never a float),
   `StatusStepper`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `VegMark`.
   Build the empty/error/loading trio **now**, so no later phase can "add them later".
8. **Copy rules encoded.** A lint rule or a code-review checklist item banning the
   strings "track", "live tracking", and "rider location" from user-facing copy.
   The product says **"Live Order Status"**, never "Live Rider Tracking"
   ([DECISIONS.md §2](DECISIONS.md#2-the-consequence-nobody-has-said-out-loud-yet)).

### Exit gate

A Storybook-style `/dev/kitchen-sink` route renders every shared primitive and every
fixture order state · `money.test.ts` passes including ceil-to-rupee edge cases ·
no fixture contains a fractional rupee.

### Do not

Do not let a fixture invent a field the data model does not have. The fixture *is* the
contract; a field invented here becomes a schema change in Phase 5.

---

# PHASE 2 — Student PWA Frontend (fixtures only)

**Goal.** The entire student journey, clickable end to end, with no database and no
payment — so the flow can be walked on a real phone before a rupee of backend exists.

**Depends on.** P1.

Build the screens in this order. Each step is independently viewable.

### 2.1 Shell & navigation
`frontend/src/app/(student)/layout.tsx` — bottom nav, cart badge, and the **sticky delivery-point
header**. Mobile-first at 360 px.

### 2.2 Campus selector
Landing page, campus list, choice persisted to `localStorage` and honoured on return
visits. No login.

### 2.3 Delivery-point picker — *before browsing, not at checkout*
The structural difference from every mainstream food app
([Flow A step 2](SYSTEM_ARCHITECTURE_AND_FLOWS.md#4-flow-a--student-places-an-order)).
The chosen zone filters the restaurant list, because vendors declare which zones they
serve. Build it as a bottom sheet off the sticky header, reachable from anywhere.

### 2.4 Restaurant list
Open restaurants first, closed ones **greyed at the bottom, not hidden**. Card shows
name, cuisine, prep time, minimum order, veg/non-veg marks. Filtered by the selected
zone. Search.

### 2.5 Menu
Categories, item cards, veg/non-veg indicators, add-on groups with min/max selection
rules enforced in the UI. **Unavailable items are struck through, never hidden** — the
student should see the item exists and is out today.

### 2.6 Cart
`frontend/src/hooks/use-cart.ts` — `localStorage`, storing **item IDs and quantities
only, never prices**. One restaurant per cart, enforced hard, with a "Clear cart and start over?"
prompt on a cross-restaurant add.

### 2.7 Checkout (visual)
Curfew-guard banner, payment-method chooser (Pay Online / Hybrid COD), price breakdown
rendered from a fixture `pricing` object. COD hidden entirely when
`user.codBlocked === true` — build that branch now, do not bolt it on.

### 2.8 Order tracker
Status stepper, ETA countdown, restaurant phone-call button. **No map. No moving dot.**
Render it against each fixture order state in turn.

### 2.9 The Gate Screen — the highest-stakes screen in the product
At `AT_GATE`: the expected 4-digit code in **very large, very high-contrast type**,
the exact cash amount for COD, the grace countdown, and a large **Confirm Received**
button. Design constraint: legible at 1 AM, outdoors, at arm's length, on a cracked
screen, by a student who is walking.

### 2.10 History, reorder, dispute entry
Order history list, one-tap reorder, and the 30-minute dispute window with a
**mandatory** photo upload control (upload wired in P7, control built now).

### 2.11 Account
Profile, phone number, saved campus, push-permission state banner.

### Exit gate

A person can walk the entire journey on a real Android phone at 360 px — campus →
zone → restaurant → menu → cart → checkout → every tracker state → gate screen →
confirm → history — with zero backend. Loading, empty, and error states exist on every
screen. The gate code is readable at arm's length in a dark room.

### Do not

Do not compute any total in a component. Do not add a map "just as a placeholder".
Do not hide unavailable items.

---

# PHASE 3 — Vendor Console Frontend (fixtures only)

**Goal.** The live board and its alarm behaviour, provable before any order can
actually arrive.

**Depends on.** P1. *(Parallel with P2.)*

### 3.1 Shell
`frontend/src/app/(vendor)/layout.tsx` — role-gated shell, tablet-first, audio-alarm provider mounted
at the layout so it survives navigation.

### 3.2 The order board
Four columns: **New → Preparing → Ready → Out for delivery**. Cards driven by fixture
orders. This is the screen the business runs on; give it the most design attention.

### 3.3 The three-way new-order defence
[Flow B](SYSTEM_ARCHITECTURE_AND_FLOWS.md#5-flow-b--vendor-fulfils-an-order) demands
all three, because a missed order is lost revenue and a broken promise:
- `frontend/src/hooks/use-order-alarm.ts` — looping audio that stops **only on interaction**,
  escalating in volume at 1:30.
- A red full-card flash plus a **3:00 countdown ring**, turning amber at 3:00 with
  "auto-cancel in 60s".
- A browser Notification even when the tab is backgrounded.

### 3.4 Accept / Reject
Accept with a prep-time picker (15 / 20 / 30 / custom, clamped 5–60 min). Reject with
a mandatory reason from a fixed list.

### 3.5 KOT print view
`frontend/src/app/(vendor)/vendor/orders/[orderId]/kot/page.tsx` — a print stylesheet for **58 mm and 80 mm** thermal
paper, including the delivery zone name and its handover instructions. Verify against
a real printer, or at minimum a print-preview at those exact widths.

### 3.6 Mark Ready → gate-code reveal
Reveals the 4-digit code in huge type for staff to write on the packet. The student
must **not** be able to see this code yet — that separation is the anti-fraud property
of D4, so build the reveal as a vendor-only surface from the first commit.

### 3.7 Dispatch → At Gate
Two taps: **Rider dispatched**, then **Rider at gate**. The second is the most
operationally critical button in the product. Size and place it accordingly — it is
pressed by a busy person with wet hands.

### 3.8 86 flow
One tap to mark an item out of stock, with the confirm dialog spelling out both
consequences: hidden from all future orders, and a substitution flow opened for every
in-flight order containing it.

### 3.9 COD actions
Cash-confirmation control, and a **Student refused payment** action behind a
confirmation.

### 3.10 Menu management
Categories, items, prices, add-on groups, availability toggles, image upload control.

### 3.11 Earnings
Daily gross, commission deducted, ledger adjustments, net payable, statement download
button.

### 3.12 Connection-lost banner
A persistent banner after two consecutive failed polls. Build the failure branch now
with a fake poll; wire the real poll in P10.

### Exit gate

On a tablet: a fixture order lands, the alarm loops until touched, the countdown ring
runs down, accept sets prep time, KOT prints correctly at 58 mm, Mark Ready reveals a
code, and the two dispatch taps advance the card — all with fixtures.

### Do not

Do not build a rider view, a rider login, or a rider assignment control. Riders have
no device ([D4](DECISIONS.md#1-locked-decisions-confirmed-by-product-owner)).

---

# PHASE 4 — Admin Console Frontend (fixtures only)

**Goal.** Every operational surface an admin needs, desktop-only, rendered from
fixtures.

**Depends on.** P1. *(Parallel with P2 and P3.)*

### Build

1. **Desktop-only shell** with a clear "not supported on mobile" state.
2. **Campus manager** — create/edit campus; **Leaflet + OSM** geofence editor using
   `leaflet-draw`; zone editor capturing type, curfew time, coordinates and handover
   instructions. Store curfews as **minutes-from-midnight integers**, per the timezone
   trap in [F11](FAILURES_AND_EDGE_CASES.md#f11--curfew).
3. **Pricing controls per campus** — delivery fee, commission %, gateway fee %,
   rounding mode, coupon funding, COD handling fee, and all timers from
   [DECISIONS.md §4](DECISIONS.md#4-open-assumptions-defaults-chosen-flip-these-in-admin-config).
4. **Vendor KYC queue** — approve/reject, commission override (floored), bank and UPI
   capture.
5. **Live radar** — every active order across every campus, with stuck-order
   highlighting (F18: no `AT_GATE` tap after 2× prep time).
6. **Dispute queue** — photo evidence, full order timeline, refund/reject with a
   **mandatory written reason**.
7. **Settlement screen** — nightly run output, per-vendor table, CSV export,
   mark-as-paid with a UTR field.
8. **Audit log viewer** — filterable, exportable, and visibly **append-only**: no edit
   control, no delete control, anywhere in the UI.
9. **Student management** — strike history, COD block toggle.

### Exit gate

An admin can draw a polygon over NIT Patna, drop five gate pins with curfew times, and
see them persist to `localStorage` · every fixture dispute, settlement row and audit
entry renders · no screen offers a way to edit or delete an audit entry.

### Do not

Do not make the audit viewer writable. Do not allow a commission override below the
campus floor in the form — validate it in the UI *and* again on the server in P7.

---

# PHASE 5 — Data Layer

**Goal.** Every collection, every index, and a seed script that reproduces the Phase 1
fixtures inside a real database.

**Depends on.** P1. *(P2–P4 may still be in flight.)*

### Build

1. **`backend/src/db/collections.ts`** — typed accessors for all 13 collections in
   [§7](SYSTEM_ARCHITECTURE_AND_FLOWS.md#7-data-model-mongodb-collections):
   `campuses`, `users`, `restaurants`, `menuCategories`, `menuItems`, `orders`,
   `coupons`, `ledgerEntries`, `settlements`, `webhookEvents`, `auditLogs`,
   `pushSubscriptions`, `disputes`.
2. **`backend/src/db/indexes.ts`** — created on boot, idempotently. The three that are not
   optional:
   - `webhookEvents.eventId` **unique** — the whole idempotency guarantee rests here.
   - `settlements.{restaurantId, settlementDate}` **unique** — this is F15.
   - `orders.{status, placedAt}` — every cron query uses it; without it the
     per-minute jobs table-scan.
   Plus `campuses.slug`, `users.authId`, `restaurants.{campusId,isOpen}`,
   `orders.orderNumber`, `orders.{customerId,createdAt}`,
   `orders.{restaurantId,status}`, `auditLogs.{orderId,at}`, `disputes.orderId`.
3. **Zod schemas** in `shared/src/api/contracts.ts`, one per write boundary, mirroring
   the types from P1 exactly — so the frontend validates a form against the same
   schema the backend validates the request with.
4. **Seed script** — inserts the P1 fixture campus, zones, restaurants and menus into
   a real Atlas database. This script is used for the rest of the build and for every
   integration test.
5. **`backend/src/services/audit.ts`** — append-only writer. Insert only. No update path,
   no delete path, not even a private one.

### Exit gate

`npm run seed` populates a clean Atlas database with NIT Patna and three restaurants ·
`db.collection.getIndexes()` shows every index above · inserting a duplicate
`webhookEvents.eventId` throws a duplicate-key error · running the seed twice is safe.

### Do not

Do not store an image binary in Mongo. The 512 MB tier is for documents; images live
in Supabase Storage and Mongo holds the URL string
([DECISIONS.md §3](DECISIONS.md#3-corrections-to-the-original-stack-plan)).

---

# PHASE 6 — Auth, Sessions & RBAC

**Goal.** Identity, behind an interface that D7's phone-OTP provider can slot into
without touching a single call site.

**Depends on.** P5.

### Build

1. **Supabase Google OAuth** + `app/auth/callback/route.ts`.
2. **`backend/src/auth/providers.ts`** — the provider interface. Google implements it now;
   phone-OTP implements the same interface later once TRAI DLT clears
   ([D7](DECISIONS.md#1-locked-decisions-confirmed-by-product-owner)). Call sites
   depend on the interface, never on Supabase directly.
3. **`backend/src/auth/session.ts`** — `getSession`, `requireRole`, `requireOwnership`,
   as Express middleware. The backend verifies the Supabase JWT itself; it never
   trusts a role the frontend claims.
4. **User mirror** — a `users` document created on first login, mirroring the Supabase
   identity with `role`, `phone`, `campusId`, `codBlocked`.
5. **First-checkout profile capture** — name + phone, stored once, reused forever.
   Browsing stays fully anonymous; auth is required **only at checkout**.
6. **`frontend/src/middleware.ts`** — route-group gating for `(vendor)` and `(admin)`.
   This is routing, so a student never *sees* the vendor console. It is not
   authorisation.
7. **The layered-authorisation rule:** frontend middleware gates the route group;
   **every backend route independently re-checks the role *and* the resource
   ownership** (`order.restaurantId === session.restaurantId`). A client-supplied
   `restaurantId` is never trusted. The split helps here: the frontend owns no
   database, so a missed check there leaks a rendering, not a record.

### Exit gate

Google sign-in works end to end · a `STUDENT` hitting `/vendor` is bounced by
middleware · a `VENDOR_STAFF` calling an admin backend route directly with curl is rejected by the
route itself, with the frontend bypassed entirely · browsing works logged out, and checkout
prompts login.

### Do not

Do not treat middleware as authorisation. It is routing. Authorisation is the check
inside the action.

---

# PHASE 7 — Campus, Vendor & Menu — wiring the consoles to real data

**Goal.** Replace fixtures with the database in the admin and vendor consoles, and
land the first real campus.

**Depends on.** P4, P5, P6. *(P3 for the vendor half.)*

### Build

1. **Campus CRUD** — create, geofence polygon persisted as GeoJSON, delivery zones
   with type, curfew minutes, coordinates and instructions.
2. **Zone-serving declaration on restaurants** — the field the student restaurant
   filter depends on.
3. **Vendor CRUD + KYC** — approval flow, bank/UPI details, commission overrides
   validated server-side against the campus floor.
4. **Menu management wired** — categories, items, add-on groups, availability, and
   **image upload to Supabase Storage** with the returned URL string stored in Mongo.
5. **`backend/src/services/curfew.ts`** — zone availability by clock. Curfews are
   minutes-from-midnight integers, always compared in the **campus timezone**, never
   in UTC and never in server-local time. A `01:00` curfew means the next day.
6. **Student browse wired** — campus list, zone-filtered restaurant list, and menu now
   come from backend routes, fetched through the api-client. Cart still
   `localStorage`, still IDs and quantities only.
7. **`curfew.test.ts`** — including midnight-crossing curfews and the case where a
   21:25 arrival is blocked by a 21:30 curfew because of the 10-minute buffer.

### Exit gate

An admin creates NIT Patna with five real gates and their real curfew times · a
canteen with a real photographed menu exists · a student on a phone picks
"Ganga Boys Hostel — Main Gate" and sees only the restaurants that serve it · at 21:25
the girls'-hostel zone is blocked at checkout with a plain-language reason and the
24×7 main gate offered instead · `curfew.test.ts` is green.

### Do not

Do not let the restaurant list ignore the selected zone. The zone filter is the
structural difference from a mainstream food app, not a nicety.

---

# PHASE 8 — The Pricing Engine ★

**Goal.** Exactly one function computes every rupee in the system, and it is proven
against both worked examples to the exact rupee.

**Depends on.** P7.

> **This is the gate phase. Do not start Phase 9 until every test here is green.**

### Build

1. **`backend/src/services/pricing.ts`** — a **pure** function. Inputs in, integer paise
   out. No database calls, no session, no side effects, no branching on user identity.
   Implements [MONEY_AND_SETTLEMENT.md §2](MONEY_AND_SETTLEMENT.md#2-the-pricing-formula)
   exactly:
   ```
   commissionBase     = subtotal + packagingFee + deliveryFee        (D6)
   platformCommission = CEIL_TO_RUPEE(commissionBase × commissionPct)
   vendorReceivable   = commissionBase − platformCommission
   payableByStudent   = commissionBase − discount                    (A1: platform-funded)
   convenienceFee     = CEIL_TO_RUPEE(onlineChargeAmount × gatewayFeePct)
   grandTotal         = payableByStudent + convenienceFee
   refundableAmount   = onlinePaidAmount − convenienceFee            (D2)
   ```
2. **Both payment shapes** produced by the same call: `ONLINE_100` charges
   `grandTotal` online; `HYBRID_COD` charges `platformCommission + convenienceFee`
   online and leaves `vendorReceivable` as cash at the gate.
3. **Coupon validator** — caps a coupon at 10% of `commissionBase` unless a
   loss-leading promo is deliberately configured.
4. **One call site each for cart preview and order creation.** Both are backend routes
   and both call this function. The frontend renders the returned numbers and computes
   nothing. If they ever diverge, a student is charged something other than what they
   were shown.
5. **`backend/tests/pricing.test.ts`** — all seven invariants from
   [MONEY_AND_SETTLEMENT.md §7](MONEY_AND_SETTLEMENT.md#7-reconciliation-invariants-assert-these-in-tests):
   ```
   1. commissionBase === subtotal + packagingFee + deliveryFee
   2. platformCommission + vendorReceivable === commissionBase
   3. grandTotal === commissionBase − discount + convenienceFee
   4. refundableAmount === onlinePaid − convenienceFee   (COD: the token alone)
   5. HYBRID_COD:  onlinePaid === platformCommission + convenienceFee
                   cashDue    === vendorReceivable
   6. ONLINE_100:  onlinePaid === grandTotal ; cashDue === 0
   7. every value is a non-negative integer
   ```
   Plus **Worked Example A** landing on ₹231 / ₹202 / ₹23 / ₹6 exactly, **Worked
   Example B** landing on ₹24 online + ₹202 cash exactly, and a **fuzz test** over
   thousands of random carts asserting invariant 2 never drifts by a paisa.
6. **Cart preview UI wired** to the real engine, replacing the P2.7 fixture breakdown.

### Exit gate

`pricing.test.ts` green including the fuzz run · both worked examples reproduce to the
rupee · `grep -rn "toFixed" backend/src frontend/src shared/src` returns nothing · the checkout
screen shows a server-computed total.

### Do not

Do not add a second place that touches money "just for the cart badge". Do not let a
float enter the chain anywhere.

---

# PHASE 9 — Payments

**Goal.** Both payment paths complete in Razorpay test mode, and money can never be
captured against an order the system does not know about.

**Depends on.** P8 **green**.

### Build

1. **`backend/src/services/payments.ts`** — Razorpay Orders, Refunds, and signature
   verification. Razorpay is never touched from the frontend; lint forbids the import.
2. **Order created as `PAYMENT_PENDING` in Mongo *before* the gateway opens.** An
   abandoned payment must leave a traceable record — this is what makes F1/F2
   recoverable.
3. **Razorpay Checkout** on the student side for both `ONLINE_100` and `HYBRID_COD`.
4. **`backend/src/routes/webhooks/razorpay.ts`** — in this exact order, and no other:
   ```
   1. verify HMAC with crypto.timingSafeEqual   -> 400 before parsing if invalid
   2. insert eventId into webhookEvents (unique) -> dup key means already done, 200
   3. verify amount === expectedOnlineAmount     -> never skip this
   4. act: promote PAYMENT_PENDING -> PLACED
   ```
   Reversing steps 1–2 means a replayed webhook double-processes an order.
5. **Idempotency key on checkout** — the client generates a UUID per attempt; the
   server upserts on it, so a double-tap returns the *same* order (F12).
6. **Server-side recompute at submit** — the client posts item IDs and quantities
   only. If the recomputed total differs from what the student was shown, checkout
   stops and the cart re-renders with the change highlighted (F13/F14).
7. **Reconciliation cron** `/cron/reconcile-payments` — the F1/F2 protocol,
   sharing **the same code path** as the webhook so whichever wins the race promotes
   the order exactly once.
8. **Refund path** — `refundableAmount` only, never `grandTotal`
   ([D2](DECISIONS.md#1-locked-decisions-confirmed-by-product-owner)).

### Exit gate

Both payment paths complete in Razorpay test mode · a replayed webhook is a no-op
returning 200 · an unsigned webhook is rejected with 400 before the body is parsed ·
a webhook with a mismatched amount is rejected and alerted · killing the browser
mid-payment leaves an order that the reconciliation cron promotes within 60 s ·
double-tapping Pay creates exactly one order.

### Do not

Do not act on a webhook before inserting its event ID. Do not trust the amount in the
payload without comparing it to `expectedOnlineAmount`.

---

# PHASE 10 — Order Lifecycle & the FSM

**Goal.** One guarded function owns `order.status`, and an order runs end to end from
tap to `DELIVERED`.

**Depends on.** P9.

### Build

1. **`backend/src/services/order-state.ts`** — the FSM. A single
   `transition(order, to, actor, reason)` that:
   - validates the transition is legal for the current state,
   - validates the **actor's right** to fire it (see the transition table in
     [§3](SYSTEM_ARCHITECTURE_AND_FLOWS.md#3-the-order-state-machine)),
   - writes the `auditLogs` entry,
   - persists — **atomically**.
   **Nothing else in the codebase may write `order.status`.** Enforce it with a lint
   rule or a review checklist item.
2. **`backend/src/services/orders.ts`** — `createOrder` writing full snapshots
   (`customerSnapshot`, `restaurantSnapshot`, `deliveryZoneSnapshot`, item lines,
   frozen `pricing`). An order must be readable in six months without any referenced
   document still existing.
3. **Order numbers** — `TRF-NITP-8921`, human-quotable at a gate.
4. **Vendor board wired live** — backend `/vendor/orders/poll`, 5 s, pausing on
   `visibilitychange`. The P3 alarm now fires on real orders.
5. **Student tracker wired live** — backend `/orders/:id/poll`, 8 s, stopping at a
   terminal state. ETA from `acceptedAt + prepMinutes + campus.transitMinutes`.
6. **Admin live radar wired** — 10 s, pausing on tab hidden.
7. **Accept/Reject, Mark Ready, Dispatch, At Gate** all routed through the FSM.
8. **KOT auto-print on accept.**
9. **`backend/tests/order-state.test.ts`** — every legal transition succeeds and every
   illegal one throws. Specifically: a student cannot confirm before `AT_GATE`; a
   vendor cannot cancel after `ACCEPTED`; only the webhook may fire
   `PAYMENT_PENDING → PLACED`.

### Exit gate

A real order runs cart → pay → vendor board → accept → KOT → ready → dispatch →
at gate → delivered · every transition has an audit row with actor, role, from, to,
reason and timestamp · `order-state.test.ts` is green · no file outside `order-state.ts`
writes `order.status`.

### Do not

Do not let a route set a status "just this once, it's simpler". That is how
the audit trail acquires holes.

---

# PHASE 11 — The Gate Handoff Protocol (D4)

**Goal.** The mechanism that replaces a rider app entirely, working on a real phone at
a real gate.

**Depends on.** P10.

### Build

1. **`backend/src/services/gate-code.ts`** — 4 digits, **server-generated**, unrelated to
   and underivable from the order number. Digits only, by design: no 0/O ambiguity for
   a code written in marker under a hostel light.
2. **Reveal rules, enforced server-side:**
   - Vendor sees the code at `READY`.
   - **The student's API response does not contain the code until `status === AT_GATE`.**
     Not hidden with CSS. Not sent-and-masked. **Absent from the payload.** This is the
     entire anti-fraud property: a student cannot pre-confirm from their room because
     until the vendor taps *Rider at gate*, the code and the confirm button do not
     exist.
3. **`AT_GATE` push** — high priority, naming the gate: "Your order is at Ganga Gate 1."
4. **Grace timer** — 15 min (`campus.settings.gateGraceSeconds`), started by the
   `AT_GATE` transition, with a second push at t=5 min and a vendor-phone-the-student
   prompt at t=10 min.
5. **Student confirm** — `AT_GATE → DELIVERED`, fired by the **student**, showing the
   COD cash amount alongside.
6. **Vendor COD fallback** — vendor confirms the rider returned with correct cash.
7. **Gate re-route (F11 layer 2)** — vendor taps *Gate closed*, the order redirects to
   the campus fallback 24×7 zone, the student is re-pushed, and **the grace timer
   restarts from zero**.

### Exit gate

The full [§6 handoff](SYSTEM_ARCHITECTURE_AND_FLOWS.md#6-flow-c--the-gate-handoff-protocol-d4)
is walked on a real phone at a real gate at night · inspecting the network response
before `AT_GATE` shows **no** `gateCode` field · the code is readable at arm's length ·
the re-route pushes a new gate and restarts the timer.

### Do not

Do not send the code early and hide it in the client. Do not build a rider-facing
confirm.

---

# PHASE 12 — Failure Handling & the Cron Fleet

**Goal.** Every automatic case in
[FAILURES_AND_EDGE_CASES.md §2](FAILURES_AND_EDGE_CASES.md#2-automatic-failures--detailed-protocols)
handled, each with a passing test.

**Depends on.** P11.

### Build — one item per F-case

| Case | Work |
| :-- | :-- |
| **F1/F2** | Reconciliation cron (landed in P9) — verify the amount check and the shared code path. |
| **F3** | Webhook arriving on an `EXPIRED_NO_ACK` / `PAYMENT_FAILED` order: **never** promote — refund immediately and notify. Money must never sit captured against a dead order. |
| **F4** | `/cron/expire-unacked` — the 0:00 / 1:30 / 3:00 / 4:00 escalation, auto-refund, and **three expiries in one day auto-flips `isOpen = false`** with an admin alert. |
| **F5** | Vendor reject → `REJECTED_BY_VENDOR` + full auto-refund. |
| **F6** | 86-after-acceptance: push + blocking three-choice screen (swap / drop line / cancel) with a **5-minute timer defaulting to "remove it, deliver rest"**. Cheaper substitute refunds the difference; **a pricier one is absorbed by the vendor — never charge twice.** |
| **F7** | Prepaid no-show → `DELIVERED_TO_SECURITY` after grace, guard-handoff push. No refund. |
| **F8** | COD no-show → `NO_SHOW`, token forfeited to the vendor, strike recorded, **2 strikes → `codBlocked`**. |
| **F9** | *Student refused payment* → `NO_SHOW` + **`codBlocked = true` immediately** (deliberate, not accidental — not two strikes). Never a permanent ban. |
| **F10** | Took the food, never tapped → auto-close as `DELIVERED` at grace expiry. |
| **F11** | Both curfew layers (P7 guard + P11 re-route) verified together. |
| **F12/F13/F14** | Idempotency key and server recompute (landed in P9) — test explicitly. |
| **F16** | `/cron/retry-refunds` — 3 retries with backoff, then an admin alert and a manual-refund queue entry. |
| **F17** | Push blocked or undelivered → persistent in-app banner when permission is not granted, plus the vendor phoning the student. **Push is never the only channel for `AT_GATE`.** |
| **F18** | No `AT_GATE` tap after 2× prep time → nag banner on the vendor board + admin radar flag. |

**Cron infrastructure.** All routes under `backend/src/routes/cron/` gated by a
`CRON_SECRET` header — a shared secret, not obscurity. Schedules are listed in
[PROJECT_STRUCTURE.md §6](PROJECT_STRUCTURE.md#6-scheduled-jobs). What *fires* them is
a deployment decision, not a code decision; whatever does, every campus-local
comparison must go through the campus timezone and never the server clock. If your
scheduler limits frequency, merge the three per-minute jobs into one `/cron/tick`.

**Dispute flow.** `backend/src/services/disputes.ts` — 30-minute window, **mandatory** photo
to Supabase Storage, admin queue with the full order timeline, ruling audit-logged with
the admin identity and a written reason.

### Exit gate

Every F-case above has a passing test · an unauthenticated call to any `/cron/*`
route returns 401 · a refund forced to fail three times lands in the admin queue with
the Razorpay error payload attached · three simulated expiries close the restaurant.

### Do not

Do not build anything in
[§4 Outliers](FAILURES_AND_EDGE_CASES.md#4-outliers-we-deliberately-do-not-build-for).
Stock is a boolean, not a count. Partial COD cash is not modelled. Rider theft is the
vendor's HR problem, handled by dispute + ledger debit.

---

# PHASE 13 — Settlement & Ledger

**Goal.** A day of mixed orders settles to the rupee, twice, with the same result.

**Depends on.** P12.

### Build

1. **`backend/src/services/ledger.ts`** — append-only adjustments. The one that must exist
   from day one is `REFUND_GATEWAY_RECOVERY`: on every vendor-fault refund, Razorpay
   keeps its fee, and that loss is booked as a **negative entry against the vendor**
   ([D3](DECISIONS.md#1-locked-decisions-confirmed-by-product-owner)). This is the
   incentive that makes free rejection cost something.
2. **`backend/src/services/settlement.ts`** — the nightly run:
   ```
   grossPrepaid = SUM(vendorReceivable) WHERE method = ONLINE_100 AND status = DELIVERED
   adjustments  = SUM(ledgerEntries)                    -- negative
   netPayout    = grossPrepaid + adjustments
   COD orders contribute ₹0 — already settled at the gate.
   ```
3. **The four settlement rules:** only `DELIVERED` settles (in-flight rolls forward);
   a negative net **carries forward as an opening debit, never clawed back**; payouts
   under ₹100 roll forward; each run writes an **immutable** `settlements` document
   and the payout is generated *from* that document, never recomputed.
4. **Idempotency** — enforced by the unique `(restaurantId, settlementDate)` index
   from P5. A second run for the same day is a no-op (F15).
5. **`/cron/settle-daily`** at 23:59 campus-local.
6. **Vendor statement** — earnings screen wired: gross, commission, adjustments with
   their notes, net payable, downloadable.
7. **Admin settlement screen wired** — per-vendor CSV export, mark-as-paid with UTR.
8. **Nightly invariant assertion** — re-check all seven §7 invariants across every
   order created that day and alert on any violation. **Silent rupee drift is how
   platforms lose money invisibly.**
9. **`backend/tests/settlement.test.ts`** — running twice changes nothing; negative
   payouts carry forward; COD orders contribute exactly ₹0; sub-₹100 rolls forward.

### Exit gate

A seeded day of mixed prepaid, COD, rejected and refunded orders settles to the exact
rupee · running the cron twice produces byte-identical settlement documents · a vendor
with a rejection sees the gateway-recovery debit on their statement with its note ·
CSV export opens cleanly in a spreadsheet.

### Do not

Do not build RazorpayX payouts. At 10–20 vendors a five-minute nightly CSV is genuinely
faster than the integration. Automate at 50+.

---

# PHASE 14 — PWA, Push & Observability

**Goal.** Installable on Android, push working, and the funnel measurable.

**Depends on.** P13.

### Build

1. **`manifest.json`** — standalone, portrait, brand theme colour, maskable 192/512
   icons.
2. **Service worker** — caches the app shell, menu images, and campus/restaurant
   lists. **Never caches order state.** Order reads are always network-first. A stale
   "Cooking" screen while the rider waits at the gate is worse than a spinner.
3. **Offline fallback page** — "You are offline — your placed orders are safe."
4. **Web Push (VAPID)** — `backend/src/services/notifications.ts`, `pushSubscriptions` per
   device, fan-out on order accepted, at gate, and cancelled.
5. **The iOS caveat** — Web Push works on iOS 16.4+ **only after the PWA is added to
   the home screen**. The install prompt is therefore a feature, not a nicety.
6. **Install prompt deferred until after the first delivered order**, when intent is
   highest.
7. **PostHog funnels** — land → zone picked → restaurant opened → cart → checkout →
   paid → delivered, plus vendor accept latency and gate-confirm latency.
8. **Sentry** — source maps, release tagging, alerts on webhook failures, refund
   failures and cron failures.

### Exit gate

Lighthouse PWA audit passes · the app installs on a real Android phone and launches
standalone · an `AT_GATE` push arrives on a locked phone · going offline shows the
fallback, and coming back online shows **fresh** order state, never cached · the
PostHog funnel shows a complete real order.

### Do not

Do not cache anything under the api-client's order reads — it sets `cache: "no-store"` for exactly this reason. Do not rely on push as the only channel
for `AT_GATE` (F17).

---

# PHASE 15 — Hardening & Launch Readiness

**Goal.** Everything that must be true before real students and real money.

**Depends on.** P14.

### Build

1. **Security sweep** against
   [§10](SYSTEM_ARCHITECTURE_AND_FLOWS.md#10-security-requirements):
   - Every webhook signature-verified with `crypto.timingSafeEqual`.
   - Every webhook idempotent via the `webhookEvents` unique index, inserted *before*
     acting.
   - No client-sent price anywhere.
   - Gate codes server-generated and released only at `AT_GATE`.
   - **Rate limits:** order creation 5/min/user, coupon validation 10/min/user, login
     10/hour/IP.
   - Every financial action audit-logged: price edits, commission overrides, manual
     cancellations, dispute rulings, settlement runs.
   - Cron routes secret-gated.
   - Grep the built frontend for every backend secret name and confirm zero hits.
     The split makes this cheap to guarantee: the secrets are not in that package at
     all.
2. **Full integration test** — `backend/tests/integration/order-lifecycle.test.ts`, cart to
   `DELIVERED` for both payment methods against a real test database.
3. **Load sanity** — simulate an exam-week spike and watch Atlas connection counts.
   The free-tier ceiling is real; the cached global client with `maxPoolSize: 10` is
   what keeps it survivable, and connections are the **first thing to upgrade** when
   volume grows.
4. **Real-device pass** — every student screen on a real phone at 360 px, not a
   resized desktop browser. The gate screen tested outdoors, at night.
5. **Vendor onboarding kit** — the runbook from
   [§5](FAILURES_AND_EDGE_CASES.md#5-operational-runbook--things-that-will-actually-happen-in-week-1):
   wall charger mandated, screen sleep disabled, large legible gate-code digits, and
   the two release valves taught on day one — **raise prep time** or **toggle
   `isOpen = false`** — because those are what prevent a cascade of F4 expiries during
   a surge.
6. **Close the open items** from
   [PRD Part 8](MASTER_PROMPT_PRD.md#part-8--open-items-to-confirm-before-launch) —
   each blocks go-live, none blocks the build:
   - Verify the **real Razorpay fee** on your plan and set `gatewayFeePct`. The 2.36%
     default is an assumption, and it is the number students see.
   - Confirm **food GST per vendor** (0% default is correct only below the ₹20 L
     threshold).
   - Set the real **delivery fee and transit minutes** for NIT Patna.
   - **Walk the campus** and capture the actual gates, curfew times and coordinates.
     This data *is* the product.
   - Decide **coupon funding** (defaulted to platform).
   - **TRAI DLT registration** — start it in parallel with the build so phone OTP is
     ready when you want it (D7).
7. **Go-live switch** — Razorpay live keys, production Atlas tier decision, real
   webhook URL registered, Sentry alert routing to a phone that someone answers.

### Exit gate

Security checklist fully ticked · integration tests green for both payment methods ·
one real order placed by a real student at a real gate with real money, start to
finish · vendors trained · every PRD Part 8 item answered with a number, not a default.

### Do not

Do not go live with test-mode Razorpay keys still in any environment. Do not launch a
second campus in the same week as the first — the multi-tenant design means a second
campus is a database row, and it should stay that way until NIT Patna is boring.

---

## 16. Standing rules that apply to every phase

These are not phase work. They are true from Phase 0 to Phase 15, and a violation is a
defect regardless of which phase introduced it.

1. All money is **integer paise**. Format to rupees only at render.
2. The **server recomputes every price**. A client-supplied price is a security bug.
3. **Exactly one pricing function**, in `backend/src/services/pricing.ts`. Cart preview
   and order creation call the same one. The frontend computes no money.
4. Orders store **snapshots**, not references.
5. Every webhook is **signature-verified and idempotent**, in that order.
6. Every state transition writes an **append-only audit entry**.
7. **One guarded FSM function** owns `order.status`.
8. Cron routes are **secret-gated**.
9. Every backend route re-checks **role AND ownership**. Frontend middleware is routing.
10. **Never cache order state** in the service worker.
11. Gate codes are **server-generated** and released only at `AT_GATE`.
12. **The COD invariant is sacred:** `codOnlineToken === platformCommission` and
    `cashDueOnDelivery === vendorReceivable`. Any change that breaks it is rejected.
13. **The frontend never reaches past the backend.** No MongoDB driver, no Razorpay
    SDK, no secret. If the UI needs data, there is a route for it.

And the twelve things in
[PRD Part 7](MASTER_PROMPT_PRD.md#part-7--what-not-to-build) are never built in any
phase. Building one of them is a defect, not initiative — above all a rider app, a
rider login, a rider GPS, or a moving dot on a map.
