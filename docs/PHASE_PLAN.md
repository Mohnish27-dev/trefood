# TREFOOD — Build Phase Plan

> Execution plan derived from [MASTER_PROMPT_PRD.md](MASTER_PROMPT_PRD.md) Part 5,
> re-sequenced for a **frontend-first prototype** that is demoed to students and
> restaurant owners before the payment rails are live.
>
> Governed by [DECISIONS.md](DECISIONS.md). Where this file and DECISIONS.md
> disagree, DECISIONS.md wins.
>
> Created: 2026-09-01

---

## 0. The Four Choices That Shaped This Plan

| Choice | Ruling | Consequence |
| :-- | :-- | :-- |
| **Visual direction** | **Midnight Campus** — dark-first ink ground, saffron accent, glowing gate code | Owns the 22:30–02:30 window. The vendor board is readable on a dim canteen tablet; the gate code is legible outdoors at 1 AM. A light theme is a later additive concern, not a parallel one. |
| **Data layer** | **Real MongoDB + Supabase from Phase 0** | No throwaway mock repository. Screens are built against live documents, so nothing is re-plumbed later. Costs roughly two phases of backend before the first pixel. |
| **Demo depth** | **Fully simulated end-to-end** | The FSM, pricing engine and curfew guard are the *real* server code from day one. Only Razorpay is stubbed. A vendor tap genuinely drives the student screen. |
| **Surfaces** | **All three consoles** | Student PWA, Vendor console, Admin console. Admin is functional-but-plainer; the student gate screen and the vendor board get the polish budget. |

### What "prototype" means here, precisely

This is **not** a clickable mockup. It is the real application with exactly one seam
left open: `PaymentProvider` has a `StubPaymentProvider` implementation that captures
instantly instead of calling Razorpay. Phase 9 swaps in `RazorpayPaymentProvider`
behind the identical interface. Every other line — pricing, state machine, curfew,
gate codes, audit log — is production code.

---

## 1. Phase Map

```
FOUNDATION            DOMAIN               DATA
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ P0 Toolchain │────▶│ P1 Money +   │────▶│ P2 Mongo +   │
│    Docker    │     │    FSM       │     │    Seed      │
│    Env       │     │    Curfew    │     │    Indexes   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                     │
                            └──────────┬──────────┘
                                       ▼
                            ┌──────────────────┐
                            │ P3 Design System │
                            │  Midnight Campus │
                            └────────┬─────────┘
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │ P4 Student   │ │ P5 Vendor    │ │ P6 Admin     │
            │    PWA       │ │    Console   │ │    Console   │
            └──────────────┘ └──────────────┘ └──────────────┘
                    └────────────────┼────────────────┘
                                     ▼
                          ┌──────────────────────┐
                          │ P7 Simulation loop   │
                          │    Edge-case states  │
                          │    PWA polish        │
                          └──────────┬───────────┘
                                     ▼
                        ═══ PROTOTYPE SHIPPABLE ═══
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌──────────────┐            ┌──────────────┐            ┌───────────────┐
│ P8 Real auth │            │ P9 Razorpay  │            │ P10 Settlement│
│    Supabase  │            │    Webhooks  │            │     Cron      │
└──────────────┘            └──────────────┘            └───────────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ P11 Failure hardening│
                          │ P12 Launch readiness │
                          └──────────────────────┘
```

---

## PHASE 0 — Foundation & Toolchain

**Goal:** the app boots, types compile clean, the database pings, and the whole thing
runs in a container.

