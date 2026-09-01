# TREFOOD — Project Structure & Conventions

> The shape of the repository, what belongs in each package, and the rules that keep
> business logic out of the UI. Governed by [DECISIONS.md](DECISIONS.md).
>
> **Updated for the frontend/backend split.** TREFOOD is an npm-workspaces monorepo
> with three packages and two independently runnable services.

---

## 1. The Two Rules That Shape Everything

**Rule 1 — Business logic lives in `backend/src/services/`. Nothing else contains a rule.**

Routes and components are *adapters* — they authenticate, parse, call a service, and
render. A service function must be callable from a unit test with no HTTP, no session,
and no React.

The reason is concrete: the cart preview screen and the order-creation path must
compute an identical price. If pricing logic lives in a component, they will drift,
and a student will be charged something other than what they were shown.

**Rule 2 — The frontend never reaches past the backend.**

No MongoDB driver, no Razorpay SDK, no secret. If the UI needs data, there is a route
for it, and it is called through `frontend/src/api-client`. This is enforced by lint
(`no-restricted-imports` on `mongodb` and `razorpay`), not by discipline.

---

## 2. Directory Tree

```
trefood/
├── package.json                         # npm workspaces root
├── tsconfig.base.json                   # strictness shared by all three packages
│
├── docs/                                # these planning documents
│
├── shared/                              # ══ @trefood/shared ══
│   │                                    # imported by BOTH services.
│   │                                    # no db, no session, no React, no DOM.
│   ├── src/
│   │   ├── index.ts                     #   the public surface
│   │   ├── env-error.ts                 #   readable env failures, used by both
│   │   ├── env-optional.ts              #   blank .env value means "not set"
│   │   ├── money.ts                     # ★ paise arithmetic, ceilToRupee, formatINR
│   │   ├── constants.ts                 #   OrderStatus, roles, timers
│   │   ├── types/                       #   order, campus, restaurant, user
│   │   └── api/contracts.ts             #   request/response Zod schemas
│   └── tests/
│
├── backend/                             # ══ @trefood/backend ══  (Express, :4000)
│   │                                    # owns MongoDB and every business rule.
│   ├── src/
│   │   ├── index.ts                     #   boot: env → Sentry → Mongo → listen
│   │   ├── app.ts                       #   Express app factory (testable, no port)
│   │   ├── env.ts                       # ★ every secret in the system
│   │   ├── db/
│   │   │   ├── client.ts                #   Mongo pool, maxPoolSize 10
│   │   │   ├── collections.ts           #   typed collection accessors
│   │   │   └── indexes.ts               #   every index, created on boot
│   │   ├── auth/
│   │   │   ├── session.ts               #   requireRole, requireOwnership
│   │   │   └── providers.ts             #   Google now; OTP slots in later (D7)
│   │   ├── services/                    # ══ ALL BUSINESS RULES ══
│   │   │   ├── pricing.ts               # ★ THE ONLY PLACE MONEY IS COMPUTED
│   │   │   ├── orders.ts                #   createOrder, guarded transitions
│   │   │   ├── order-state.ts           # ★ the FSM: legal transitions + guards
│   │   │   ├── payments.ts              #   Razorpay orders, verify, refund
│   │   │   ├── settlement.ts            #   nightly run, idempotent
│   │   │   ├── ledger.ts                #   append-only adjustments
│   │   │   ├── curfew.ts                #   zone availability by clock
│   │   │   ├── gate-code.ts             #   generate, reveal, verify
│   │   │   ├── notifications.ts         #   web push fan-out
│   │   │   ├── disputes.ts
│   │   │   └── audit.ts                 #   append-only, never updates
│   │   ├── routes/                      # thin adapters over services
│   │   │   ├── health.ts                #   /health, /health/ready
│   │   │   ├── campuses.ts  restaurants.ts  orders.ts  vendor.ts  admin.ts
│   │   │   ├── webhooks/razorpay.ts     #   signature + idempotency
│   │   │   └── cron/                    #   CRON_SECRET header required
│   │   │       ├── reconcile-payments.ts    # F1/F2, every minute
│   │   │       ├── expire-unacked.ts        # F4, every minute
│   │   │       ├── close-stale-gates.ts     # F7/F10, every minute
│   │   │       ├── retry-refunds.ts         # F16, every 15 min
│   │   │       └── settle-daily.ts          # 23:59 campus time
│   │   └── middleware/
│   │       ├── error-handler.ts         #   one error boundary, 400 vs 500
│   │       ├── require-role.ts
│   │       └── rate-limit.ts
│   ├── tests/
│   │   ├── app.test.ts                  #   mounts createApp() with no port, no DB
│   │   ├── pricing.test.ts              # ★ the 7 invariants
│   │   ├── order-state.test.ts          # ★ every legal + illegal transition
│   │   ├── settlement.test.ts           #   idempotency, negative carry-forward
│   │   ├── curfew.test.ts               #   incl. curfews crossing midnight
│   │   └── integration/order-lifecycle.test.ts
│   └── .env.example                     # ★ every secret lives here, nowhere else
│
└── frontend/                            # ══ @trefood/frontend ══  (Next.js, :3000)
    │                                    # UI only. no rules, no database.
    ├── public/
    │   ├── manifest.json                #   PWA manifest
    │   ├── sw.js                        #   service worker (never caches order state)
    │   ├── sounds/new-order.mp3         #   the vendor alarm
    │   └── icons/                       #   maskable PWA icons, 192 / 512
    ├── src/
    │   ├── api-client/                  # ★ the ONLY way to reach the backend
    │   │   └── index.ts                 #   credentials, no-store, ApiError
    │   ├── app/
    │   │   ├── layout.tsx               #   fonts, providers, Sentry, PostHog
    │   │   ├── page.tsx                 #   campus picker / redirect
    │   │   │
    │   │   ├── (student)/               # ── STUDENT PWA ──────────────────
    │   │   │   ├── layout.tsx           #   bottom nav, zone header, cart badge
    │   │   │   ├── c/[campusSlug]/
    │   │   │   │   ├── page.tsx         #   restaurant list, filtered by zone
    │   │   │   │   └── r/[restaurantSlug]/page.tsx
    │   │   │   ├── cart/page.tsx
    │   │   │   ├── checkout/page.tsx    #   curfew guard + payment choice
    │   │   │   ├── orders/
    │   │   │   │   ├── page.tsx         #   history
    │   │   │   │   └── [orderId]/page.tsx   # tracker + GATE SCREEN
    │   │   │   └── account/page.tsx
    │   │   │
    │   │   ├── (vendor)/vendor/         # ── VENDOR CONSOLE ───────────────
    │   │   │   ├── layout.tsx           #   role gate + audio alarm provider
    │   │   │   ├── orders/page.tsx      #   THE live board
    │   │   │   ├── orders/[orderId]/kot/page.tsx   # thermal print view
    │   │   │   ├── menu/page.tsx        #   items, 86 toggles, add-ons
    │   │   │   ├── earnings/page.tsx
    │   │   │   └── settings/page.tsx    #   hours, prep time, fees, zones served
    │   │   │
    │   │   ├── (admin)/admin/           # ── ADMIN CONSOLE ────────────────
    │   │   │   ├── layout.tsx           #   desktop-only shell
    │   │   │   ├── campuses/[id]/zones/page.tsx    # Leaflet geofence editor
    │   │   │   ├── vendors/page.tsx     #   KYC queue
    │   │   │   ├── orders/page.tsx      #   live radar
    │   │   │   ├── disputes/page.tsx
    │   │   │   ├── settlements/page.tsx #   nightly runs + CSV
    │   │   │   ├── students/page.tsx    #   strikes, COD blocks
    │   │   │   └── audit/page.tsx
    │   │   │
    │   │   └── auth/callback/route.ts   #   Supabase OAuth callback
    │   │
    │   ├── components/
    │   │   ├── ui/                      #   shadcn primitives, unmodified
    │   │   ├── student/                 #   RestaurantCard, GateCodeDisplay, ...
    │   │   ├── vendor/                  #   OrderBoardCard, PrepTimePicker, ...
    │   │   ├── admin/                   #   ZoneMapEditor, SettlementTable, ...
    │   │   └── shared/                  #   StatusStepper, MoneyDisplay, EmptyState
    │   │
    │   ├── lib/
    │   │   ├── env.ts                   #   NEXT_PUBLIC_* only — no secrets
    │   │   ├── supabase/                #   browser + server clients
    │   │   └── utils.ts
    │   │
    │   ├── hooks/
    │   │   ├── use-poll.ts              #   visibility-aware interval polling
    │   │   ├── use-order-alarm.ts       #   looping audio until interaction
    │   │   └── use-cart.ts              #   localStorage cart, IDs + qty only
    │   │
    │   └── middleware.ts                #   route-group role gating
    └── .env.local.example               #   every value here ships to the browser
```

