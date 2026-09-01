# TREFOOD — Master Build Prompt & Product Requirements

> **How to use this file.** This is the single prompt you hand to an AI coding agent
> or a new developer. It is self-contained: everything needed to start building is
> either here or one link away.
>
> Companion documents:
> [DECISIONS.md](DECISIONS.md) · [SYSTEM_ARCHITECTURE_AND_FLOWS.md](SYSTEM_ARCHITECTURE_AND_FLOWS.md) ·
> [MONEY_AND_SETTLEMENT.md](MONEY_AND_SETTLEMENT.md) · [FAILURES_AND_EDGE_CASES.md](FAILURES_AND_EDGE_CASES.md) ·
> [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

---

## PART 1 — THE PROMPT

You are building **TREFOOD**, a hyperlocal food delivery platform engineered for the
physical realities of an Indian college campus. First deployment: **NIT Patna**. The
system must be multi-tenant from day one, so a second campus is a database row, never
a code change.

### The problem this exists to solve

Zomato and Swiggy do not work inside a campus, for reasons that are physical, not
technical:

1. **Outside riders cannot enter.** Hostels, academic blocks, and residential zones
   are closed to external delivery staff. Handover happens at a **gate**, never at a door.
2. **Gates have curfews.** Girls' hostels shut at 21:30, boys' at 22:00, academic
   blocks at 19:00. A delivery that arrives four minutes late cannot be completed at all.
3. **The radius is tiny.** 95% of orders travel under 2.5 km. Route optimisation is
   worthless here.
4. **Order values are ₹50–₹250.** A 25–30% aggregator commission makes a ₹60 roll
   uneconomic. TREFOOD takes **10%**.
5. **Demand is spiky and nocturnal.** Post-lecture (16:00–18:00) and late-night
   (22:30–02:30) clusters, with exam-week surges.
6. **Riders are the restaurant's own staff, and many carry no smartphone.** Any design
   requiring a rider app, rider login, or rider GPS is dead on arrival.

### The seven locked decisions

These are settled. Do not redesign around them, and do not reintroduce the
alternatives they replaced.

| # | Decision |
| :-- | :-- |
| **D1** | Refunds fire **only on vendor or platform fault**. Never on student change-of-mind. |
| **D2** | A refund returns `grandTotal − convenienceFee`. Paid ₹3.18 → refunded ₹3.00. The gateway charge and its GST are never returned. |
| **D3** | The gateway fee lost on a refund is **debited from the vendor's next payout**. |
| **D4** | Delivery is closed by the **student**, tapping *Confirm Received* after matching a 4-digit code physically written on the packet. **There is no rider app, no rider account, and no rider device.** |
| **D5** | A single flat delivery fee per campus, set by admin, flowing to the vendor. |
| **D6** | The 10% commission is charged on **food + packaging + delivery**. |
| **D7** | Google sign-in now; phone number collected at first checkout. Phone OTP is added later, once TRAI DLT registration clears, behind the same auth interface. |

### The consequence you must internalise

**D4 makes live rider tracking physically impossible.** A rider with no phone cannot
emit a coordinate. Never build a moving map dot, never write the words "track your
rider live", and never accept a ticket asking for it. What replaces it: a status
stepper, a vendor-tapped *Rider at gate* event, and an ETA computed from
`acceptedAt + prepMinutes + campusTransitMinutes`.

This deletes the Google Maps bill, the rider device fleet, rider onboarding, and rider
support entirely. It is the single largest cost saving in the architecture.

---

## PART 2 — TECH STACK

| Layer | Choice | Notes |
| :-- | :-- | :-- |
| Repo | **npm workspaces monorepo** | `shared` (types + money), `backend` (API), `frontend` (UI). Two independently runnable services |
| Frontend | **Next.js 16, App Router** | UI only. Holds no business rules and never touches MongoDB — it calls the backend through `src/api-client` |
| Backend | **Express 5 + TypeScript** | Owns MongoDB, every business rule, Razorpay, and the cron routes. Every secret lives here |
| Language | **TypeScript, strict mode** | `strict: true`, no `any`, no non-null `!` on external data |
| UI | **Tailwind CSS + shadcn/ui** | Mobile-first. Minimum 44×44px touch targets |
| Database | **MongoDB Atlas** (free tier) | Documents only. Cached global client, `maxPoolSize: 10` |
| Auth | **Supabase Auth** — Google OAuth | Behind `backend/src/auth/` so the OTP provider drops in later (D7) |
| Payments | **Razorpay** | Orders API, Refunds API, signed webhooks |
| Images | **Supabase Storage** | **Not MongoDB.** The 512 MB Atlas tier is for documents. Mongo stores the URL string only |
| Maps | **Leaflet + OpenStreetMap** | Admin geofence drawing and a static gate pin. No API key, no billing |
| Realtime | **Interval polling** | 5 s vendor board, 8 s student tracker. Not websockets — they die on serverless |
| Notifications | **Web Push (VAPID)** | Free. SMS/WhatsApp deferred to post-DLT |
| Observability | **Sentry + PostHog** | Errors and funnels |
| Hosting | **Two deployables** | Frontend and backend deploy and scale independently. Scheduling the cron routes is a deployment decision — see PROJECT_STRUCTURE.md §6 |

**Three corrections to the original stack plan, already applied above:** images move
out of MongoDB to Supabase Storage; maps drop to Leaflet/OSM; Supabase Realtime is
replaced by polling, because Realtime watches Postgres rows and the order data lives
in MongoDB where it would emit nothing. Rationale for each is in
[DECISIONS.md §3](DECISIONS.md).

**A fourth change, decided after those:** the frontend and backend are now separate
services in one repo, so they can be deployed and scaled independently. The practical
consequence for the build is that Server Components and Server Actions no longer read
or write MongoDB directly — every read is an HTTP call through `frontend/src/api-client`,
and every rule lives behind `backend/src/services/`. The upside is that the frontend
holds no secret at all.

---

## PART 3 — WHAT TO BUILD

### 3.1 Student PWA — mobile-first, installable

- **Browse without logging in.** Auth is required only at checkout.
- **Campus selector**, remembered across visits.
- **Delivery point chosen BEFORE browsing**, in a sticky header. It filters which
  restaurants appear, because vendors declare which zones they serve. This is the
  single most important structural difference from a mainstream food app.
- **Restaurant list:** open first, closed greyed at the bottom. Prep time, minimum
  order, veg/non-veg marks, item search.
- **Menu:** categories, add-on groups with min/max selection, veg/non-veg indicators.
  Unavailable items are **struck through, not hidden** — students should see the item
  exists and is out today.
- **Cart:** one restaurant per cart, enforced hard.
- **Curfew guard at checkout:** if `now + prepMinutes + transitMinutes` lands within
  10 minutes of the zone's curfew, that zone is blocked with a plain-language reason
  and the 24×7 main gate is offered instead.
- **Checkout:** two payment paths only — pay in full online, or pay the 10% token
  online and the balance in cash at the gate. Hide COD entirely when `user.codBlocked`.
- **Order tracking:** status stepper, ETA countdown, restaurant phone number.
  No map, no rider dot.
- **Gate screen:** at `AT_GATE`, reveal the expected 4-digit code in very large,
  high-contrast type — it will be read at 1 AM, outdoors, on a cracked screen — plus
  the exact cash amount for COD and a big **Confirm Received** button.
- **Order history, reorder, and a 30-minute dispute window** with mandatory photo upload.

### 3.2 Vendor Console — tablet and desktop

- **Live order board** in columns: New → Preparing → Ready → Out for delivery.
- **New-order alarm:** looping audio that stops only on interaction, a red flashing
  card, a browser notification even when the tab is backgrounded, and a 3:00 countdown
  ring. A missed order is lost revenue and a broken promise; defend it three ways.
- **Accept** with prep time (15 / 20 / 30 / custom, 5–60 min) or **Reject** with a reason.
- **One-tap 86** to mark an item out of stock, which instantly hides it from all future
  orders and opens the substitution flow for any in-flight order containing it.
- **KOT print**, formatted for 58 mm and 80 mm thermal printers, including the
  delivery zone name and its handover instructions.
- **Mark Ready** → reveals the 4-digit gate code in huge type for the staff to write on
  the packet. The student cannot see this code yet.
- **Rider dispatched** → **Rider at gate**: two taps that drive the entire student-side
  experience. The second one is the most operationally critical button in the product.
- **COD cash confirmation** and a *Student refused payment* action.
- **Menu management:** categories, items, prices, add-ons, images.
- **Earnings:** daily gross, commission deducted, ledger adjustments, net payable,
  downloadable statement.
- **Connection-lost banner** if two consecutive polls fail.

### 3.3 Admin Console — desktop only

- **Campus manager:** create a campus, draw its geofence with `leaflet-draw`, add
  delivery zones with type, curfew time, coordinates, and handover instructions.
- **Pricing controls per campus:** delivery fee, commission %, gateway fee %, all
  timers from [DECISIONS.md §4](DECISIONS.md).
- **Vendor KYC:** approve, set commission overrides, capture bank and UPI details.
- **Live radar:** every active order across every campus, with stuck-order highlighting.
- **Dispute queue:** photo evidence, order timeline, refund or reject with a written reason.
- **Settlement:** nightly run output, per-vendor CSV, mark-as-paid with UTR reference.
- **Audit log viewer**, filterable and exportable, append-only.
- **Student management:** strike history, COD block toggle.

---

## PART 4 — NON-NEGOTIABLE ENGINEERING RULES

1. **All money is integer paise.** No floats anywhere in the chain. Format to rupees
   only at render.
2. **The server recomputes every price.** The client posts item IDs and quantities.
   A client-supplied price is a security bug.
3. **Exactly one pricing function**, in `backend/src/services/pricing.ts`. Cart preview
   and order creation must call the same function, or they will drift. The frontend
   never computes a total — it renders what the API returns.
4. **Orders store snapshots**, not references. A restaurant renaming itself must not
   rewrite last month's orders.
5. **Every webhook is signature-verified** with `crypto.timingSafeEqual`, and made
   idempotent by inserting the event ID into `webhookEvents` (unique index) *before*
   acting.
6. **Every state transition writes an append-only `auditLogs` entry** recording actor,
   role, from, to, reason, timestamp.
7. **State transitions go through one guarded function.** No route handler mutates
   `order.status` directly.
8. **Cron routes are protected by a shared secret header.**
9. **Every backend route re-checks role AND resource ownership.** Frontend middleware
   is routing, not authorisation.
10. **Never cache order state in the service worker.** A stale "Cooking" screen while
    the rider waits at the gate is worse than a spinner.
11. **Gate codes are server-generated**, unrelated to the order number, and released to
    the student only at `AT_GATE`.
12. **The COD invariant is sacred:** `codOnlineToken === platformCommission` and
    `cashDueOnDelivery === vendorReceivable`. This is what makes COD self-settling.
    Any change that breaks it is rejected.

---

## PART 5 — BUILD ORDER

Ship in this sequence. Each phase is independently demonstrable.

| Phase | Deliverable | Done when |
| :-- | :-- | :-- |
| **0. Foundation** | Workspaces monorepo, Express backend + Next frontend, Mongo client, env validation, Sentry | Both services boot, DB pings, types compile clean |
| **1. Data & admin** | All collections, indexes, campus CRUD, geofence editor, zone editor | An admin can create NIT Patna with 5 real gates |
| **2. Vendor & menu** | Vendor CRUD, KYC, menu categories, items, add-ons, image upload | A canteen with a real menu exists and is browsable |
| **3. Student browse** | Campus + zone selection, restaurant list, menu, cart | A student can fill a cart. No payment yet |
| **4. Pricing engine** | `pricing.ts` + unit tests for all 7 invariants | Both worked examples in MONEY_AND_SETTLEMENT.md pass exactly |
| **5. Payments** | Razorpay orders, checkout, signed webhook, reconciliation cron | Both payment paths complete in Razorpay test mode |
| **6. Order lifecycle** | FSM, guarded transitions, vendor board, audio alarm, KOT print | An order runs end to end from tap to `DELIVERED` |
| **7. Gate handoff** | Gate codes, `AT_GATE` push, confirm screen, grace timers | The full §6 handoff flow works on a real phone |
| **8. Failures** | Every automatic case in FAILURES_AND_EDGE_CASES.md §2 | Each F-case has a passing test |
| **9. Settlement** | Nightly cron, ledger entries, vendor statements, CSV export | A day of mixed orders settles to the rupee |
| **10. Polish** | PWA manifest, service worker, push, PostHog, install prompt | Lighthouse PWA passes; installs on Android |

**Do not start Phase 5 before Phase 4's tests are green.** Every downstream bug in a
payment system is a pricing bug wearing a disguise.

---

## PART 6 — DEFINITION OF DONE

A feature is done when all of these hold:

- TypeScript strict passes with no `any` and no non-null assertions on external data.
- Money paths have unit tests asserting the §7 invariants from MONEY_AND_SETTLEMENT.md.
- Every new state transition writes an audit log entry.
- Every failure branch from FAILURES_AND_EDGE_CASES.md that touches the feature is handled.
- Tested on a real phone at 360 px width, not only in a desktop browser resized.
- No secret is readable from the client bundle.
- Loading, empty, and error states exist. A spinner alone is not an error state.

---

## PART 7 — WHAT NOT TO BUILD

Building any of these is a defect, not initiative. Reasoning is in
[FAILURES_AND_EDGE_CASES.md §4](FAILURES_AND_EDGE_CASES.md).

- A rider app, rider login, rider GPS, or rider payouts.
- Live map tracking of anything.
- Stock quantity counting — availability is a **boolean**, not a count.
- Multi-restaurant carts.
- Scheduled or advance orders.
- A student wallet — D1 chose real refunds instead.
- Student-initiated cancellation after vendor acceptance.
- Order editing after placement.
- Ratings-driven ranking. Collect ratings; do not rank on them yet.
- Automated payouts via RazorpayX. A nightly CSV is faster to build and faster to run
  at 10–20 vendors. Automate at 50+.

---

## PART 8 — OPEN ITEMS TO CONFIRM BEFORE LAUNCH

Defaults are already chosen for all of these, so none blocks the build. Review them
before go-live — full list in [DECISIONS.md §4](DECISIONS.md).

1. **Verify the real Razorpay fee on your plan** and set `gatewayFeePct`. The 2.36%
   default (2% + 18% GST) is an assumption, and it is the number students see.
2. **Confirm food GST per vendor.** Defaulted to 0%, which is correct only for
   canteens below the ₹20 L registration threshold.
3. **Set the real delivery fee and transit minutes for NIT Patna.**
4. **Capture the actual gates, curfew times, and coordinates.** Walk the campus and
   record them; this data is the product.
5. **Decide whether coupons are platform- or vendor-funded.** Defaulted to platform.
6. **Start TRAI DLT registration now,** in parallel with the build, so phone OTP is
   ready when you want it (D7).
