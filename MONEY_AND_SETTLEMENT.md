# TREFOOD — Money Model, Pricing Engine & Settlement

> Governed by [DECISIONS.md](DECISIONS.md) D1, D2, D3, D5, D6.
> Every rupee in this system must be traceable. If a number cannot be derived from
> the formulas below, it is a bug, not a rounding difference.

---

## 1. Golden Rules

1. **All monetary values are stored as integer paise.** Never store floats. `₹202.50` is `20250`.
   Format to rupees only at the render boundary.
2. **All student-facing totals are whole rupees.** Rounding happens once, at cart
   computation, never at display time.
3. **Commission rounds UP. Vendor receivable is the remainder.** This guarantees
   `commission + vendorReceivable === commissionBase` exactly, forever, with no drift.
4. **The convenience fee is never refundable** and never belongs to TREFOOD — it is
   pass-through to Razorpay.
5. **A price is frozen at order creation.** Menu price changes never retroactively
   alter a placed order. The order document stores its own full price snapshot.

---

## 2. The Pricing Formula

```
subtotal        = SUM(item.unitPrice × qty + SUM(addOns.price))
packagingFee    = restaurant.packagingFee
deliveryFee     = campus.settings.deliveryFee            <- flat, admin-set
discount        = coupon value (platform-funded, see A1)

------------------------------------------------------------------
commissionBase     = subtotal + packagingFee + deliveryFee     <- D6
platformCommission = CEIL_TO_RUPEE(commissionBase × 10%)
vendorReceivable   = commissionBase − platformCommission
------------------------------------------------------------------

payableByStudent   = commissionBase − discount
convenienceFee     = CEIL_TO_RUPEE(onlineChargeAmount × 2.36%)  <- A3, NON-REFUNDABLE
grandTotal         = payableByStudent + convenienceFee
refundableAmount   = grandTotal − convenienceFee                <- D2
```

> **Note on discount:** because coupons are platform-funded (A1), the discount is
> subtracted *after* `commissionBase` is fixed. The vendor is paid on the full base;
> TREFOOD absorbs the coupon out of its own commission. If a coupon ever exceeds the
> commission, TREFOOD is paying to acquire that order — cap coupons at 10% of base in
> the coupon validator unless you deliberately want loss-leading promos.

---

## 3. Worked Example A — 100% Online (UPI / Card)

Order: ₹200 food + ₹10 packaging + ₹15 delivery, no coupon

| Line | Amount | Notes |
| :-- | --: | :-- |
| Food subtotal | ₹200 | |
| Packaging fee | ₹10 | in commission base (D6) |
| Delivery fee | ₹15 | in commission base (D6) |
| **Commission base** | **₹225** | |
| Platform commission (10%, ceil) | ₹23 | `CEIL(22.50)` |
| **Vendor receivable** | **₹202** | `225 − 23` |
| Convenience fee (2.36% of ₹225, ceil) | ₹6 | non-refundable |
| **Student pays online** | **₹231** | |
| **Refundable if vendor fails** | **₹225** | grandTotal − ₹6 |

**Cash movement:** Razorpay collects ₹231, deducts about ₹5.31 in fees, TREFOOD nets
about ₹225.69. At midnight settlement TREFOOD pays the vendor ₹202 and retains ₹23.

---

## 4. Worked Example B — Hybrid COD

Same order, commission base ₹225.

| Line | Amount | Notes |
| :-- | --: | :-- |
| **Online token (= the full commission)** | **₹23** | paid to Razorpay upfront |
| Convenience fee (2.36% of ₹23, ceil) | ₹1 | non-refundable |
| **Student pays online at checkout** | **₹24** | |
| **Cash handed to rider at the gate** | **₹202** | = vendor receivable, exactly |
| Student total outlay | ₹226 | |

### The invariant that makes COD settle itself

```
codOnlineToken     ===  platformCommission
cashDueOnDelivery  ===  vendorReceivable
```

Because the token **is** the commission and the cash **is** the receivable, a COD
order requires **zero settlement**. TREFOOD already holds exactly what it is owed;
the vendor already holds exactly what they are owed. There is no debt in either
direction, nothing to chase, and nothing to reconcile. This is the single most
important financial property of the platform — do not let a future feature break it.

> **Known asymmetry (A7):** COD costs the student ₹226 vs ₹231 prepaid, because the
> convenience fee applies only to the ₹23 token. COD is therefore *cheaper*, which
> nudges students toward the operationally harder path. The
> `campus.settings.codHandlingFee` lever exists to correct this. It ships at ₹0 —
> turn it on only if COD share climbs past what riders can comfortably handle.