---

## 3. The Files That Deserve Extra Care

| File | Why it is load-bearing |
| :-- | :-- |
| `backend/services/pricing.ts` | Every rupee in the system originates here. Pure function: inputs in, integers out. No DB calls, no session, no side effects — so it is trivially testable and impossible to accidentally branch on user identity. |
| `backend/services/order-state.ts` | The FSM. Exposes one `transition(order, to, actor, reason)` that validates legality, checks the actor's right to fire it, writes the audit entry, and persists — atomically. Nothing else may write `order.status`. |
| `backend/src/env.ts` | Every secret in TREFOOD. Validates eagerly and throws, and `index.ts` imports it before binding a port — so a missing secret kills the process at boot with every problem listed at once. |
| `backend/src/app.ts` | Captures the **raw request body** for webhook HMAC verification. Re-serialising a parsed object changes key order and whitespace, the signature stops matching, and the bug looks like a Razorpay outage. |
| `backend/db/client.ts` | `maxPoolSize: 10` is the Atlas free-tier ceiling, not a tuning knob. Connection count is now a function of how many backend instances you run. |
| `backend/routes/webhooks/razorpay.ts` | Verify signature → insert event ID (unique index) → act. In that order. Reversing it means a replayed webhook double-processes an order. |
| `shared/money.ts` | Paise-only arithmetic. If `Number.prototype.toFixed` appears anywhere in a money path, that is a bug — and a lint error. |
| `frontend/api-client/index.ts` | The only path to the backend. Owns `credentials: "include"`, `cache: "no-store"`, and turning a non-2xx into a thrown `ApiError` so no caller can render an error body as data. |

