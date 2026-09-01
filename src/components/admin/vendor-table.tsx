"use client";

import { Building2, CheckCircle2, Landmark, Loader2, Percent, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import {
  reviewVendorKyc,
  saveCommissionOverride,
  savePayoutDetails,
} from "@/server/actions/admin";
import { bpsToPct, pctToBps } from "@/lib/money";

export interface AdminVendorRow {
  restaurantId: string;
  name: string;
  campusName: string;
  ownerName: string;
  ownerPhone: string;
  gstin: string | null;
  fssai: string | null;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  isOpen: boolean;
  zoneCount: number;
  minOrderPaise: number;
  packagingFeePaise: number;
  commissionBpsOverride: number | null;
  campusCommissionBps: number;
  payout: { accountName: string; accountNumber: string; ifsc: string; upiId: string | null };
}

/**
 * The vendor list and the KYC queue.
 *
 * Approval is the switch that makes a restaurant visible to students at all,
 * so it is deliberately not a one-tap toggle in a table row: it opens a dialog
 * that shows the documents and demands a written reason either way. That
 * reason lands in the audit log, which is the only defence when a vendor
 * later asks why they were rejected.
 *
 * Bank details are captured here rather than by the vendor, because the payout
 * CSV is generated from them and a typo in an IFSC is a payment that vanishes
 * for a fortnight.
 */
export function AdminVendorTable({ vendors }: { vendors: AdminVendorRow[] }) {
  const pending = vendors.filter((vendor) => vendor.kycStatus === "PENDING");
  const rest = vendors.filter((vendor) => vendor.kycStatus !== "PENDING");

  if (vendors.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title="No restaurants yet"
          description="Run the seed, or onboard a canteen. Each one needs KYC approval before students can see it."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 ? (
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 font-display text-sm font-semibold text-bone">
            Waiting on KYC
            <Badge tone="warning">{pending.length}</Badge>
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((vendor) => (
              <VendorCard key={vendor.restaurantId} vendor={vendor} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2.5 font-display text-sm font-semibold text-bone">
          {pending.length > 0 ? "Everyone else" : "Restaurants"}
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {rest.map((vendor) => (
            <VendorCard key={vendor.restaurantId} vendor={vendor} />
          ))}
        </div>
      </section>
    </div>
  );
}

function VendorCard({ vendor }: { vendor: AdminVendorRow }) {
  const effectiveBps = vendor.commissionBpsOverride ?? vendor.campusCommissionBps;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-bone">{vendor.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {vendor.campusName} · {vendor.zoneCount} gate{vendor.zoneCount === 1 ? "" : "s"} served
          </p>
        </div>
        <KycBadge status={vendor.kycStatus} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <Field label="Owner" value={`${vendor.ownerName} · ${vendor.ownerPhone}`} />
        <Field label="FSSAI" value={vendor.fssai ?? "Not supplied"} />
        <Field label="GSTIN" value={vendor.gstin ?? "Not registered"} />
        <Field
          label="Commission"
          value={`${bpsToPct(effectiveBps)}%${vendor.commissionBpsOverride === null ? " (campus rate)" : " (override)"}`}
        />
        <Field label="Bank" value={vendor.payout.accountNumber ? `${vendor.payout.ifsc} ····${vendor.payout.accountNumber.slice(-4)}` : "Not captured"} />
        <Field
          label="Minimum order"
          value={<Money paise={vendor.minOrderPaise} />}
        />
      </dl>

      {vendor.kycStatus === "REJECTED" && vendor.rejectionReason ? (
        <p className="mt-3 rounded-lg border border-chili/30 bg-chili-wash px-2.5 py-2 text-xs text-chili">
          {vendor.rejectionReason}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <KycDialog vendor={vendor} />
        <CommissionDialog vendor={vendor} effectiveBps={effectiveBps} />
        <PayoutDialog vendor={vendor} />
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-faint">{label}</dt>
      <dd className="truncate text-bone">{value}</dd>
    </div>
  );
}

function KycBadge({ status }: { status: AdminVendorRow["kycStatus"] }) {
  if (status === "APPROVED") return <Badge tone="success">Approved</Badge>;
  if (status === "REJECTED") return <Badge tone="danger">Rejected</Badge>;
  return <Badge tone="warning">Pending</Badge>;
}

/* ------------------------------------------------------------------ */

function KycDialog({ vendor }: { vendor: AdminVendorRow }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (approve: boolean): Promise<void> => {
    setSubmitting(true);
    const result = await reviewVendorKyc({
      restaurantId: vendor.restaurantId,
      approve,
      reason: reason.trim().length >= 3 ? reason : approve ? "Documents verified" : reason,
    });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={vendor.kycStatus === "PENDING" ? "primary" : "secondary"}>
          {vendor.kycStatus === "PENDING" ? "Review KYC" : "Change KYC"}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vendor.name}</DialogTitle>
          <DialogDescription>
            Approving makes this restaurant visible to students immediately. Rejecting hides
            it and shows the owner your reason. Either way it is written to the audit log
            under your name.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-raised p-3 text-xs">
            <Field label="Owner" value={vendor.ownerName} />
            <Field label="Phone" value={vendor.ownerPhone} />
            <Field label="FSSAI licence" value={vendor.fssai ?? "Not supplied"} />
            <Field label="GSTIN" value={vendor.gstin ?? "Not registered"} />
          </dl>

          <div>
            <Label htmlFor={`kyc-reason-${vendor.restaurantId}`}>Reason</Label>
            <Textarea
              id={`kyc-reason-${vendor.restaurantId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Documents verified in person, FSSAI licence expired, …"
              maxLength={200}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3 || submitting}
            onClick={() => void submit(false)}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <XCircle />}
            Reject
          </Button>
          <Button variant="success" disabled={submitting} onClick={() => void submit(true)}>
            {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommissionDialog({
  vendor,
  effectiveBps,
}: {
  vendor: AdminVendorRow;
  effectiveBps: number;
}) {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(String(bpsToPct(effectiveBps)));
  const [submitting, setSubmitting] = useState(false);

  const save = async (useOverride: boolean): Promise<void> => {
    setSubmitting(true);
    const result = await saveCommissionOverride({
      restaurantId: vendor.restaurantId,
      commissionBpsOverride: useOverride ? pctToBps(Number(pct)) : null,
    });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Percent />
          Commission
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commission for {vendor.name}</DialogTitle>
          <DialogDescription>
            Charged on food, packaging and delivery combined. It is snapshotted onto every
            order at creation, so changing it here never rewrites an existing order.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Label htmlFor={`pct-${vendor.restaurantId}`}>Override (%)</Label>
          <Input
            id={`pct-${vendor.restaurantId}`}
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={30}
            value={pct}
            onChange={(event) => setPct(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted">
            Campus rate is {bpsToPct(vendor.campusCommissionBps)}%.
          </p>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" disabled={submitting} onClick={() => void save(false)}>
            Use the campus rate
          </Button>
          <Button disabled={submitting} onClick={() => void save(true)}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayoutDialog({ vendor }: { vendor: AdminVendorRow }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vendor.payout);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    const result = await savePayoutDetails({
      restaurantId: vendor.restaurantId,
      accountName: form.accountName,
      accountNumber: form.accountNumber,
      ifsc: form.ifsc.toUpperCase(),
      upiId: form.upiId && form.upiId.length > 0 ? form.upiId : null,
    });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Landmark />
          Bank
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payout details</DialogTitle>
          <DialogDescription>
            These go straight into the nightly CSV. A wrong IFSC is a payment that disappears
            for a fortnight, so check them against a cancelled cheque rather than a WhatsApp
            message.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div>
            <Label htmlFor={`acc-name-${vendor.restaurantId}`}>Account name</Label>
            <Input
              id={`acc-name-${vendor.restaurantId}`}
              value={form.accountName}
              onChange={(event) => setForm({ ...form, accountName: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`acc-no-${vendor.restaurantId}`}>Account number</Label>
            <Input
              id={`acc-no-${vendor.restaurantId}`}
              value={form.accountNumber}
              onChange={(event) => setForm({ ...form, accountNumber: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`ifsc-${vendor.restaurantId}`}>IFSC</Label>
            <Input
              id={`ifsc-${vendor.restaurantId}`}
              value={form.ifsc}
              onChange={(event) => setForm({ ...form, ifsc: event.target.value.toUpperCase() })}
              placeholder="SBIN0001234"
            />
          </div>
          <div>
            <Label htmlFor={`upi-${vendor.restaurantId}`}>UPI ID (optional)</Label>
            <Input
              id={`upi-${vendor.restaurantId}`}
              value={form.upiId ?? ""}
              onChange={(event) => setForm({ ...form, upiId: event.target.value })}
              placeholder="canteen@upi"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={submitting} onClick={() => void submit()}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
