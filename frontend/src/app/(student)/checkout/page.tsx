"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info } from "lucide-react";
import {
  checkCurfew,
  curfewMessage,
  formatClock,
  minutesFromMidnightIn,
  type ICampus,
  type IMenuItem,
  type IRestaurant,
  type PaymentMethod,
} from "@trefood/shared";

import { MoneyDisplay, Skeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/use-cart";
import { useDelivery } from "@/hooks/use-delivery-context";
import { useNow } from "@/hooks/use-now";
import { buildCartPreview } from "@/lib/cart-preview";
import { getCampus, getMenu, getRestaurant } from "@/lib/fixture-data";
import { cn } from "@/lib/utils";

/**
 * Phase 2 has no session. Flip this to see the COD-blocked layout, which must HIDE
 * the option entirely rather than show it disabled — a blocked student should not be
 * invited to try. Phase 6 replaces it with `user.codBlocked`.
 */
const MOCK_COD_BLOCKED = false;

export default function CheckoutPage() {
  const router = useRouter();
  const { cart } = useCart();
  const now = useNow(30_000);
  const { campusSlug, zoneId } = useDelivery();

  const [restaurant, setRestaurant] = useState<IRestaurant | null>(null);
  const [items, setItems] = useState<IMenuItem[] | null>(null);
  const [campus, setCampus] = useState<ICampus | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("ONLINE_100");

  useEffect(() => {
    if (cart.restaurantSlug === null || campusSlug === null) return;
    let active = true;
    void (async () => {
      const [found, loadedCampus] = await Promise.all([
        getRestaurant(cart.restaurantSlug ?? ""),
        getCampus(campusSlug),
      ]);
      if (!active) return;
      setRestaurant(found);
      setCampus(loadedCampus);
      if (found !== null) setItems((await getMenu(found._id)).items);
    })();
    return () => {
      active = false;
    };
  }, [cart.restaurantSlug, campusSlug]);

  useEffect(() => {
    if (cart.lines.length === 0) router.replace("/cart");
  }, [cart.lines.length, router]);

  if (restaurant === null || items === null || campus === null) {
    return (
      <main className="space-y-3 px-4 py-4" aria-busy="true" aria-label="Loading checkout">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  const nowMinutes = now === 0 ? null : minutesFromMidnightIn(new Date(now), campus.timezone);
  const preview = buildCartPreview(cart.lines, items, restaurant, campus, method);
  const zone = campus.zones.find((candidate) => candidate.zoneId === zoneId);
  const fallbackZone = campus.zones.find(
    (candidate) => candidate.zoneId === campus.settings.fallbackZoneId,
  );

  /**
   * F11 layer 1 — the binding curfew guard.
   *
   * Unlike the advisory check in the zone picker, this one uses the REAL restaurant's
   * prep time, because a restaurant is now chosen. It runs before payment is allowed:
   * an order that would arrive after the gate shuts cannot be completed at all, and
   * taking the money first would guarantee a refund and a hungry student.
   */
  const curfew =
    nowMinutes === null || zone === undefined
      ? null
      : checkCurfew({
          nowMinutes,
          curfewMinutes: zone.curfewMinutes,
          prepMinutes: restaurant.defaultPrepMinutes,
          transitMinutes: campus.settings.transitMinutes,
        });

  const isCurfewBlocked = curfew?.isBlocked === true;

  return (
    <main className="space-y-4 px-4 py-4 pb-28">
      <h1 className="text-lg font-bold">Checkout</h1>

      <section className="rounded-lg border p-3">
        <h2 className="text-muted-foreground text-xs tracking-wide uppercase">Delivering to</h2>
        <p className="font-medium">{zone?.name ?? "No delivery point chosen"}</p>
        {zone?.instructions ? (
          <p className="text-muted-foreground text-xs">{zone.instructions}</p>
        ) : null}
        {curfew !== null && zone?.curfewMinutes !== undefined && !isCurfewBlocked ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Arrives about {formatClock(curfew.estimatedArrivalMinutes)} · gate closes{" "}
            {formatClock(zone.curfewMinutes)}
          </p>
        ) : null}
      </section>

      {isCurfewBlocked && zone !== undefined && zone.curfewMinutes !== undefined ? (
        <div
          role="alert"
          className="border-status-failed/40 bg-status-failed/5 flex gap-3 rounded-lg border p-3"
        >
          <AlertTriangle className="text-status-failed mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-2 text-sm">
            <p className="font-medium">This gate closes too soon</p>
            <p className="text-muted-foreground text-xs">
              {curfewMessage(
                zone.name,
                zone.curfewMinutes,
                curfew,
                fallbackZone?.name ?? "the main gate",
              )}
            </p>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">How would you like to pay?</h2>
        <RadioGroup
          value={method}
          onValueChange={(value) => setMethod(value as PaymentMethod)}
          className="space-y-2"
        >
          <PaymentOption
            id="ONLINE_100"
            title="Pay online"
            description="Pay the full amount now. Nothing to hand over at the gate."
            amount={preview?.payNowPaise}
            isSelected={method === "ONLINE_100"}
          />

          {/**
           * COD is HIDDEN, not disabled, when the student is blocked.
           *
           * F9: a student who refused to pay cash has COD switched off immediately.
           * Showing a greyed option would invite the question "why?" at the worst
           * moment. The account is never banned — prepaid still works, and a student
           * who must prepay is a better customer than a lost one.
           */}
          {MOCK_COD_BLOCKED ? (
            <p className="text-muted-foreground flex gap-2 rounded-lg border border-dashed p-3 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Cash on delivery is unavailable on your account. You can still order by
              paying online.
            </p>
          ) : (
            <PaymentOption
              id="HYBRID_COD"
              title="Cash on delivery"
              description={
                preview === null
                  ? "Pay a small amount now, the rest in cash."
                  : `Pay a token now, then hand over exact cash at the gate.`
              }
              amount={preview?.payNowPaise}
              isSelected={method === "HYBRID_COD"}
            />
          )}
        </RadioGroup>
      </section>

      {preview === null ? null : (
        <section className="space-y-2 rounded-lg border p-3 text-sm">
          <Line label="Item total" amount={preview.subtotalPaise} />
          <Line label="Packaging" amount={preview.packagingFeePaise} />
          <Line label="Delivery" amount={preview.deliveryFeePaise} />
          <Line label="Payment charges" amount={preview.convenienceFeePaise} />
          <Separator />
          <Line label="Total" amount={preview.grandTotalPaise} bold />

          {method === "HYBRID_COD" ? (
            <div className="bg-muted/50 mt-2 space-y-1 rounded-md p-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Pay online now</span>
                <MoneyDisplay amountPaise={preview.payNowPaise} />
              </div>
              <div className="flex justify-between gap-2 font-medium">
                <span>Exact cash at the gate</span>
                <MoneyDisplay amountPaise={preview.cashAtGatePaise} />
              </div>
              <p className="text-muted-foreground pt-1">
                Riders carry no change. Please have the exact amount ready.
              </p>
            </div>
          ) : null}

          <p className="text-muted-foreground pt-1 text-xs">
            Payment charges are the gateway&rsquo;s fee and its GST. They are not
            refundable.
          </p>
        </section>
      )}

      <div className="bg-background fixed inset-x-0 bottom-14 z-30 mx-auto max-w-md border-t p-3">
        <Button className="touch-target w-full" disabled={isCurfewBlocked || preview === null}>
          {isCurfewBlocked ? (
            "Choose another gate to continue"
          ) : (
            <>
              Pay {preview === null ? null : <MoneyDisplay amountPaise={preview.payNowPaise} />}
            </>
          )}
        </Button>
        {/* Razorpay Checkout opens here in Phase 9. */}
        <p className="text-muted-foreground mt-2 text-center text-[10px]">
          Payments arrive in Phase 5 — this button is not wired yet.
        </p>
      </div>
    </main>
  );
}

function PaymentOption({
  id,
  title,
  description,
  amount,
  isSelected,
}: {
  id: string;
  title: string;
  description: string;
  amount?: Parameters<typeof MoneyDisplay>[0]["amountPaise"];
  isSelected: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        isSelected && "border-brand bg-brand/5",
      )}
    >
      <RadioGroupItem id={id} value={id} className="mt-1" />
      <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{title}</span>
          {isSelected && amount !== undefined ? (
            <MoneyDisplay amountPaise={amount} className="font-medium" />
          ) : null}
        </span>
        <span className="text-muted-foreground block text-xs">{description}</span>
      </Label>
    </div>
  );
}

function Line({
  label,
  amount,
  bold,
}: {
  label: string;
  amount: Parameters<typeof MoneyDisplay>[0]["amountPaise"];
  bold?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-2", bold === true && "font-semibold")}>
      <span className={bold === true ? "" : "text-muted-foreground"}>{label}</span>
      <MoneyDisplay amountPaise={amount} />
    </div>
  );
}