---

## 4. Naming & Style Conventions

- Files `kebab-case.ts`; React components `PascalCase.tsx`; hooks `use-thing.ts`.
- **Money fields always end in `Paise`.** `subtotalPaise`, never `subtotal`. The suffix
  is the type system for units — it makes a float bug visible at the call site.
- Booleans read as assertions: `isOpen`, `isAvailable`, `codBlocked`.
- Enums are `SCREAMING_SNAKE` string literals, never numbers, so a database dump is readable.
- Snapshot fields end in `Snapshot` (see the order document).
- Backend and shared are ESM with `NodeNext` resolution: **relative imports carry a
  `.js` extension** (`import { x } from "./env.js"`) even though the source is `.ts`.

---

## 5. Environment Variables

The split gives each service its own file, and the division is the point: **every
secret is in `backend/.env`, and `frontend/.env.local` holds nothing worth stealing.**

### `backend/.env` — copy from `backend/.env.example`

```bash
NODE_ENV=development
PORT=4000
CORS_ORIGINS=http://localhost:3000   # real access control, not boilerplate

MONGODB_URI=
MONGODB_DB=trefood

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:ops@trefood.in

CRON_SECRET=                         # openssl rand -hex 32, min 32 chars

SENTRY_DSN=                          # optional
```

### `frontend/.env.local` — copy from `frontend/.env.local.example`

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000   # the seam between the services
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # public half only
NEXT_PUBLIC_VAPID_PUBLIC_KEY=        # public half only

