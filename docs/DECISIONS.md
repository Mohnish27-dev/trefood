# TREFOOD — Locked Decisions & Open Assumptions

> This file is the **single source of truth** for every contested design choice.
> If any other document in this repo contradicts this file, **this file wins** and
> the other document is a bug. Update this file first, then propagate.
>
> Last updated: 2026-09-01

---

## 1. Locked Decisions (confirmed by product owner)

| # | Decision | Ruling | Consequence for the build |
| :-- | :-- | :-- | :-- |
| D1 | **Refund policy** | Refunds exist **only on vendor/platform fault**. Never on student change-of-mind. | Razorpay Refunds API **is** integrated. A `refunds` collection, refund webhooks, and reversal states are required. |
| D2 | **Refundable amount** | Refund = amount paid **minus the non-refundable convenience fee (gateway charge + its GST)**. Student paid ₹3.18 → refund is ₹3.00. | `refundableAmount` is a stored field computed at order creation, never recomputed later. |
| D3 | **Who eats the gateway fee on a refund** | The **vendor**, via a debit on their next payout. | Requires a `ledgerEntries` collection with negative adjustment entries. |
| D4 | **Delivery handoff** | **Student confirms the packet code.** Vendor writes a 4-digit code on the packet; student matches it at the gate and taps *Confirm Received*. | **No rider app, no rider account, no rider device in v1.** OTP direction is inverted from the original spec. |
| D5 | **Delivery fee** | Flat fee per campus, set by admin. Student pays it; it flows to the vendor. | Single `deliveryFee` field on campus settings. No distance tiers, no per-vendor override in v1. |
| D6 | **Commission base** | 10% is charged on **food subtotal + packaging fee + delivery fee**. | `commissionBase` is an explicit stored field. Delivery fee is *not* commission-exempt. |
| D7 | **Student login** | **Google sign-in now**, phone captured at first checkout. Phone OTP added later once TRAI DLT registration clears. | Auth layer must be written behind an interface so the OTP provider drops in without touching call sites. |

---

## 2. The Consequence Nobody Has Said Out Loud Yet

**D4 removes live rider tracking from the product.**

Riders have no phones. A phone is the only thing that can emit a GPS coordinate.
Therefore TREFOOD **cannot** draw a moving dot on a map, and any screen promising
"track your rider live" is a screen that can never be built truthfully.

What replaces it:
- A **status stepper** (Placed → Accepted → Cooking → Dispatched → At Gate → Delivered).
- A **vendor-triggered "Rider has left" / "Rider at gate"** tap, which is the only
  real-world signal available.
- An **ETA countdown** derived from `acceptedAt + prepTime + campusTransitMinutes`.

This is a *feature*, not a shortfall: it deletes the entire Google Maps bill, the
rider device fleet, the rider onboarding funnel, and the battery/data support load.
Say "Live Order Status", never "Live Rider Tracking", in all UI copy.

---

## 3. Corrections to the Original Stack Plan

| Original plan | Problem | Ruling |
| :-- | :-- | :-- |
| **File storage in MongoDB** | Atlas free tier is 512 MB total. Menu photos would exhaust it within roughly 150–400 images, and binary reads compete with order queries for the same connection pool. | **Use Supabase Storage** (1 GB free, CDN-backed, S3-compatible). The Supabase account already exists for auth, so this adds no new vendor. Mongo stores the **URL string only**. |
| **Google Maps / Mapbox** | Billing account required; unnecessary once live tracking is gone (§2). | **Leaflet + OpenStreetMap raster tiles.** No API key, no billing. Used only for admin geofence drawing and a static gate pin. |
| **Supabase Realtime** | Realtime is bound to Supabase **Postgres** row changes. The order data lives in **MongoDB**, so it emits nothing. | **Interval polling** (5 s vendor board, 8 s student tracker) + **Web Push** for state transitions. Serverless-safe, free, and survives sleeping phones. |
| **"Rider dashboard"** | Contradicts D4. | Deferred to v2 behind a `riderMagicLink` feature flag, for the minority of riders who do have a phone. |

---

## 4. Open Assumptions (defaults chosen; flip these in admin config)

These were **not** explicitly ruled on. Each has a safe default and a config flag,
so none of them block the build — but review them before go-live.

| # | Assumption | Default chosen | Config key |
| :-- | :-- | :-- | :-- |
| A1 | Coupons are funded by the **platform**, not the vendor. Vendor is paid on the pre-discount base. | `PLATFORM` | `campus.settings.couponFundedBy` |
| A2 | Food GST is **0%** — most campus canteens are below the ₹20 L registration threshold. Registered vendors get 5%. | `0` | `restaurant.foodGstPct` |
| A3 | Payment-gateway convenience rate passed to the student. **Verify against your actual Razorpay plan before launch.** | `2.36%` (2% fee + 18% GST on the fee) | `campus.settings.gatewayFeePct` |
| A4 | All student-facing amounts are **whole rupees**. Commission rounds **up**; vendor receivable is the remainder. Guarantees clean cash at a dark hostel gate. | `CEIL` | `campus.settings.roundingMode` |
| A5 | Vendor must accept within **3 minutes**, auto-expires at **4 minutes**. | `180s / 240s` | `campus.settings.vendorAckSeconds` |
| A6 | Student has **15 minutes** at `AT_GATE` before auto-close (prepaid only). | `900s` | `campus.settings.gateGraceSeconds` |
| A7 | COD is **not** cheaper than prepaid on purpose — but it currently is, because the convenience fee applies only to the 10% token. An optional COD handling fee lever exists, **off** by default. | `0` | `campus.settings.codHandlingFee` |

---

## 5. Explicitly Out of Scope for v1

- Rider mobile app, rider accounts, rider GPS, rider payouts.
- Scheduled / pre-ordered deliveries.
- Multi-restaurant carts (one order = one restaurant, always).
- Student wallet balance (D1 chose real refunds instead).
- Ratings-driven ranking algorithms (collect ratings; do not rank on them yet).
- Anything that renders a moving vehicle on a map.
