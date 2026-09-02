"use client";

import { AlertTriangle, Banknote, Clock, CreditCard, Loader2, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Money, MoneyRow } from "@/components/shared/money";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/use-cart";
import { useCartQuote } from "@/hooks/use-cart-quote";
import { placeOrder } from "@/server/actions/student";
import { PAYMENT_METHOD, type PaymentMethod } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { CouponSection } from "@/components/student/coupon-section";

export interface CheckoutZone {
  id: string;
  name: string;
  instructions: string;
  available: boolean;
  blockedMessage: string | null;
  curfewLabel: string | null;
}

/**
 * Checkout.
 *
 * Three things happen here and nowhere else:
 *   · the CURFEW GUARD blocks a gate that cannot be reached in time, says why
 *     in plain language, and offers the 24x7 alternative in the same breath (F11)
 *   · the phone number is captured, once, and reused forever (D7)
 *   · the payment choice is made — and COD is hidden ENTIRELY, not disabled,
 *     when the account is blocked (F9)
 */
export function CheckoutView({
  zones,
  selectedZoneId,
  codBlockedReason,
  initialPhone,
}: {
  zones: CheckoutZone[];
  selectedZoneId: string | null;
  /** Non-null when this student's COD is blocked. F9. */
  codBlockedReason: string | null;
  initialPhone: string;
}) {
  const { lines, couponCode, setCouponCode, removeCoupon, clear, campusSlug } = useCart();
  const { status, data, reload } = useCartQuote();
  const router = useRouter();

  const [zoneId, setZoneId] = useState<string | null>(selectedZoneId);
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHOD.ONLINE_100);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <Loader2 className="size-8 animate-spin text-saffron" />
        <h3 className="mt-4 font-display text-base font-semibold text-bone">Order placed!</h3>
        <p className="mt-1.5 text-sm text-muted">Taking you to your order status…</p>
      </div>
    );
  }

  if (lines.length === 0 || status === "empty") {
    return (
      <EmptyState
        icon={CreditCard}
        title="Nothing to check out"
        description="Your cart is empty. Add something first."
        action={
          <Button asChild variant="secondary">
            <Link href={campusSlug ? `/c/${campusSlug}` : "/"}>Browse restaurants</Link>
          </Button>
        }
      />
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        description="We could not price your order. Nothing has been charged and your cart is safe."
        onRetry={reload}
      />
    );
  }

  if (data === null) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const quote = data.quotes[method];
  const codQuote = data.quotes[PAYMENT_METHOD.HYBRID_COD];
  const blocked = zone !== null && !zone.available;
  const codAvailable = data.codEnabled && codBlockedReason === null;

  const phoneValid = /^\+?[0-9]{10,15}$/.test(phone.replace(/\s/g, ""));
  const canSubmit = zone !== null && !blocked && phoneValid && !submitting && data.issues.length === 0;

  const submit = async (): Promise<void> => {
    if (!canSubmit || zone === null) return;
    setSubmitting(true);
    setError(null);

    const result = await placeOrder({
      restaurantId: data.restaurantId,
      zoneId: zone.id,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        addOnOptionIds: l.addOnOptionIds,
      })),
      method,
      // F12 — a fresh key per attempt, so a double-tap returns the first order
      // rather than creating a twin.
      idempotencyKey: crypto.randomUUID(),
      phone: phone.replace(/\s/g, ""),
      couponCode: couponCode || undefined,
    });

    if (result.status === "success") {
      setIsSuccess(true);
      clear();
      router.push(`/orders/${result.orderId}`);
      return;
    }

    setError(result.status === "error" ? result.message : "Something went wrong.");
    setSubmitting(false);
  };

  return (
    <div className="p-4 pb-8">
      {/* ── Gate ──────────────────────────────────────────────── */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          Collect at
        </h2>

        <Card className="divide-y divide-line">
          {zones.map((z) => {
            const selected = z.id === zoneId;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => setZoneId(z.id)}
                className={cn(
                  "flex w-full items-start gap-3 p-3.5 text-left transition-colors",
                  selected ? "bg-saffron-wash" : "hover:bg-surface-raised",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-saffron bg-saffron" : "border-line",
                  )}
                >
                  {selected ? <span className="size-2 rounded-full bg-ink" /> : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-bone">{z.name}</span>
                    {z.curfewLabel === null ? (
                      <span className="rounded-full border border-mint/30 bg-mint-wash px-2 py-0.5 text-[10px] font-medium text-mint">
                        24×7
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          z.available ? "border-line text-muted" : "border-amber/30 bg-amber-wash text-amber",
                        )}
                      >
                        <Clock className="size-2.5" />
                        {z.curfewLabel}
                      </span>
                    )}
                  </span>

                  <span className="mt-0.5 block text-xs text-faint">{z.instructions}</span>

                  {/* F11 — never merely disabled. Say why, and offer the way out. */}
                  {z.blockedMessage ? (
                    <span className="mt-2 flex gap-2 rounded-lg border border-amber/25 bg-amber-wash px-2.5 py-2 text-xs leading-relaxed text-amber">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>{z.blockedMessage}</span>
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </Card>

        {zone && !blocked ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <MapPin className="size-3.5 text-faint" />
            About {data.prepMinutes + data.transitMinutes} minutes from now
          </p>
        ) : null}
      </section>

      {/* ── Phone (D7) ────────────────────────────────────────── */}
      <section className="mb-5">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={phone.length > 0 && !phoneValid}
        />
        <p className="mt-1.5 text-xs text-faint">
          The restaurant calls this if they cannot find you at the gate. Saved for next time.
        </p>
      </section>

      {/* ── Payment ───────────────────────────────────────────── */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          How would you like to pay?
        </h2>

        <div className="space-y-2">
          <PaymentOption
            selected={method === PAYMENT_METHOD.ONLINE_100}
            onSelect={() => setMethod(PAYMENT_METHOD.ONLINE_100)}
            icon={CreditCard}
            title="Pay online now"
            subtitle="UPI, card or netbanking. Nothing to hand over at the gate."
            amountPaise={data.quotes.ONLINE_100.grandTotalPaise}
          />

          {/* F9 — COD is HIDDEN, not disabled, when blocked. A greyed-out
              button invites an argument; a plain explanation does not. */}
          {codAvailable ? (
            <PaymentOption
              selected={method === PAYMENT_METHOD.HYBRID_COD}
              onSelect={() => setMethod(PAYMENT_METHOD.HYBRID_COD)}
              icon={Banknote}
              title="Cash at the gate"
              subtitle="A small amount now to confirm the order, the rest in cash on handover."
              amountPaise={codQuote.onlinePaidPaise}
              footnote={
                <>
                  Carry exactly{" "}
                  <Money
                    paise={codQuote.cashDueOnDeliveryPaise}
                    className="font-semibold text-bone"
                  />{" "}
                  in cash.
                </>
              }
            />
          ) : (
            <Card className="border-line/60 p-3.5">
              <p className="flex items-center gap-2 text-sm font-medium text-muted">
                <Banknote className="size-4 text-faint" />
                Cash on delivery unavailable
              </p>
              <p className="mt-1 text-xs leading-relaxed text-faint">
                {codBlockedReason ?? "Cash on delivery is turned off for this campus right now."}{" "}
                You can still order by paying online.
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* ── Coupons & Offers ──────────────────────────────────── */}
      <div className="mb-5">
        <CouponSection
          appliedCoupon={data.appliedCoupon}
          availableCoupons={data.availableCoupons}
          couponError={data.couponError}
          onApplyCoupon={(code) => setCouponCode(code)}
          onRemoveCoupon={() => removeCoupon()}
        />
      </div>

      {/* ── Bill ──────────────────────────────────────────────── */}
      <Card className="mb-5 p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          {data.restaurantName}
        </h2>

        <MoneyRow label="Item total" paise={quote.subtotalPaise} />
        {quote.discountPaise > 0 ? (
          <MoneyRow label="Discount" paise={quote.discountPaise} negative />
        ) : null}
        <MoneyRow
          label="Convenience fee"
          paise={quote.convenienceFeePaise}
          hint="Payment gateway charge. This part is not refundable."
        />

        <div className="my-2 border-t border-line" />

        {method === PAYMENT_METHOD.HYBRID_COD ? (
          <>
            <MoneyRow label="Pay now, online" paise={quote.onlinePaidPaise} emphasis />
            <MoneyRow
              label="Pay in cash at the gate"
              paise={quote.cashDueOnDeliveryPaise}
              emphasis
              hint="Hand this to the rider. Exact amount, please."
            />
          </>
        ) : (
          <MoneyRow label="Pay now" paise={quote.grandTotalPaise} emphasis />
        )}
      </Card>

      {error ? (
        <div
          role="alert"
          className="mb-4 flex gap-2.5 rounded-xl border border-chili/30 bg-chili-wash px-3.5 py-3 text-sm leading-relaxed text-chili"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Button block size="hero" disabled={!canSubmit} onClick={() => void submit()}>
        {submitting ? (
          <>
            <Loader2 className="animate-spin" />
            Placing your order…
          </>
        ) : blocked ? (
          "Choose a gate that is still open"
        ) : (
          <>
            Pay <Money paise={quote.onlinePaidPaise} /> &amp; place order
          </>
        )}
      </Button>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-faint">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        <span>
          A four-digit code will be written on your packet. Match it at the gate before you tap
          Confirm Received — that is the only way this order closes.
        </span>
      </p>

      <Link href="/cart" className="mt-4 block text-center text-sm text-muted hover:text-saffron">
        ← Back to cart
      </Link>
    </div>
  );
}

function PaymentOption({
  selected,
  onSelect,
  icon: Icon,
  title,
  subtitle,
  amountPaise,
  footnote,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  amountPaise: number;
  footnote?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors",
        selected ? "border-saffron bg-saffron-wash" : "border-line bg-surface hover:bg-surface-raised",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-saffron bg-saffron" : "border-line",
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-ink" /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium text-bone">
          <Icon className="size-4" />
          {title}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">{subtitle}</span>
        {footnote ? <span className="mt-1.5 block text-xs text-muted">{footnote}</span> : null}
      </span>

      <span className="shrink-0 text-sm font-semibold text-bone">
        <Money paise={amountPaise} />
      </span>
    </button>
  );
}
