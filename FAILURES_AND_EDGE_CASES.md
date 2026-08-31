# TREFOOD — Failure Modes, Edge Cases & Accepted Risks

> Governed by [DECISIONS.md](DECISIONS.md). Refund rules are D1/D2/D3 — refunds fire
> **only on vendor or platform fault**, never on student regret, and always exclude
> the convenience fee.
>
> This document has three parts:
> **§2** failures we handle automatically · **§3** failures we handle with a human ·
> **§4** outliers we deliberately do **not** build for, and why.

---

## 1. The Matrix

| # | Failure | Detection | Automatic response | Refund? |
| :-- | :-- | :-- | :-- | :-- |
| F1 | Razorpay webhook never arrives | Reconciliation cron | Poll Razorpay API, promote to `PLACED` | — |
| F2 | Student pays, app crashes before redirect | Same as F1 | Order appears in history on next open | — |
| F3 | Payment arrives **after** auto-expiry | Webhook hits an `EXPIRED_NO_ACK` order | Immediate auto-refund, student notified | ✅ Full |
| F4 | Vendor never accepts (power/net/asleep) | 4-min timer | `EXPIRED_NO_ACK` + auto-refund | ✅ Full |
| F5 | Vendor rejects | Vendor tap | `REJECTED_BY_VENDOR` + auto-refund | ✅ Full |
| F6 | Item runs out after acceptance | Vendor 86-tap | Student picks: substitute / drop item / cancel | ✅ If cancel |
| F7 | Student absent at gate — **prepaid** | 15-min grace | `DELIVERED_TO_SECURITY`, guard handoff | ❌ None |
| F8 | Student absent at gate — **COD** | 15-min grace | `NO_SHOW`, token forfeited, strike recorded | ❌ None |
| F9 | Student refuses to pay COD cash | Vendor reports | `NO_SHOW` + immediate `codBlocked = true` | ❌ None |
| F10 | Student takes food, never taps confirm | 15-min grace | Auto-close as `DELIVERED` | ❌ None |
| F11 | Curfew closes while rider is in transit | Pre-checkout guard + live check | Reroute to 24×7 main gate, student re-pinged | ❌ None |
| F12 | Duplicate order (double-tap) | Idempotency key | Second request returns the first order | — |
| F13 | Price changed between cart and pay | Server recompute | Checkout blocked, cart refreshed with new price | — |
| F14 | Item 86-ed between cart and pay | Server recompute | Item removed, student re-confirms total | — |
| F15 | Settlement cron runs twice | Unique index | Second run is a no-op | — |
| F16 | Refund API call fails at Razorpay | Refund retry cron | 3 retries with backoff, then admin alert | ⚠️ Manual |
| F17 | Push notification blocked/undelivered | No ack | Fallback: in-app banner + vendor phones student | — |
| F18 | Vendor forgets to tap "Rider at gate" | 2× prep-time elapsed | Nag banner on vendor board + admin flag | — |

---

## 2. Automatic Failures — Detailed Protocols

### F1/F2 — The Razorpay webhook that never came

The most common real-world payment failure is not a declined card. It is a student on
hostel Wi-Fi whose UPI app succeeds while their browser tab dies.

```
RECONCILIATION CRON — every 60 seconds
  find orders WHERE status = PAYMENT_PENDING
               AND createdAt < now - 3 minutes
               AND createdAt > now - 24 hours

  for each:
     GET https://api.razorpay.com/v1/orders/{razorpayOrderId}/payments

     if any payment.status == "captured":
         verify amount == expectedOnlineAmount     <- never skip this
         promote to PLACED, notify vendor, notify student
     else if createdAt < now - 15 minutes:
         mark PAYMENT_FAILED
```

The webhook and the cron must be **the same code path**, both guarded by the
`webhookEvents` unique index, so whichever wins the race, the order is promoted
exactly once.

### F3 — Payment lands after the order already expired

The genuinely nasty race: student pays at 3:58, vendor never acknowledged, the cron
expires the order at 4:00, and the webhook arrives at 4:02.

```
on webhook for an order already in EXPIRED_NO_ACK or PAYMENT_FAILED:
    do NOT promote to PLACED
    immediately issue refund of refundableAmount
    notify: "Payment received after the restaurant timed out. Refund issued."
```

Money must never sit captured against a dead order. Handle this or it will show up as
an angry student who paid for food nobody is cooking.

### F4 — Vendor never acknowledges

