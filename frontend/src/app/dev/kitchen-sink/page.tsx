import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  codOrderAtGate,
  formatINR,
  menuItems,
  nitPatnaCampus,
  ordersByStatus,
  paise,
  restaurants,
  rupees,
  studentView,
  type OrderStatus,
} from "@trefood/shared";

import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  GateCodeDisplay,
  MoneyDisplay,
  OrderTrackerSkeleton,
  RestaurantListSkeleton,
  StatusStepper,
  VegMark,
} from "@/components/shared";

/**
 * The Phase 1 exit gate, made visible.
 *
 * Renders every shared primitive and every one of the FSM's order states from typed
 * fixtures. Its job is to prove — by eye, on a real phone — that the design system
 * and the fixtures are complete before Phase 2 starts drawing actual screens.
 *
 * Delete this route when the student PWA is real, or keep it as a visual regression
 * surface. It has no backend dependency at all.
 */
export const dynamic = "force-static";

function Section({ title, note, children }: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {note ? <p className="text-muted-foreground text-sm">{note}</p> : null}
      </div>
      <div className="rounded-lg border p-4">{children}</div>
    </section>
  );
}

export default function KitchenSinkPage() {
  const prepaid = ordersByStatus.DELIVERED;

  return (
    <main className="mx-auto max-w-2xl space-y-10 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">TREFOOD kitchen sink</h1>
        <p className="text-muted-foreground text-sm">
          Every shared primitive and every order state, from fixtures. No backend.
        </p>
      </header>

      <Section
        title="Money"
        note="Integer paise in, formatted rupees out. Indian digit grouping."
      >
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Grand total (prepaid)", prepaid.pricing.grandTotalPaise],
            ["Commission base", prepaid.pricing.commissionBasePaise],
            ["Platform commission", prepaid.pricing.platformCommissionPaise],
            ["Vendor receivable", prepaid.pricing.vendorReceivablePaise],
            ["Convenience fee", prepaid.pricing.convenienceFeePaise],
            ["Refundable", prepaid.pricing.refundableAmountPaise],
            ["COD cash at gate", codOrderAtGate.payment.cashDueOnDeliveryPaise],
            ["COD paid online", codOrderAtGate.payment.onlinePaidPaise],
          ].map(([label, amount]) => (
            <div key={String(label)} className="contents">
              <dt className="text-muted-foreground">{String(label)}</dt>
              <dd className="text-right font-medium">
                <MoneyDisplay amountPaise={amount as never} />
              </dd>
            </div>
          ))}
          <dt className="text-muted-foreground">Refund micro-example</dt>
          <dd className="text-right font-medium">
            {/* Paid ₹3.18, refunded ₹3.00 — the ₹0.18 is Razorpay's cut plus GST. */}
            <MoneyDisplay amountPaise={paise(318)} /> →{" "}
            <MoneyDisplay amountPaise={paise(300)} />
          </dd>
          <dt className="text-muted-foreground">Ledger debit (D3)</dt>
          <dd className="text-right font-medium">
            <MoneyDisplay amountPaise={paise(-531)} signed />
          </dd>
          <dt className="text-muted-foreground">Indian grouping</dt>
          <dd className="text-right font-medium">
            <MoneyDisplay amountPaise={rupees(1_234_567)} />
          </dd>
        </dl>
      </Section>

      <Section
        title="Veg marks"
        note="FSSAI convention. Read before the item name by most diners."
      >
        <ul className="space-y-2 text-sm">
          {menuItems.slice(0, 5).map((item) => (
            <li key={item._id} className="flex items-center gap-2">
              <VegMark isVeg={item.isVeg} />
              <span className={item.isAvailable ? "" : "text-muted-foreground line-through"}>
                {item.name}
              </span>
              <span className="text-muted-foreground ml-auto">
                {formatINR(item.pricePaise)}
              </span>
              {!item.isAvailable ? (
                <span className="text-status-failed text-xs">86ed</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">
          Unavailable items are struck through, never hidden — a student should see the
          dish exists and is out today.
        </p>
      </Section>

      <Section
        title="Gate code"
        note="Read outdoors, at 1 AM, at arm's length, on a cracked screen."
      >
        <GateCodeDisplay code={ordersByStatus.AT_GATE.gateCode ?? "0000"} />
        <p className="text-muted-foreground mt-3 text-xs">
          Absent from the student&rsquo;s payload until AT_GATE. Below: what the student
          actually receives at each status.
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          {(["PREPARING", "READY", "OUT_FOR_DELIVERY", "AT_GATE"] as OrderStatus[]).map(
            (status) => {
              const view = studentView(ordersByStatus[status]);
              return (
                <li key={status} className="flex gap-2">
                  <code className="text-muted-foreground w-40">{status}</code>
                  <code>{view.gateCode ?? "— field absent —"}</code>
                </li>
              );
            },
          )}
        </ul>
      </Section>

      <Section
        title="Status stepper"
        note="Every one of the 18 FSM states. No map, no moving dot — riders carry no device."
      >
        <div className="space-y-6">
          {ORDER_STATUSES.map((status) => (
            <div key={status} className="space-y-2">
              <p className="text-muted-foreground text-xs">
                <code>{status}</code> — {ORDER_STATUS_LABELS[status]}
              </p>
              <StatusStepper status={status} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Restaurants" note="Open first, closed greyed at the bottom.">
        <ul className="space-y-2 text-sm">
          {[...restaurants]
            .sort((a, b) => Number(b.isOpen) - Number(a.isOpen))
            .map((restaurant) => (
              <li
                key={restaurant._id}
                className={restaurant.isOpen ? "" : "text-muted-foreground opacity-60"}
              >
                <span className="font-medium">{restaurant.name}</span>{" "}
                <span className="text-muted-foreground">
                  · {restaurant.cuisine.join(", ")} · {restaurant.defaultPrepMinutes} min · min{" "}
                  {formatINR(restaurant.minOrderPaise)}
                  {restaurant.isOpen ? "" : " · Closed"}
                </span>
                <span className="text-muted-foreground block text-xs">
                  serves {restaurant.servedZoneIds.length} of {nitPatnaCampus.zones.length} zones
                </span>
              </li>
            ))}
        </ul>
      </Section>

      <Section title="Delivery zones" note="Curfews are minutes from midnight, campus-local.">
        <ul className="space-y-1 text-sm">
          {nitPatnaCampus.zones.map((zone) => {
            const curfew =
              zone.curfewMinutes === undefined
                ? "24×7"
                : `closes ${String(Math.floor(zone.curfewMinutes / 60)).padStart(2, "0")}:${String(
                    zone.curfewMinutes % 60,
                  ).padStart(2, "0")}`;
            return (
              <li key={zone.zoneId} className="flex justify-between gap-4">
                <span>{zone.name}</span>
                <span className="text-muted-foreground shrink-0">{curfew}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Empty, error and loading states" note="Built now so no phase can skip them.">
        <div className="space-y-6">
          <EmptyState
            title="No orders yet"
            description="Your past orders will appear here once you place your first one."
            action={<Button className="touch-target">Browse restaurants</Button>}
          />
          <ErrorState />
          <RestaurantListSkeleton rows={2} />
          <OrderTrackerSkeleton />
        </div>
      </Section>

      <Section title="Touch targets" note="44×44 CSS pixels minimum. Used one-handed, walking, at night.">
        <div className="flex items-center gap-3">
          <Button className="touch-target">Confirm Received</Button>
          <span className="bg-brand/20 ring-brand/40 touch-target inline-flex items-center justify-center rounded ring-1 text-xs">
            44×44
          </span>
        </div>
      </Section>
    </main>
  );
}