NEXT_PUBLIC_SENTRY_DSN=              # optional
NEXT_PUBLIC_POSTHOG_KEY=             # optional
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

Both are validated with Zod at import time and fail loudly, listing every problem at
once. A blank line for an optional key means "not set" — see `shared/env-optional.ts`.

> **`NEXT_PUBLIC_*` values are inlined at build time, not read at runtime.** Changing
> `NEXT_PUBLIC_API_URL` means rebuilding the frontend, not restarting it.

---

## 6. Scheduled Jobs

The cron routes live in `backend/src/routes/cron/`, gated by a `CRON_SECRET` header —
a shared secret, not obscurity.

| Route | Schedule | Purpose |
| :-- | :-- | :-- |
| `/cron/reconcile-payments` | every minute | F1/F2 — the webhook that never came |
| `/cron/expire-unacked` | every minute | F4 — vendor never acknowledged |
| `/cron/close-stale-gates` | every minute | F7/F10 — grace timer expiry |
| `/cron/retry-refunds` | every 15 min | F16 — refund API failures |
| `/cron/settle-daily` | 23:59 campus-local | the nightly settlement run |

**What triggers them is a deployment decision, not a code decision** — a host
scheduler, a system crontab hitting the URLs, or an in-process scheduler. Whatever
fires them, every campus-local comparison in code must go through the campus timezone,
never the server clock.

> The three per-minute jobs are all fast indexed queries. If your scheduler limits
> frequency, merge them into one `/cron/tick` route that runs all three in sequence;
> batching them costs nothing.

---

## 7. Testing Priorities

Test in this order. The first two are non-negotiable before touching Razorpay.

1. **`pricing.test.ts`** — both worked examples from
   [MONEY_AND_SETTLEMENT.md](MONEY_AND_SETTLEMENT.md) to the exact rupee, plus all
   seven invariants, plus fuzzing random carts to assert
   `commission + vendorReceivable === commissionBase` never drifts.
2. **`order-state.test.ts`** — every legal transition succeeds; every illegal one
   throws. Especially: a student cannot confirm before `AT_GATE`, and a vendor cannot
   cancel after `ACCEPTED`.
3. **`settlement.test.ts`** — running twice for the same day changes nothing; negative
   payouts carry forward; COD orders contribute exactly ₹0.
4. **`curfew.test.ts`** — a 01:00 curfew means next day; a 21:30 curfew blocks a 21:25
   arrival because of the 10-minute buffer.
5. **`order-lifecycle.test.ts`** — full path from cart to `DELIVERED` for both payment
   methods, against a real test database.

---

## 8. Getting Started

```bash
npm install

cp backend/.env.example        backend/.env          # then fill it in
cp frontend/.env.local.example frontend/.env.local   # then fill it in

npm run dev            # builds shared, then runs both services
```

| Command | Does |
| :-- | :-- |
| `npm run dev` | Backend on :4000 and frontend on :3000, together |
| `npm run dev:backend` / `npm run dev:frontend` | One at a time |
| `npm run verify` | typecheck + lint + test across all three packages. What CI runs. |
| `npm run build` | Builds all three in dependency order |

Check it is alive:

```bash
curl http://localhost:4000/health/ready    # {"ok":true,"db":{...}}
```

> **`@trefood/shared` must be built before the others can typecheck** — they consume
> its emitted `.d.ts` files. Every root script does this for you; if you run a
> workspace script directly and see "cannot find module @trefood/shared", run
> `npm run build -w @trefood/shared` first.

Then work Phase 0 → Phase 15 in order, per [PHASES.md](PHASES.md).