```
t=0:00   order PLACED. Board chimes on a loop. Card flashes red.
t=1:30   chime escalates: louder tone + browser notification even if tab hidden
t=3:00   ack window closes visually — card turns amber, "auto-cancel in 60s"
t=4:00   EXPIRED_NO_ACK. Full auto-refund. Student told:
         "NIT Canteen did not respond. Your ₹225 is on its way back."
```

Repeated expiries are a vendor-health signal, not just an order failure. Three in one
day auto-flips the restaurant to `isOpen = false` and alerts admin — a canteen that
cannot answer its tablet should not keep taking orders.

### F6 — Stockout after acceptance

The vendor discovers mid-cook that the paneer is finished.

```
VENDOR: taps the item -> "Out of stock"
        (a) marks item unavailable for all FUTURE orders, instantly
        (b) opens the resolution flow for THIS order

STUDENT: gets a push and a blocking screen with three choices,
         and a 5-minute timer:

   [ Swap for Egg Roll ]        price difference settled per rule below
   [ Remove it, deliver rest ]  partial refund of that line
   [ Cancel whole order ]       full refund of refundableAmount

   No response in 5 min -> auto "Remove it, deliver rest"
   (the student gets food and money back, the least-bad default)
```

**Price difference rule:** if the substitute is cheaper, refund the difference. If it
is more expensive, **the vendor absorbs it** — never charge a second time. Collecting
incremental payment mid-order needs a whole second Razorpay flow for ₹20, and it will
fail more often than it works.

### F7/F8/F10 — The student who does not show up

Prepaid and COD diverge completely here, because in one case the platform holds the
money and in the other the rider is holding food that has not been paid for.

```
                        AT_GATE fires
                             │
              ┌──────────────┴──────────────┐
              │                             │
          PREPAID                          COD
              │                             │
   push + 15 min timer            push + 15 min timer
              │                             │
   t=5m  second push              t=5m  second push
   t=10m vendor phones student    t=10m vendor phones student
              │                             │
   t=15m no response              t=15m no response
              │                             │
   Rider leaves packet with       Rider CANNOT leave food.
   the hostel guard, name and     Takes it back.
   order number written on it.    Status: NO_SHOW
   Status:                        Token (₹23) forfeited to
   DELIVERED_TO_SECURITY          the vendor as compensation.
              │                    Strike recorded on the student.
   Student pushed:                        │
   "Left with Ganga Gate            2 strikes -> codBlocked = true
    security. Collect there."       (prepaid ordering still allowed)
```

**F10 (took the food, never tapped)** collapses into the same 15-minute auto-close.
The order becomes `DELIVERED`, the vendor is paid, and nothing is stuck. This is the
one soft spot created by D4 — and it costs nothing, because the vendor already has the
cash (COD) or the platform already has the money (prepaid). The confirm tap is a
*receipt*, not a payment gate.

### F9 — COD cash refusal at the gate

```
Rider: hands over nothing. Zero negotiation, no partial cash.
       Food returns to the restaurant.
Vendor: taps "Student refused payment" on the order.
System: NO_SHOW · token forfeited to vendor · codBlocked = true IMMEDIATELY
        (not two strikes — this one is deliberate, not accidental)
Student: "COD is disabled on your account. You can still order with online payment."
```

Never permanently ban the account. A blocked-COD student who must prepay is a
*better* customer than a lost one, and prepaid orders carry zero collection risk.

### F11 — Curfew

Two layers, because a gate can close between order and arrival.

**Layer 1 — pre-checkout guard (prevents ~95% of cases):**

```
estimatedArrival = now + restaurant.prepMinutes + campus.transitMinutes
if estimatedArrival > (zone.curfewTime - 10 min buffer):
    disable that zone at checkout with a plain-language reason:
    "Ganga Girls Hostel gate closes at 21:30. Order by 20:45,
     or choose Main Campus Gate (open 24x7)."
```

**Layer 2 — in-flight reroute:** if the gate is shut on arrival anyway, the vendor
taps *Gate closed*, the order redirects to the campus fallback zone, and the student
is pushed the new location. The grace timer restarts from zero.

> **Timezone trap:** curfew times crossing midnight (a `01:00` cutoff means *next
> day*). Store curfews as minutes-from-midnight integers and always compare in the
> campus timezone, never in UTC and never in server-local time.

### F12/F13/F14 — Cart and submission races

- **F12 duplicate submit:** the client generates a UUID per checkout attempt and sends
  it as an idempotency key. The server upserts on that key, so a double-tap or a retry
  returns the *same* order instead of creating a twin.
- **F13/F14:** the client never sends prices — only item IDs and quantities. The server
  recomputes from the database. If the total differs from what the student was shown,
  checkout stops and the cart re-renders with the change highlighted. A student must
  never be charged a price they did not see.

