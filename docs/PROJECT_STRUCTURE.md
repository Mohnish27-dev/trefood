# TREFOOD — Project Structure & Conventions

> The shape of the repository, what belongs in each folder, and the rules that keep
> business logic out of the UI. Governed by [DECISIONS.md](DECISIONS.md).

---

## 1. The One Rule That Shapes Everything

**Business logic lives in `src/server/services/`. Nothing else contains a rule.**

Server Actions, Route Handlers, and Components are *adapters* — they authenticate,
parse, call a service, and render. A service function must be callable from a unit
test with no HTTP, no session, and no React.

The reason is concrete: the cart preview screen and the order-creation path must
compute an identical price. If pricing logic lives in a component, they will drift,
and a student will be charged something other than what they were shown.

---

## 2. Directory Tree

```
trefood/
├── docs/                                # these planning documents
│   ├── DECISIONS.md
│   ├── MASTER_PROMPT_PRD.md
│   ├── SYSTEM_ARCHITECTURE_AND_FLOWS.md
│   ├── MONEY_AND_SETTLEMENT.md
│   ├── FAILURES_AND_EDGE_CASES.md
│   └── PROJECT_STRUCTURE.md
│
├── public/
│   ├── manifest.json                    # PWA manifest
│   ├── sw.js                            # service worker (never caches order state)
│   ├── sounds/new-order.mp3             # the vendor alarm
│   └── icons/                           # maskable PWA icons, 192 / 512
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # root: fonts, providers, Sentry, PostHog
│   │   ├── page.tsx                     # campus picker / redirect
│   │   │
│   │   ├── (student)/                   # ── STUDENT PWA ──────────────────
│   │   │   ├── layout.tsx               #   bottom nav, zone header, cart badge
│   │   │   ├── c/[campusSlug]/
│   │   │   │   ├── page.tsx             #   restaurant list, filtered by zone
│   │   │   │   └── r/[restaurantSlug]/page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/page.tsx        #   curfew guard + payment choice
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx             #   history
│   │   │   │   └── [orderId]/page.tsx   #   tracker + GATE SCREEN
│   │   │   └── account/page.tsx
│   │   │
│   │   ├── (vendor)/vendor/             # ── VENDOR CONSOLE ───────────────
│   │   │   ├── layout.tsx               #   role gate + audio alarm provider
│   │   │   ├── orders/page.tsx          #   THE live board
│   │   │   ├── orders/[orderId]/kot/page.tsx   # thermal print view
│   │   │   ├── menu/page.tsx            #   items, 86 toggles, add-ons
│   │   │   ├── earnings/page.tsx
│   │   │   └── settings/page.tsx        #   hours, prep time, fees, zones served
│   │   │
│   │   ├── (admin)/admin/               # ── ADMIN CONSOLE ────────────────
│   │   │   ├── layout.tsx               #   desktop-only shell
│   │   │   ├── campuses/[id]/zones/page.tsx    # Leaflet geofence editor
│   │   │   ├── vendors/page.tsx         #   KYC queue
│   │   │   ├── orders/page.tsx          #   live radar
│   │   │   ├── disputes/page.tsx
│   │   │   ├── settlements/page.tsx     #   nightly runs + CSV
│   │   │   ├── students/page.tsx        #   strikes, COD blocks
│   │   │   └── audit/page.tsx
│   │   │
│   │   ├── auth/callback/route.ts       # Supabase OAuth callback
│   │   │
│   │   └── api/
│   │       ├── webhooks/phonepe/route.ts    # signature + idempotency
│   │       ├── cron/
│   │       │   ├── reconcile-payments/route.ts   # F1/F2, every minute
│   │       │   ├── expire-unacked/route.ts       # F4, every minute
│   │       │   ├── close-stale-gates/route.ts    # F7/F10, every minute
│   │       │   ├── retry-refunds/route.ts        # F16, every 15 min
│   │       │   └── settle-daily/route.ts         # 23:59 campus time
│   │       ├── orders/[id]/poll/route.ts     # student tracker, 8 s
│   │       ├── vendor/orders/poll/route.ts   # vendor board, 5 s
│   │       └── push/subscribe/route.ts
│   │
│   ├── components/
│   │   ├── ui/                          # shadcn primitives, unmodified
│   │   ├── student/                     # RestaurantCard, GateCodeDisplay, ...
│   │   ├── vendor/                      # OrderBoardCard, PrepTimePicker, ...
│   │   ├── admin/                        # ZoneMapEditor, SettlementTable, ...
│   │   └── shared/                      # StatusStepper, MoneyDisplay, EmptyState
│   │
│   ├── server/                          # ══ EVERYTHING IMPORTANT ══
│   │   ├── db/
│   │   │   ├── client.ts                # cached global Mongo client, maxPoolSize 10
│   │   │   ├── collections.ts           # typed collection accessors
│   │   │   └── indexes.ts               # every index, created on boot
│   │   ├── auth/
│   │   │   ├── session.ts               # getSession, requireRole, requireOwnership
│   │   │   └── providers.ts             # Google now; OTP slots in here later (D7)
│   │   ├── services/
│   │   │   ├── pricing.ts               # ★ THE ONLY PLACE MONEY IS COMPUTED
│   │   │   ├── orders.ts                # createOrder, guarded transitions
│   │   │   ├── order-state.ts           # ★ the FSM: legal transitions + guards
│   │   │   ├── payments.ts              # PhonePe orders, verify, refund
│   │   │   ├── settlement.ts            # nightly run, idempotent
│   │   │   ├── ledger.ts                # append-only adjustments
│   │   │   ├── curfew.ts                # zone availability by clock
│   │   │   ├── gate-code.ts             # generate, reveal, verify
│   │   │   ├── notifications.ts         # web push fan-out
│   │   │   ├── disputes.ts
│   │   │   └── audit.ts                 # append-only, never updates
│   │   └── actions/                     # Server Actions — thin adapters only
│   │       ├── student.ts
│   │       ├── vendor.ts
│   │       └── admin.ts
│   │
│   ├── lib/
│   │   ├── money.ts                     # paise arithmetic, ceilToRupee, formatINR
│   │   ├── phonepe.ts                  # signed REST calls + webhook verification
│   │   ├── supabase/                    # browser + server clients
│   │   ├── validation/                  # Zod schemas per boundary
│   │   └── constants.ts                 # enums, status lists, timers
│   │
│   ├── types/
│   │   ├── order.ts  campus.ts  restaurant.ts  user.ts  money.ts
│   │
│   ├── hooks/
│   │   ├── use-poll.ts                  # visibility-aware interval polling
│   │   ├── use-order-alarm.ts           # looping audio until interaction
│   │   └── use-cart.ts                  # localStorage cart, IDs + qty only
│   │
│   └── middleware.ts                    # route-group role gating
│
├── tests/
│   ├── unit/pricing.test.ts             # ★ the 7 invariants
│   ├── unit/order-state.test.ts         # ★ every legal + illegal transition
│   ├── unit/settlement.test.ts          # idempotency, negative carry-forward
│   ├── unit/curfew.test.ts              # incl. curfews crossing midnight
│   └── integration/order-lifecycle.test.ts
│
├── .env.local.example
├── vercel.json                          # cron schedules
└── README.md
```

