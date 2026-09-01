"use client";

import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Money } from "@/components/shared/money";
import { saveCampusSettings } from "@/server/actions/admin";
import { bpsToPct, ceilRupeeOfBps, pctToBps, PAISE_PER_RUPEE } from "@/lib/money";

export interface PricingValues {
  deliveryFeePaise: number;
  commissionBps: number;
  gatewayFeeBps: number;
  codHandlingFeePaise: number;
  transitMinutes: number;
  vendorAckSeconds: number;
  vendorAutoExpireSeconds: number;
  gateGraceSeconds: number;
  curfewBufferMinutes: number;
  stockoutResolutionSeconds: number;
  disputeWindowMinutes: number;
  codEnabled: boolean;
}

/**
 * Per-campus pricing and timers.
 *
 * Every number here is snapshotted onto an order at creation, so editing this
 * screen changes tomorrow's orders and never rewrites yesterday's. That is
 * what makes it safe to tune during a launch week.
 *
 * The worked example at the bottom is not decoration. These fields interact —
 * the commission rounds up to a rupee, the convenience fee applies only to
 * what actually goes through the gateway, and COD charges the fee on the token
 * alone. Seeing a real 200-rupee order recalculate as you type is the only way
 * to be sure a rate change does what you meant.
 */
export function PricingForm({
  campusId,
  campusName,
  initial,
}: {
  campusId: string;
  campusName: string;
  initial: PricingValues;
}) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PricingValues>(key: K, value: PricingValues[K]): void =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async (): Promise<void> => {
    setSaving(true);
    const result = await saveCampusSettings({ campusId, ...values });
    setSaving(false);

    if (result.status === "error") toast.error(result.message);
    else toast.success(result.message);
  };

  return (
    <div className="max-w-3xl space-y-5">
      {/* ── Money ────────────────────────────────────────────────── */}
      <Card className="p-4">
        <h2 className="font-display text-sm font-semibold text-bone">Money</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          The delivery fee flows to the vendor in full. Commission is charged on food,
          packaging and delivery combined.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <RupeeField
            id="delivery"
            label="Delivery fee"
            paise={values.deliveryFeePaise}
            onChange={(paise) => set("deliveryFeePaise", paise)}
          />
          <PercentField
            id="commission"
            label="Commission"
            bps={values.commissionBps}
            onChange={(bps) => set("commissionBps", bps)}
            hint="10% is the launch rate"
          />
          <PercentField
            id="gateway"
            label="Convenience fee"
            bps={values.gatewayFeeBps}
            onChange={(bps) => set("gatewayFeeBps", bps)}
            hint="Pass-through to Razorpay. Never refunded — verify against your plan"
          />
          <RupeeField
            id="codfee"
            label="Cash handling fee"
            paise={values.codHandlingFeePaise}
            onChange={(paise) => set("codHandlingFeePaise", paise)}
            hint="Ships at zero. Raise it only if cash orders outgrow your riders"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-3.5 py-3">
          <div>
            <p className="text-sm font-medium text-bone">Cash on delivery</p>
            <p className="mt-0.5 text-xs text-muted">
              Campus-wide kill switch. Turning it off hides the cash option at every checkout.
            </p>
          </div>
          <Switch
            checked={values.codEnabled}
            onCheckedChange={(next) => set("codEnabled", next)}
            aria-label="Cash on delivery enabled"
          />
        </div>
      </Card>

      {/* ── The worked example ───────────────────────────────────── */}
      <WorkedExample values={values} />

      {/* ── Timers ───────────────────────────────────────────────── */}
      <Card className="p-4">
        <h2 className="font-display text-sm font-semibold text-bone">Timers</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          These decide how long anyone waits before the system acts on its own.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NumberField
            id="transit"
            label="Transit minutes to a gate"
            value={values.transitMinutes}
            onChange={(value) => set("transitMinutes", value)}
            hint="Feeds every ETA and the curfew guard"
          />
          <NumberField
            id="buffer"
            label="Curfew buffer (minutes)"
            value={values.curfewBufferMinutes}
            onChange={(value) => set("curfewBufferMinutes", value)}
            hint="An arrival inside this window of a curfew is refused"
          />
          <NumberField
            id="ack"
            label="Vendor acknowledgement (seconds)"
            value={values.vendorAckSeconds}
            onChange={(value) => set("vendorAckSeconds", value)}
            hint="When the countdown ring turns amber"
          />
          <NumberField
            id="expire"
            label="Auto-cancel (seconds)"
            value={values.vendorAutoExpireSeconds}
            onChange={(value) => set("vendorAutoExpireSeconds", value)}
            hint="Silence past this is a full refund. Must exceed the acknowledgement window"
          />
          <NumberField
            id="grace"
            label="Gate grace (seconds)"
            value={values.gateGraceSeconds}
            onChange={(value) => set("gateGraceSeconds", value)}
            hint="How long a rider waits before the packet goes to security"
          />
          <NumberField
            id="stockout"
            label="Stockout decision (seconds)"
            value={values.stockoutResolutionSeconds}
            onChange={(value) => set("stockoutResolutionSeconds", value)}
            hint="After this we drop the item and refund that line"
          />
          <NumberField
            id="dispute"
            label="Dispute window (minutes)"
            value={values.disputeWindowMinutes}
            onChange={(value) => set("disputeWindowMinutes", value)}
            hint="Long enough to open the bag, short enough that the food is still evidence"
          />
        </div>
      </Card>

      <Button size="lg" disabled={saving} onClick={() => void submit()}>
        {saving ? <Loader2 className="animate-spin" /> : <Save />}
        Save {campusName}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A live 200-rupee order, priced with the current form values.
 *
 * Mirrors `computePricing` exactly: commission ceils to a rupee, the vendor
 * takes the remainder, and the convenience fee applies to whatever actually
 * reaches the gateway — the whole total when prepaid, the commission token
 * alone when cash. It is a preview, never the source of truth; the server
 * recomputes every real order.
 */
function WorkedExample({ values }: { values: PricingValues }) {
  const subtotal = 200 * PAISE_PER_RUPEE;
  const packaging = 10 * PAISE_PER_RUPEE;
  const base = subtotal + packaging + values.deliveryFeePaise;

  const commission = ceilRupeeOfBps(base, values.commissionBps);
  const receivable = base - commission;

  const prepaidFee = ceilRupeeOfBps(base, values.gatewayFeeBps);
  const codToken = commission + values.codHandlingFeePaise;
  const codFee = ceilRupeeOfBps(codToken, values.gatewayFeeBps);

  return (
    <Card className="p-4">
      <h2 className="font-display text-sm font-semibold text-bone">
        A ₹200 order, priced right now
      </h2>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">Prepaid</p>
          <Line label="Commission base" paise={base} />
          <Line label="TREFOOD commission" paise={commission} />
          <Line label="Vendor receives" paise={receivable} strong />
          <Line label="Convenience fee" paise={prepaidFee} />
          <Line label="Student pays" paise={base + prepaidFee} strong />
        </div>

        <div className="rounded-xl border border-line p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">
            Cash at the gate
          </p>
          <Line label="Online token" paise={codToken} />
          <Line label="Convenience fee" paise={codFee} />
          <Line label="Paid online" paise={codToken + codFee} strong />
          <Line label="Cash to the rider" paise={receivable} strong />
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            The token is the commission and the cash is the receivable, so a cash order needs
            no settlement at all.
          </p>
        </div>
      </div>
    </Card>
  );
}

function Line({ label, paise, strong }: { label: string; paise: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className={strong ? "font-medium text-bone" : "text-muted"}>{label}</span>
      <Money paise={paise} className={strong ? "font-semibold text-bone" : "text-bone"} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RupeeField({
  id,
  label,
  paise,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  paise: number;
  onChange: (paise: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label} (rupees)</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={paise / PAISE_PER_RUPEE}
        onChange={(event) => {
          // Whole rupees only: every student-facing amount is one by rule (A4),
          // so truncation is the correct operation rather than a shortcut.
          const rupees = Math.trunc(Number(event.target.value));
          onChange(Number.isFinite(rupees) && rupees >= 0 ? rupees * PAISE_PER_RUPEE : 0);
        }}
      />
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-faint">{hint}</p> : null}
    </div>
  );
}

function PercentField({
  id,
  label,
  bps,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  bps: number;
  onChange: (bps: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label} (%)</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        max={30}
        value={bpsToPct(bps)}
        onChange={(event) => onChange(pctToBps(Number(event.target.value)))}
      />
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-faint">{hint}</p> : null}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(event) => onChange(Math.trunc(Number(event.target.value)))}
      />
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-faint">{hint}</p> : null}
    </div>
  );
}