---

## 3. Failures That Need a Human

These get an admin queue, not an algorithm. At campus scale the volume is low enough
that a person is faster, cheaper, and fairer than the logic required to automate it.

| Case | Admin sees | Admin can do |
| :-- | :-- | :-- |
| Wrong item delivered | Photo, KOT snapshot, order detail | Partial/full refund, debit vendor ledger |
| Food spilled or cold | Photo + student note | Same |
| Student claims non-delivery after auto-close | Order timeline, gate code, vendor statement | Refund + vendor debit, or reject the claim |
| Vendor disputes a chargeback | Full audit trail | Reverse the ledger debit |
| Repeated no-shows | Strike history | Block COD, or suspend account |
| Refund stuck after 3 retries (F16) | Razorpay error payload | Manual refund in the Razorpay dashboard, then reconcile |

**Dispute window: 30 minutes after delivery.** Long enough to open the bag, short
enough that the food is still evidence. Photo upload is mandatory — no photo, no
dispute. Every ruling is audit-logged with the admin identity and a written reason.

---

## 4. Outliers We Deliberately Do NOT Build For

You said outlier cases contribute very little. These are the ones where I have
deliberately chosen **no code**, only a fallback. Each entry states the cost of
building it versus the cost of absorbing it.

| Outlier | Why we skip it | What happens instead |
| :-- | :-- | :-- |
| **Two students order the last plate** | True stock counting means quantity tracking, decrements, reservations, and TTL release on abandoned carts. Enormous complexity for a canteen that cooks to order. | Availability is a **boolean**, not a count. The vendor 86s it and F6 handles the loser. |
| **Partial COD cash (student has ₹200 of ₹202)** | Rounding is already ceil-to-rupee; shortfalls are pennies. Building a partial-payment ledger for ₹2 is absurd. | Rider takes what is offered. Vendor eats or waives the difference. Not modelled. |
| **Rider theft / never delivered** | Riders are the vendor's own employees. This is the vendor's HR problem, not a platform state machine. | Student disputes (§3). Vendor is debited. Repeat offenders get vendor-level review. |
| **Order splitting across restaurants** | Doubles the entire order, dispatch, and settlement model to serve a rare want. | One restaurant per cart, enforced. Student places two orders. |
| **Scheduled / advance orders** | Needs a scheduler, capacity model, and a whole new failure tree. Campus demand is impulse-driven. | Not offered in v1. |
| **Live rider GPS tracking** | Physically impossible without a rider device (D4). | Status stepper + ETA countdown. Never call it "live tracking" in UI copy. |
| **Multi-currency / multi-country** | Zero near-term value. | INR paise only, hardcoded. |
| **Vendor-initiated cancellation after `PREPARING`** | Creates a refund path that vendors could abuse to dodge bad orders. | Only admin can cancel post-acceptance. Vendor must call admin. |
| **Student editing an order after placement** | Every edit re-opens pricing, payment delta, and KOT reprint. | Not allowed. Cancel window is zero once accepted. |
| **Offline order placement** | Payment cannot complete offline anyway. | PWA caches browsing only. Checkout requires network. |

---

## 5. Operational Runbook — Things That Will Actually Happen in Week 1

Practical failures that are not code bugs but will still page you:

1. **A vendor leaves the tablet on the counter, screen locked.** Orders expire, students
   get refunds, and everyone blames the app. *Fix:* mandate a wall charger, disable
   screen sleep, and check the vendor-health flag daily during the first fortnight.
2. **The gate code is written illegibly in marker.** *Fix:* print labels if the vendor
   has a thermal printer; otherwise mandate large digits and use only codes with
   unambiguous characters (no 0/O confusion — codes are digits only, by design).
3. **A student swears they never got the push.** They almost certainly denied the
   permission prompt or never installed the PWA. *Fix:* show a persistent in-app
   banner when push permission is not granted, and never rely on push as the only
   channel for the `AT_GATE` event.
4. **Exam-week surge floods one canteen.** *Fix:* the vendor sets a longer prep time,
   or toggles `isOpen = false` for twenty minutes. Both are one tap. Teach this on day
   one — it is the release valve that prevents a cascade of F4 expiries.
5. **Atlas connection limits on the free tier during a spike.** Serverless functions
   each open a pool. *Fix:* a cached global Mongo client (`globalThis` singleton), and
   `maxPoolSize: 10`. This is a genuine free-tier ceiling — watch it, and treat it as
   the first thing to upgrade when order volume grows.
