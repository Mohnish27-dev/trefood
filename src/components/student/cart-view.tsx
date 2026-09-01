"use client";

import { AlertTriangle, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money, MoneyRow } from "@/components/shared/money";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { VegMark } from "@/components/shared/veg-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/use-cart";
import { useCartQuote } from "@/hooks/use-cart-quote";

/**
 * The cart.
 *
 * Every rupee on this screen is computed by the SERVER, by the same
 * `computePricing` that order creation calls. The client sends item ids and
 * quantities and nothing else — it does not know prices and must not, because
 * a client-supplied price is a security bug (PRD Part 4.2).
 *
 * That also means the cart is where F13/F14 surface: if an item was 86-ed or
 * repriced since it was added, the server says so and the change is
 * HIGHLIGHTED rather than silently re-totalled.
 */
export function CartView() {
  const { lines, campusSlug, setQuantity, clear, dropItems } = useCart();
  const { status, data, reload } = useCartQuote();

  if (lines.length === 0 || status === "empty") {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Your cart is empty"
        description="Pick a restaurant that delivers to your gate and add something."
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
        description="We could not price your cart. Check your connection and try again — nothing has been lost."
        onRetry={reload}
      />
    );
  }

  if (data === null) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  const quote = data.quotes.ONLINE_100;
  const hasIssues = data.issues.length > 0;
  const payableNow = quote.commissionBasePaise - quote.discountPaise;

  return (
    <div className="p-4">
      <p className="mb-3 text-xs uppercase tracking-[0.15em] text-faint">
        From {data.restaurantName}
      </p>

      {/* F13/F14 — never a silent re-total. */}
      {hasIssues ? (
        <Card className="mb-4 border-amber/40 bg-amber-wash">
          <div className="flex gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber">Your cart changed</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-bone/90">
                {data.issues.map((issue) => (
                  <li key={`${issue.itemId}-${issue.code}`}>{issue.message}</li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => dropItems(data.issues.map((i) => i.itemId))}
              >
                Remove and continue
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ── Lines ─────────────────────────────────────────────── */}
      <Card className="divide-y divide-line">
        {lines.map((line) => {
          const priced = data.items.find((i) => i.itemId === line.itemId);
          const flagged = data.issues.some((i) => i.itemId === line.itemId);

          return (
            <div key={line.lineId} className="flex items-start gap-3 p-3.5">
              <VegMark isVeg={priced?.isVeg ?? true} className="mt-0.5" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-bone">{priced?.name ?? "Item"}</p>
                {priced && priced.addOns.length > 0 ? (
                  <p className="mt-0.5 text-xs text-faint">
                    {priced.addOns.map((a) => a.name).join(", ")}
                  </p>
                ) : null}
                {flagged ? (
                  <p className="mt-1 text-xs font-medium text-amber">Unavailable</p>
                ) : priced ? (
                  <p className="mt-1 text-sm text-muted">
                    <Money paise={priced.lineTotalPaise} />
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center rounded-xl border border-line">
                <button
                  type="button"
                  onClick={() => setQuantity(line.lineId, line.quantity - 1)}
                  className="flex size-10 items-center justify-center rounded-l-xl text-muted hover:bg-surface-raised hover:text-bone"
                  aria-label={line.quantity === 1 ? "Remove item" : "Decrease quantity"}
                >
                  {line.quantity === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                </button>
                <span className="min-w-6 text-center text-sm font-semibold tabular text-bone">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(line.lineId, line.quantity + 1)}
                  className="flex size-10 items-center justify-center rounded-r-xl text-muted hover:bg-surface-raised hover:text-bone"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* ── Bill ──────────────────────────────────────────────── */}
      <Card className="mt-4 p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          Bill details
        </h2>

        <MoneyRow label="Item total" paise={quote.subtotalPaise} />
        <MoneyRow label="Packaging" paise={quote.packagingFeePaise} />
        <MoneyRow
          label="Delivery to your gate"
          paise={quote.deliveryFeePaise}
          hint="Flat fee, goes to the restaurant"
        />
        {quote.discountPaise > 0 ? (
          <MoneyRow label="Discount" paise={quote.discountPaise} negative />
        ) : null}

        <div className="my-2 border-t border-line" />
        <MoneyRow label="Total" paise={payableNow} emphasis />

        <p className="mt-3 text-xs leading-relaxed text-faint">
          A payment-gateway fee is added at checkout, and it differs depending on how you
          choose to pay.
        </p>
      </Card>

      {data.belowMinimum ? (
        <p className="mt-3 rounded-xl border border-amber/30 bg-amber-wash px-3.5 py-3 text-xs leading-relaxed text-amber">
          {data.restaurantName} has a minimum order of <Money paise={data.minOrderPaise} />. Add{" "}
          <Money paise={data.minOrderPaise - quote.subtotalPaise} /> more to continue.
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={clear} aria-label="Empty cart">
          <Trash2 />
        </Button>

        {data.belowMinimum || hasIssues ? (
          <Button block size="lg" disabled>
            {hasIssues ? "Resolve the changes above" : "Add a bit more"}
          </Button>
        ) : (
          <Button asChild block size="lg">
            <Link href="/checkout">
              Choose gate &amp; pay · <Money paise={payableNow} />
            </Link>
          </Button>
        )}
      </div>

      <Link
        href={`/c/${data.campusSlug}/r/${data.restaurantSlug}`}
        className="mt-4 block text-center text-sm text-muted hover:text-saffron"
      >
        + Add more items
      </Link>
    </div>
  );
}