---

## 5. Refunds (D1, D2, D3)

### Refunds fire ONLY on these triggers

| Trigger | State | Refund |
| :-- | :-- | :-- |
| Vendor taps *Reject* | `REJECTED_BY_VENDOR` | Full `refundableAmount` |
| Vendor never acknowledges within 4 min | `EXPIRED_NO_ACK` | Full `refundableAmount` |
| Admin cancels (power cut, closure, emergency) | `CANCELLED_BY_ADMIN` | Full `refundableAmount` |
| Admin upholds a delivery dispute | `DISPUTE_UPHELD` | Full or partial, admin-entered |

### Refunds NEVER fire on

- Student changed their mind, ordered by mistake, or is no longer hungry.
- Student did not show up at the gate.
- Student refused to pay the COD cash.
- Student disliked the food — that is a dispute for admin discretion, not automatic.

### Refund amount

```
refundAmount = order.refundableAmount     <- grandTotal MINUS the convenience fee
```

**Worked micro-example (your own case):**
Order ₹3.00, student paid ₹3.18, **refund is ₹3.00, not ₹3.18.**
The ₹0.18 was the Razorpay cut plus GST on that cut. Razorpay does not return it on
a standard refund, so TREFOOD cannot return it either.

For a COD order the refundable amount is only the token actually paid online
(₹24 paid in Example B, minus its ₹1 convenience fee, so **₹23**). There is no cash
to refund because no cash was ever collected.

### Who absorbs the gateway loss (D3)

On every vendor-fault refund, Razorpay keeps its original fee. That loss is booked as
a **negative ledger entry against the vendor**, deducted from their next payout:

```json
{
  "vendorId": "...",
  "orderId": "TRF-NITP-8921",
  "type": "REFUND_GATEWAY_RECOVERY",
  "amountPaise": -531,
  "note": "Gateway fee not returned on refund of TRF-NITP-8921"
}
```

Vendors see this line on their statement. It makes rejections carry a real cost,
which is exactly the incentive you want: a vendor who rejects freely pays for it.

---

## 6. Daily Settlement Engine

Runs at **23:59 campus-local time** via a Vercel Cron hitting a protected route.

```
For each restaurant, for the settlement day:

  grossPrepaid = SUM(vendorReceivable) WHERE method = ONLINE_100
                                         AND status = DELIVERED
  adjustments  = SUM(ledgerEntries)    -- refund recoveries, dispute debits, penalties

  netPayout    = grossPrepaid + adjustments      -- adjustments are negative

  COD orders contribute ₹0 -- already settled at the gate (see section 4).
```

### Settlement rules

1. **Only `DELIVERED` orders settle.** Anything still in flight rolls to the next day.
2. **Negative net payout carries forward** as an opening debit. Never claw back money
   already sent.
3. **Payouts below ₹100 roll forward**, so per-transfer fees do not eat the amount.
4. Each run writes an immutable `settlements` document. The payout is generated *from*
   that document, never recomputed on the fly.
5. Settlement is **idempotent**: re-running for the same `(restaurantId, date)` must be
   a no-op. Enforce with a unique compound index.

### Paying out

**v1: manual bank transfer.** Admin downloads a CSV, pays via their own banking app,
marks the batch `PAID` with a UTR reference. Zero extra integration.

> RazorpayX Payouts needs a separate current account and activation. **Do not block
> launch on it.** With 10–20 vendors, a five-minute nightly CSV is genuinely faster
> than the integration would be. Automate at 50+ vendors.

---

## 7. Reconciliation Invariants (assert these in tests)

For any `DELIVERED` order, all of the following must hold exactly:

```
1.  commissionBase === subtotal + packagingFee + deliveryFee
2.  platformCommission + vendorReceivable === commissionBase
3.  grandTotal === commissionBase − discount + convenienceFee
4.  refundableAmount === grandTotal − convenienceFee
5.  IF method = HYBRID_COD:
        onlinePaidAmount  === platformCommission + convenienceFee
        cashDueOnDelivery === vendorReceivable
6.  IF method = ONLINE_100:
        onlinePaidAmount  === grandTotal
        cashDueOnDelivery === 0
7.  All values are integers >= 0 (paise). No floats anywhere in the chain.
```

A nightly job should assert these across every order created that day and alert the
admin on any violation. Silent rupee drift is how platforms lose money invisibly.