---

## 3. The Files That Deserve Extra Care

| File | Why it is load-bearing |
| :-- | :-- |
| `server/services/pricing.ts` | Every rupee in the system originates here. Pure function: inputs in, integers out. No DB calls, no session, no side effects — so it is trivially testable and impossible to accidentally branch on user identity. |
| `server/services/order-state.ts` | The FSM. Exposes one `transition(order, to, actor, reason)` that validates legality, checks the actor's right to fire it, writes the audit entry, and persists — atomically. Nothing else may write `order.status`. |
| `server/db/client.ts` | Serverless opens a connection pool per function instance. Without a cached `globalThis` client you will exhaust the Atlas free tier during the first exam-week surge. |
| `app/api/webhooks/phonepe/route.ts` | Verify signature → insert event ID (unique index) → act. In that order. Reversing it means a replayed webhook double-processes an order. |
| `lib/money.ts` | Paise-only arithmetic. If `Number.prototype.toFixed` appears anywhere in a money path, that is a bug. |

---

## 4. Naming & Style Conventions

- Files `kebab-case.ts`; React components `PascalCase.tsx`; hooks `use-thing.ts`.
- **Money fields always end in `Paise`.** `subtotalPaise`, never `subtotal`. The suffix
  is the type system for units — it makes a float bug visible at the call site.
- Booleans read as assertions: `isOpen`, `isAvailable`, `codBlocked`.
- Enums are `SCREAMING_SNAKE` string literals, never numbers, so a database dump is readable.
- Snapshot fields end in `Snapshot` (see the order document).
- Server-only modules start with `import "server-only";`.

---

## 5. Environment Variables

```bash
# ── Database ──────────────────────────────────────────
MONGODB_URI=
MONGODB_DB=trefood

# ── Supabase: auth + image storage ────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only, never NEXT_PUBLIC

# ── PhonePe ──────────────────────────────────────────
PHONEPE_MERCHANT_ID=
PHONEPE_MERCHANT_SECRET=                # server only
PHONEPE_WEBHOOK_SECRET=            # server only

# ── Web Push (generate with: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:ops@trefood.in

# ── Cron protection ───────────────────────────────────
CRON_SECRET=                        # required header on every /api/cron/* route

# ── Observability ─────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# ── App ───────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://trefood.in
```

Validate these with Zod at boot in `lib/env.ts` and fail loudly. A missing
`PHONEPE_WEBHOOK_SECRET` discovered at 1 AM during a payment surge is not the moment
to learn it was never set.

**Anything without the `NEXT_PUBLIC_` prefix must never be imported into a Client
Component.** Enforce it with `import "server-only"` in every module that reads a secret.

---

## 6. Cron Schedules (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/reconcile-payments",  "schedule": "* * * * *" },
    { "path": "/api/cron/expire-unacked",      "schedule": "* * * * *" },
    { "path": "/api/cron/close-stale-gates",   "schedule": "* * * * *" },
    { "path": "/api/cron/retry-refunds",       "schedule": "*/15 * * * *" },
    { "path": "/api/cron/settle-daily",        "schedule": "29 18 * * *" }
  ]
}
```

> `29 18` UTC is 23:59 IST. **Vercel Cron runs in UTC** — every schedule here is
> converted, and every campus-local comparison in code must go through the campus
> timezone, never the server clock.

> Vercel's Hobby plan limits cron frequency. If per-minute jobs are not available on
> your plan, merge the three minute-jobs into one `/api/cron/tick` route that runs all
> three checks in sequence. They are all fast indexed queries, so batching them costs
> nothing.

---

## 7. Testing Priorities

Test in this order. The first two are non-negotiable before touching PhonePe.

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
npx create-next-app@latest trefood --typescript --tailwind --app --src-dir
cd trefood
npx shadcn@latest init
npm i mongodb @supabase/supabase-js @supabase/ssr zod web-push \
      leaflet react-leaflet date-fns
npm i -D @types/leaflet @types/web-push vitest

mkdir -p docs && mv *.md docs/ 2>/dev/null   # keep planning docs together
cp .env.local.example .env.local             # then fill it in
```

Then work Phase 0 → Phase 10 in order, per
[MASTER_PROMPT_PRD.md Part 5](MASTER_PROMPT_PRD.md).
