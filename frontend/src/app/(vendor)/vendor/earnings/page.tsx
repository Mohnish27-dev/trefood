"use client";

import { Download } from "lucide-react";
import { addPaise, negatePaise, paise, rupees, subtractPaise } from "@trefood/shared";

import { MoneyDisplay } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/**
 * The vendor's daily statement.
 *
 * Two things must be legible here, because they are what a vendor argues about:
 *
 *   1. **Where the commission went.** Shown as an explicit deduction, not folded into
 *      a net figure.
 *   2. **Why a ledger adjustment exists.** Every line carries its reason. The
 *      REFUND_GATEWAY_RECOVERY debit is the one that surprises people: on a
 *      vendor-fault refund Razorpay keeps its fee, and that loss is charged back here
 *      (D3). It is exactly the incentive intended — rejecting freely costs money —
 *      but only if the vendor can see it and understand it.
 *
 * COD orders contribute ₹0. They settled themselves at the gate: the token was the
 * commission and the cash was the receivable, so nobody owes anybody anything.
 */
const MOCK = {
  prepaidCount: 12,
  codCount: 7,
  grossPrepaid: rupees(2424),
  commission: rupees(276),
  adjustments: [
    {
      id: "adj-1",
      type: "REFUND_GATEWAY_RECOVERY",
      amount: negatePaise(paise(531)),
      note: "Gateway fee not returned on refund of TRF-NITP-8903",
    },
  ],
};

export default function VendorEarningsPage() {
  const adjustmentsTotal = addPaise(...MOCK.adjustments.map((entry) => entry.amount));
  const netPayable = addPaise(MOCK.grossPrepaid, adjustmentsTotal);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Earnings</h1>
          <p className="text-muted-foreground text-sm">Today, 1 September 2026</p>
        </div>
        <Button variant="outline" size="sm" className="touch-target">
          <Download className="size-4" aria-hidden />
          Statement
        </Button>
      </div>

      <section className="space-y-2 rounded-lg border p-4 text-sm">
        <Line
          label={`Prepaid orders (${MOCK.prepaidCount})`}
          amount={addPaise(MOCK.grossPrepaid, MOCK.commission)}
        />
        <Line
          label="Platform commission (10%)"
          amount={negatePaise(MOCK.commission)}
          muted
        />
        <Separator />
        <Line label="Your share of prepaid orders" amount={MOCK.grossPrepaid} bold />
      </section>

      <section className="space-y-2 rounded-lg border p-4 text-sm">
        <h2 className="font-medium">Adjustments</h2>
        {MOCK.adjustments.length === 0 ? (
          <p className="text-muted-foreground text-xs">None today.</p>
        ) : (
          <ul className="space-y-2">
            {MOCK.adjustments.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground text-xs">{entry.note}</span>
                <MoneyDisplay amountPaise={entry.amount} signed className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">Net payable to you</span>
          <span className="text-2xl font-bold">
            <MoneyDisplay amountPaise={netPayable} />
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Paid by bank transfer after tonight&rsquo;s settlement run. Amounts under ₹100
          roll into the next payout.
        </p>
      </section>

      <section className="rounded-lg border border-dashed p-4 text-sm">
        <h2 className="font-medium">Cash on delivery ({MOCK.codCount} orders)</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Already settled — you kept the cash at the gate, and TREFOOD kept the token
          paid online. Nothing is owed in either direction, so these add{" "}
          <MoneyDisplay amountPaise={subtractPaise(rupees(0), rupees(0))} /> to this
          payout.
        </p>
      </section>

      <p className="text-muted-foreground text-xs">
        Real figures arrive with the settlement engine in Phase 9. This is placeholder
        data.
      </p>
    </main>
  );
}

function Line({
  label,
  amount,
  bold,
  muted,
}: {
  label: string;
  amount: Parameters<typeof MoneyDisplay>[0]["amountPaise"];
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-2 ${bold === true ? "font-semibold" : ""}`}>
      <span className={muted === true ? "text-muted-foreground" : ""}>{label}</span>
      <MoneyDisplay amountPaise={amount} signed />
    </div>
  );
}