| # | Task | Done when |
| :-- | :-- | :-- |
| 0.1 | Next.js 16 App Router, TS strict, Tailwind v4, `src/` layout | `npm run build` succeeds |
| 0.2 | **Harden `tsconfig`** beyond `strict`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` | `npm run typecheck` clean |
| 0.3 | ESLint rules banning `any`, non-null `!`, and floats in money paths | `npm run lint` clean |
| 0.4 | `src/lib/env.ts` — Zod schema, server/client split, fails loudly at boot | A missing `MONGODB_URI` crashes with a readable message |
| 0.5 | `src/server/db/client.ts` — cached `globalThis` Mongo client, `maxPoolSize: 10` | `/api/health` returns `{ db: "ok" }` |
| 0.6 | **Dockerfile** — multi-stage, `output: "standalone"`, non-root user | Image builds and runs |
| 0.7 | **docker-compose.yml** — app + local MongoDB + mongo-express | `docker compose up` gives a working stack with zero cloud credentials |
| 0.8 | Vitest configured with path aliases | `npm test` runs |
| 0.9 | Design tokens: Midnight Campus palette as CSS custom properties | Tokens resolve in both themes |

### Scalability decisions taken in Phase 0

These cost nothing now and are expensive to retrofit:

- **`output: "standalone"`** in `next.config.ts` — produces a self-contained server
  bundle. Required for a small Docker image and for any non-Vercel host.
- **Stateless by construction.** No in-process caches that survive a request, no local
  filesystem writes, no sticky sessions. Any instance can serve any request, so
  horizontal scaling is a replica-count change.
- **Cached Mongo client on `globalThis`, `maxPoolSize: 10`.** Per
  [FAILURES §5.5](FAILURES_AND_EDGE_CASES.md) this is the Atlas free-tier ceiling.
  Pool size is env-driven, so it rises with the tier rather than with a code edit.
- **Polling intervals are env-driven**, not hardcoded — the release valve when read
  load climbs is a config change.
- **Every collection accessor is typed and centralised** in `collections.ts`, so
  adding a read replica or a cache layer touches one file.
- **`campusId` on every domain document from day one.** Multi-tenancy is a filter,
  never a migration. A second campus is a row.

---

## PHASE 1 — Money, State Machine & Curfew

**Goal:** every business rule that money or time depends on exists as a pure, tested
function, before any UI can encode a rule by accident.

This phase is deliberately promoted ahead of the UI. The PRD's warning — *"every
downstream bug in a payment system is a pricing bug wearing a disguise"* — applies
just as hard to a prototype shown to restaurant owners. A demo that quotes a wrong
commission loses the vendor in the room.

| # | Task | Source of truth |
| :-- | :-- | :-- |
| 1.1 | `src/lib/money.ts` — paise arithmetic, `ceilToRupee`, `formatINR`. No `toFixed` anywhere | [MONEY §1](MONEY_AND_SETTLEMENT.md) |
| 1.2 | `src/types/**` — order, campus, restaurant, user, money. Every money field suffixed `Paise` | [ARCH §7](SYSTEM_ARCHITECTURE_AND_FLOWS.md) |
| 1.3 | `src/server/services/pricing.ts` — **the only place money is computed**. Pure: inputs in, integers out | [MONEY §2](MONEY_AND_SETTLEMENT.md) |
| 1.4 | `src/server/services/order-state.ts` — the FSM, legal transitions, actor guards | [ARCH §3](SYSTEM_ARCHITECTURE_AND_FLOWS.md) |
| 1.5 | `src/server/services/curfew.ts` — minutes-from-midnight, campus timezone, midnight crossing | [FAILURES §2 F11](FAILURES_AND_EDGE_CASES.md) |
| 1.6 | `src/server/services/gate-code.ts` — CSPRNG 4-digit, unrelated to the order number | [ARCH §10.4](SYSTEM_ARCHITECTURE_AND_FLOWS.md) |

### Gate: tests must be green before Phase 2

| Test | Asserts |
| :-- | :-- |
| `pricing.test.ts` | Worked Example A gives ₹231 / ₹202 / ₹23 / ₹6 exactly. Worked Example B gives ₹24 online, ₹202 cash. All seven invariants from [MONEY §7](MONEY_AND_SETTLEMENT.md). Fuzz 10k random carts asserting `commission + vendorReceivable === commissionBase` |
| `order-state.test.ts` | Every legal transition passes; every illegal one throws. Specifically: a student cannot confirm before `AT_GATE`; a vendor cannot cancel after `ACCEPTED` |
| `curfew.test.ts` | A 21:30 curfew blocks a 21:25 arrival (10-minute buffer). A 01:00 curfew resolves to the next day. Comparisons run in campus TZ, never server-local |

---

## PHASE 2 — Data Layer & Seed

**Goal:** a real NIT Patna exists in a real database, with real gates and real menus.

| # | Task | Detail |
| :-- | :-- | :-- |
| 2.1 | `server/db/collections.ts` — typed accessors for all 13 collections | [ARCH §7](SYSTEM_ARCHITECTURE_AND_FLOWS.md) |
| 2.2 | `server/db/indexes.ts` — every index, created idempotently on boot | Unique on `orderNumber`, on `settlements(restaurantId, date)`, on `webhookEvents.eventId` |
| 2.3 | `scripts/seed.ts` — NIT Patna, 5 gates with real curfews, 4 restaurants, ~40 menu items with add-on groups | Idempotent; re-runnable |
| 2.4 | Zod validation schemas per boundary in `lib/validation/` | Nothing enters Mongo unvalidated |

**Seed data doubles as the demo script.** The gates, curfew times and menus seeded here
are what a restaurant owner sees in the pitch, so they must be plausible: Ganga Boys
22:00, Kaveri Girls 21:30, Academic Block 19:00, Main Gate 24×7.

> [PRD Part 8.4](MASTER_PROMPT_PRD.md) asks for the *actual* gates and coordinates.
> The seed ships with researched placeholders flagged `// VERIFY ON CAMPUS`. Walking
> the campus and correcting them is a data edit, not a code change.

---

## PHASE 3 — Design System: Midnight Campus

**Goal:** one visual language, so all three consoles look like one product.

### The palette

| Token | Value | Role |
| :-- | :-- | :-- |
| `--ink` | `#0B0D12` | Page ground |
| `--surface` | `#12151D` | Cards |
| `--surface-raised` | `#1A1F2A` | Popovers, sheets |
| `--bone` | `#F5F3EF` | Primary text |
| `--muted` | `#8B93A5` | Secondary text |
| `--saffron` | `#FF6B1A` | Primary action, brand |
| `--saffron-glow` | `#FF8A47` | Gate code, focus rings |
| `--mint` | `#34D399` | Open, delivered, veg |
| `--chili` | `#F43F5E` | New-order alarm, non-veg, destructive |
| `--amber` | `#FBBF24` | Ack window closing, warnings |

### Rules the system enforces

1. **Minimum 44×44 px touch targets** everywhere. Enforced by a `size` variant on
   `Button`, not by remembering.
2. **Money renders only through `<Money paise={...} />`.** A raw number in a currency
   position is a review failure. This is how [MONEY §1](MONEY_AND_SETTLEMENT.md) rule 1
   is enforced at the UI boundary.
3. **Status renders only through `<StatusStepper />` and `<StatusBadge />`**, both
   driven by the FSM enum. A status string cannot be typed by hand.
4. **Every list component ships three states**: loading skeleton, empty, error. Per
   [PRD Part 6](MASTER_PROMPT_PRD.md), a spinner alone is not an error state.
5. **Copy discipline:** the word "track" never appears near "rider". The product says
   **"Live Order Status"**, per [DECISIONS §2](DECISIONS.md).

### Components built in this phase

`Button` · `Card` · `Sheet` · `Dialog` · `Badge` · `Input` · `Select` · `Tabs` ·
`Toast` · `Skeleton` · `EmptyState` · `ErrorState` · `Money` · `StatusStepper` ·
`StatusBadge` · `VegMark` · `CountdownRing` · `GateCodeDisplay` · `ConnectionBanner`

---

## PHASE 4 — Student PWA

Mobile-first. 360 px is the design width, not the fallback.

| Route | Screen | Non-obvious requirement |
| :-- | :-- | :-- |
| `/` | Campus picker | Remembered across visits |
| `/c/[campus]` | Restaurant list | **Zone chosen before browsing**, sticky header. It filters the list, because vendors declare served zones. This is the structural difference from Swiggy |
| `/c/[campus]/r/[slug]` | Menu | Unavailable items **struck through, not hidden** |
| `/cart` | Cart | One restaurant per cart, enforced hard, with a "clear and start over" prompt |
| `/checkout` | Checkout | **Curfew guard** blocks zones and offers the 24×7 gate. COD hidden entirely when `codBlocked` |
| `/orders` | History | Reorder |
| `/orders/[id]` | **Live Order Status** | Stepper, ETA countdown, restaurant phone. No map. No dot |
| `/orders/[id]` at `AT_GATE` | **Gate screen** | 4-digit code at ~96 px, tabular numerals, saffron glow. Exact cash for COD. `Confirm Received` |
| `/account` | Account | Phone, strikes, COD status |

**The gate screen is the highest-stakes screen in the product.** It is read outdoors,
at 1 AM, on a cracked screen, possibly in rain. It gets maximum contrast, maximum type
size, and no competing element.

---

## PHASE 5 — Vendor Console

Tablet-first. The order board is the single surface that determines whether a
restaurant renews.

| Route | Screen | Non-obvious requirement |
| :-- | :-- | :-- |
| `/vendor/orders` | **Live board** — New / Preparing / Ready / Out | Defended three ways per [ARCH §5](SYSTEM_ARCHITECTURE_AND_FLOWS.md): looping audio that stops only on interaction, a red flashing card, and a browser notification when backgrounded. Plus a 3:00 countdown ring |
| `/vendor/orders/[id]/kot` | KOT print | 58 mm **and** 80 mm thermal. Includes the zone name and its handover instructions |
| `/vendor/menu` | Menu and **one-tap 86** | 86 hides the item from all future orders instantly and opens the F6 substitution flow for in-flight orders |
| `/vendor/earnings` | Earnings | Gross, commission, ledger adjustments, net payable, CSV |
| `/vendor/settings` | Settings | Hours, prep time, fees, **zones served** |

Plus: `Mark Ready` reveals the gate code in huge type for the staff to write on the
packet — and the student must not see it yet. `Rider dispatched` then `Rider at gate`
are two taps; the second is the most operationally critical button in the product.

**Connection-lost banner after two consecutive failed polls.** A vendor who does not
know they are offline is a vendor about to lose four orders.

---

## PHASE 6 — Admin Console

Desktop only. Functional over beautiful, but consistent with the system.

| Route | Screen |
| :-- | :-- |
| `/admin/campuses/[id]/zones` | Leaflet with `leaflet-draw`: geofence editor, zone pins, curfew times, handover instructions |
| `/admin/vendors` | KYC queue, commission overrides, bank and UPI capture |
| `/admin/orders` | Live radar across every campus, stuck-order highlighting |
| `/admin/disputes` | Photo evidence, order timeline, refund or reject with a written reason |
| `/admin/settlements` | Nightly run output, per-vendor CSV, mark-as-paid with UTR |
| `/admin/students` | Strike history, COD block toggle |
| `/admin/audit` | Append-only log viewer, filterable, exportable |
| `/admin/pricing` | Per campus: delivery fee, commission %, gateway fee %, all timers from [DECISIONS §4](DECISIONS.md) |

Leaflet is client-only — it touches `window` on import, so the map editor loads via
`next/dynamic` with `ssr: false`. This is the one place in the app that does.

---

## PHASE 7 — Simulation, Edge States & PWA Polish

**Goal:** the prototype survives contact with a real audience.

### 7.1 The simulation loop

A `/demo` control panel drives a seeded order through the entire FSM, so the whole
flow can be shown in ninety seconds without a kitchen. Vendor taps in one tab
genuinely move the student screen in another, through the real state machine.

### 7.2 Every edge case gets a designed screen

This is the part that stops a prototype looking unorganised. From
[FAILURES_AND_EDGE_CASES.md](FAILURES_AND_EDGE_CASES.md), each of these gets a real UI
state — not a toast, not a blank page:

| Case | Screen it needs |
| :-- | :-- |
| **F4** vendor never accepts | Student: escalating status, then "NIT Canteen did not respond. Your ₹225 is on its way back." Vendor: the card turns amber at 3:00 with "auto-cancel in 60s" |
| **F5** vendor rejects | Reason shown to the student, refund state visible |
| **F6** item 86-ed mid-cook | **Blocking three-choice screen** with a 5-minute timer: swap, drop, or cancel. Auto-picks "drop" on timeout |
| **F7** prepaid no-show | "Left with Ganga Gate security. Collect there." |
| **F8/F9** COD no-show or refusal | `NO_SHOW`, token forfeited, strike shown on the account page; the COD section explains the block in plain language |
| **F11** curfew closes in flight | Reroute banner, new gate, timer restarts from zero |
| **F13/F14** price or availability changed | The cart re-renders **with the change highlighted** — never a silent re-total |
| **F17** push blocked | Persistent in-app banner. Push is never the only channel for `AT_GATE` |
| **F18** vendor forgot "at gate" | Nag banner on the board after 2× prep time |
| Offline | "You are offline — your placed orders are safe." |
| Connection lost | Vendor banner after two failed polls |

### 7.3 PWA

- `manifest.json`: standalone, portrait, maskable icons at 192 and 512.
- The service worker caches the app shell, menu images and restaurant lists.
- **It never caches order state.** Order reads are network-first, always. A stale
  "Cooking" screen while the rider stands at the gate is worse than a spinner.
- The install prompt is deferred until after the first delivered order, when intent
  peaks. On iOS 16.4+ this is load-bearing: Web Push only works once installed.

### Prototype exit criteria

- [ ] Lighthouse PWA passes; installs on Android
- [ ] Every screen verified at 360 px on a real phone, not a resized desktop window
- [ ] Every route has loading, empty and error states
- [ ] The full order loop is demoable in under 90 seconds from a cold browser
- [ ] `npm run typecheck && npm run lint && npm test` all green
- [ ] `docker compose up` reproduces the demo on a machine with no credentials

---

## PHASES 8–12 — Post-Prototype (Production Rails)

Sequenced after the prototype earns its buy-in. These map to
[PRD Part 5](MASTER_PROMPT_PRD.md) phases 5–10.

| Phase | Deliverable | Gate |
| :-- | :-- | :-- |
| **8. Real auth** | Supabase Google OAuth behind `server/auth/providers.ts`, middleware role gating, phone capture at first checkout (D7) | A real Google account can order |
| **9. Payments** | `RazorpayPaymentProvider` replaces the stub. Signed webhooks with `timingSafeEqual`, `webhookEvents` idempotency, reconciliation cron | Both payment paths complete in Razorpay test mode |
| **10. Settlement** | Nightly cron, `ledgerEntries`, vendor statements, CSV export, refund retry | A day of mixed orders settles to the rupee |
| **11. Failure hardening** | Every automatic case in [FAILURES §2](FAILURES_AND_EDGE_CASES.md) with a passing test | Each F-case has a test |
| **12. Launch readiness** | Sentry, PostHog funnels, rate limits, Web Push VAPID, load check | [PRD Part 8](MASTER_PROMPT_PRD.md) open items closed |

**Hard gate carried over from the PRD:** do not start Phase 9 until the pricing tests
are green. They already are, by construction — Phase 1 is gated on them.

---

## 2. Scaling & Containerisation Posture

The prototype is single-container. Nothing in it prevents the shape below, and every
item is a config change rather than a rewrite.

```
                        ┌──────────────┐
                        │  CDN / edge  │  static assets, menu images
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                        │ Load balancer│
                        └──────┬───────┘
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │ trefood app  │ │ trefood app  │ │ trefood app  │  stateless replicas
      │ (container)  │ │ (container)  │ │ (container)  │  scale on CPU
      └───────┬──────┘ └───────┬──────┘ └───────┬──────┘
              └────────────────┼────────────────┘
                               ▼
                   ┌───────────────────────┐
                   │  MongoDB (Atlas)      │  connection pool per replica,
                   │  replica set          │  maxPoolSize env-driven
                   └───────────────────────┘
```

| Concern | Prototype | Scale path | Code change? |
| :-- | :-- | :-- | :-- |
| App instances | 1 container | N replicas behind an LB | None — the app is stateless |
| Mongo | Container or Atlas free tier | Atlas M10+ replica set | Connection string only |
| Connection pool | `maxPoolSize: 10` | Raise with the tier | `MONGODB_MAX_POOL_SIZE` env |
| Polling load | 5 s / 8 s / 10 s | Widen intervals, or add a Redis read cache | Env vars; the cache is one file |
| Images | Supabase Storage | Any S3-compatible store plus a CDN | Storage adapter swap |
| Cron | Vercel Cron | Any scheduler hitting the same protected routes | None — routes are HTTP plus a shared secret |
| Second campus | Seed row | Seed row | **None. Multi-tenant from day one** |
| Sessions | Supabase JWT | Same | None — no server-side session store exists |

**The rule that keeps this true:** no module may hold request-scoped state in a
module-level variable. The only permitted `globalThis` singleton is the Mongo client,
and it exists precisely because a connection pool must *not* be per-request.

---

## 3. Working Agreement

- Phases are worked in order. Each ends green on
  `npm run typecheck && npm run lint && npm test`.
- Business logic lives in `src/server/services/`. Components authenticate, parse, call
  a service, and render. Nothing else contains a rule.
- Money is integer paise end to end. Rupees appear only at the render boundary, only
  via `<Money />`.
- Every state transition writes an append-only `auditLogs` entry.
- Nothing from [PRD Part 7](MASTER_PROMPT_PRD.md) gets built. In particular: no rider
  app, no live map, no stock counting, no multi-restaurant cart.
