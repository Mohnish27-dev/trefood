"use client";

import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  Loader2,
  Percent,
  Phone,
  Plus,
  Power,
  PowerOff,
  Receipt,
  RefreshCw,
  Share2,
  Store,
  Ticket,
  Trash2,
  UtensilsCrossed,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  deleteVendorAccount,
  linkVendorAccountAction,
  resetVendorPasswordAction,
  reviewVendorKyc,
  saveCommissionOverride,
  savePayoutDetails,
  savePlatformFee,
  saveVendorPhones,
  toggleRestaurantOpenAction,
  toggleRestaurantDineInAction,
} from "@/server/actions/admin";
import { bpsToPct, pctToBps } from "@/lib/money";
import { MAX_RESTAURANT_PHONES, PHONE_PATTERN } from "@/lib/restaurant-phones";
import { AddVendorDialog, type CampusOption } from "@/components/admin/add-vendor-dialog";
import { ReorderRestaurantsDialog } from "@/components/admin/reorder-restaurants-dialog";
import { getRestaurantDisplayPriority } from "@/lib/restaurant-order";

export interface AdminVendorRow {
  restaurantId: string;
  name: string;
  slug: string;
  isApproved: boolean;
  displayOrder: number | null | undefined;
  campusName: string;
  ownerName: string;
  ownerPhone: string;
  /** Linked vendor login email (null for co-admins or restaurants without a linked user). */
  vendorEmail?: string | null;
  /** Whether a vendor user account is linked to this restaurant. */
  hasVendorAccount?: boolean;
  /** Contact numbers students and TREFOOD call, primary first. Admin-managed only. */
  phones: string[];
  gstin: string | null;
  fssai: string | null;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  isOpen: boolean;
  adminClosed?: boolean;
  isDineInAvailable?: boolean;
  zoneCount: number;
  minOrderPaise: number;
  packagingFeePaise: number;
  commissionBpsOverride: number | null;
  campusCommissionBps: number;
  /** TREFOOD platform fee, between admin and vendor only. 0 when none. */
  platformFeePaise: number;
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
export function AdminVendorTable({
  vendors,
  campuses = [],
  canManage = true,
}: {
  vendors: AdminVendorRow[];
  campuses?: CampusOption[];
  /**
   * False for co-admins, who get a view-only list. Their rows arrive with KYC,
   * commission, fee and bank fields already blanked by the server; this hides
   * the empty slots and every control, whose actions would refuse them anyway.
   */
  canManage?: boolean;
}) {
  const pending = vendors.filter((vendor) => vendor.kycStatus === "PENDING");
  const rest = vendors.filter((vendor) => vendor.kycStatus !== "PENDING");

  const reorderableRestaurants = vendors
    .filter((v) => v.isApproved)
    .map((v) => ({
      id: v.restaurantId,
      name: v.name,
      campusName: v.campusName,
      slug: v.slug,
      displayOrder: v.displayOrder,
      isOpen: v.isOpen,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-bone">Restaurants &amp; Vendors</h1>
          <p className="mt-1 text-sm text-muted">
            Onboard new campus restaurants with vendor login credentials, manage menus, and monitor operations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canManage && reorderableRestaurants.length > 0 ? (
            <ReorderRestaurantsDialog restaurants={reorderableRestaurants} />
          ) : null}
          {canManage ? <AddVendorDialog campuses={campuses} triggerLabel="Add Restaurant" /> : null}
        </div>
      </div>

      {vendors.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Building2}
            title="No restaurants yet"
            description="Onboard a new canteen with vendor login credentials using the button below."
            action={canManage ? <AddVendorDialog campuses={campuses} triggerLabel="Add First Restaurant" /> : undefined}
          />
        </Card>
      ) : (
        <>
          {pending.length > 0 ? (
            <section>
              <h2 className="mb-2.5 flex items-center gap-2 font-display text-sm font-semibold text-bone">
                Waiting on KYC
                <Badge tone="warning">{pending.length}</Badge>
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {pending.map((vendor) => (
                  <VendorCard key={vendor.restaurantId} vendor={vendor} canManage={canManage} />
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
                <VendorCard key={vendor.restaurantId} vendor={vendor} canManage={canManage} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function VendorCard({ vendor, canManage }: { vendor: AdminVendorRow; canManage: boolean }) {
  const effectiveBps = vendor.commissionBpsOverride ?? vendor.campusCommissionBps;
  const [isOpen, setIsOpen] = useState(vendor.isOpen);
  const [isAdminClosed, setIsAdminClosed] = useState(Boolean(vendor.adminClosed));
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [isDineIn, setIsDineIn] = useState(Boolean(vendor.isDineInAvailable));
  const [togglingDineIn, setTogglingDineIn] = useState(false);

  const handleToggleDineIn = async () => {
    const nextState = !isDineIn;
    setTogglingDineIn(true);
    setIsDineIn(nextState);

    const res = await toggleRestaurantDineInAction({
      restaurantId: vendor.restaurantId,
      isDineIn: nextState,
    });

    if (res.status === "error") {
      setIsDineIn(!nextState);
      toast.error(res.message);
    } else {
      toast.success(res.message);
    }
    setTogglingDineIn(false);
  };

  const handleToggleOpen = async () => {
    const nextState = !isOpen;
    setTogglingOpen(true);
    setIsOpen(nextState);
    setIsAdminClosed(!nextState);

    const res = await toggleRestaurantOpenAction({
      restaurantId: vendor.restaurantId,
      isOpen: nextState,
    });

    if (res.status === "error") {
      setIsOpen(!nextState);
      setIsAdminClosed(Boolean(vendor.adminClosed));
      toast.error(res.message);
    } else {
      toast.success(res.message);
    }
    setTogglingOpen(false);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-bone">{vendor.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {vendor.campusName} · {vendor.zoneCount} gate{vendor.zoneCount === 1 ? "" : "s"} served
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {vendor.isApproved ? (
            <span className="inline-flex items-center rounded-md border border-line bg-surface-raised px-2 py-0.5 text-[11px] font-mono font-semibold text-bone">
              Rank #{getRestaurantDisplayPriority(vendor)}
            </span>
          ) : null}
          {isDineIn ? (
            <Badge tone="accent" className="gap-1">
              <UtensilsCrossed className="size-3" />
              Dine In
            </Badge>
          ) : null}
          {isOpen ? (
            <Badge tone="success">Open</Badge>
          ) : isAdminClosed ? (
            <Badge tone="danger">Closed by Admin</Badge>
          ) : (
            <Badge tone="warning">Closed</Badge>
          )}
          <KycBadge status={vendor.kycStatus} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <Field
          label="Owner"
          value={canManage ? `${vendor.ownerName} · ${vendor.ownerPhone}` : vendor.ownerName}
        />
        <Field
          label={vendor.phones.length === 1 ? "Phone" : `Phones (${vendor.phones.length})`}
          value={vendor.phones.length > 0 ? vendor.phones.join(", ") : "None"}
        />
        {canManage ? (
          <div className="min-w-0 col-span-2 rounded-lg border border-line/60 bg-surface-raised/40 px-2.5 py-1.5 my-0.5">
            <dt className="text-[10px] uppercase tracking-wider text-faint">Vendor Login ID</dt>
            <dd className="truncate text-bone flex items-center justify-between gap-2 mt-0.5">
              {vendor.vendorEmail ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-semibold text-saffron truncate">
                    {vendor.vendorEmail}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(vendor.vendorEmail!);
                      toast.success("Vendor login email copied!");
                    }}
                    className="p-0.5 text-muted hover:text-bone rounded transition-colors shrink-0"
                    title="Copy vendor login email"
                  >
                    <Copy className="size-3" />
                  </button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                  <span>No vendor login linked</span>
                </span>
              )}
            </dd>
          </div>
        ) : null}
        {canManage ? (
          <>
            <Field label="FSSAI" value={vendor.fssai ?? "Not supplied"} />
            <Field label="GSTIN" value={vendor.gstin ?? "Not registered"} />
            <Field
              label="Commission"
              value={`${bpsToPct(effectiveBps)}%${vendor.commissionBpsOverride === null ? " (campus rate)" : " (override)"}`}
            />
            <Field label="Bank" value={vendor.payout.accountNumber ? `${vendor.payout.ifsc} ····${vendor.payout.accountNumber.slice(-4)}` : "Not captured"} />
          </>
        ) : null}
        <Field
          label="Minimum order"
          value={<Money paise={vendor.minOrderPaise} />}
        />
        {canManage ? (
          <Field
            label="Platform fee"
            value={vendor.platformFeePaise > 0 ? <Money paise={vendor.platformFeePaise} /> : "None"}
          />
        ) : null}
      </dl>

      {vendor.kycStatus === "REJECTED" && vendor.rejectionReason ? (
        <p className="mt-3 rounded-lg border border-chili/30 bg-chili-wash px-2.5 py-2 text-xs text-chili">
          {vendor.rejectionReason}
        </p>
      ) : null}

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={togglingOpen}
              onClick={handleToggleOpen}
              className={cn(
                "gap-1.5 transition-colors",
                isOpen
                  ? "text-chili border-chili/30 hover:bg-chili/10 hover:border-chili/50"
                  : "text-mint border-mint/30 hover:bg-mint/10 hover:border-mint/50",
              )}
              title={
                isOpen
                  ? "Turn off canteen (vendor will not be able to turn it on)"
                  : "Turn on canteen"
              }
            >
              {togglingOpen ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isOpen ? (
                <PowerOff className="size-3.5 text-chili" />
              ) : (
                <Power className="size-3.5 text-mint" />
              )}
              {isOpen ? "Turn Off" : "Turn On"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={togglingDineIn}
              onClick={handleToggleDineIn}
              className={cn(
                "gap-1.5 transition-colors",
                isDineIn
                  ? "text-mint border-mint/30 hover:bg-mint/10 hover:border-mint/50"
                  : "text-muted border-line hover:bg-surface-raised",
              )}
              title={isDineIn ? "Disable Dine-in for this restaurant" : "Enable Dine-in for this restaurant"}
            >
              {togglingDineIn ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UtensilsCrossed className={cn("size-3.5", isDineIn ? "text-mint" : "text-muted")} />
              )}
              {isDineIn ? "Dine In: ON" : "Dine In: OFF"}
            </Button>
            <VendorCredentialsDialog vendor={vendor} />
            <KycDialog vendor={vendor} />
            <CommissionDialog vendor={vendor} effectiveBps={effectiveBps} />
            <PlatformFeeDialog vendor={vendor} />
            <PayoutDialog vendor={vendor} />
            <PhonesDialog vendor={vendor} />
            <Button asChild size="sm" variant="secondary" className="gap-1.5">
              <Link href={`/admin/vendors/${vendor.restaurantId}/menu`}>
                <UtensilsCrossed className="size-3.5 text-saffron" />
                Manage Menu
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary" className="gap-1.5">
              <Link href={`/admin/vendors/${vendor.restaurantId}/coupons`}>
                <Ticket className="size-3.5 text-saffron" />
                Add Coupon
              </Link>
            </Button>
          </div>
          <DeleteVendorDialog vendor={vendor} />
        </div>
      ) : null}
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

function PlatformFeeDialog({ vendor }: { vendor: AdminVendorRow }) {
  const [open, setOpen] = useState(false);
  const [rupees, setRupees] = useState(String(vendor.platformFeePaise / 100));
  const [submitting, setSubmitting] = useState(false);

  const value = Number(rupees);
  const valid =
    rupees.trim() !== "" && Number.isInteger(value) && value >= 0 && value <= 1_00_000;

  const save = async (feeRupees: number): Promise<void> => {
    setSubmitting(true);
    const result = await savePlatformFee({
      restaurantId: vendor.restaurantId,
      platformFeePaise: feeRupees * 100,
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening starts from the saved value, not a half-typed one.
        if (next) setRupees(String(vendor.platformFeePaise / 100));
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Receipt />
          Platform Fee
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Platform fee for {vendor.name}</DialogTitle>
          <DialogDescription>
            The TREFOOD platform fee for this vendor. It is shown on the vendor&apos;s
            Earnings dashboard only — students never see it and it is not added to any order.
            You can change it at any time.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Label htmlFor={`platform-fee-${vendor.restaurantId}`}>Platform fee (₹)</Label>
          <Input
            id={`platform-fee-${vendor.restaurantId}`}
            type="number"
            inputMode="numeric"
            step="1"
            min={0}
            max={100000}
            value={rupees}
            onChange={(event) => setRupees(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted">
            Whole rupees. Set ₹0 for no platform fee.
          </p>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={submitting || vendor.platformFeePaise === 0}
            onClick={() => void save(0)}
          >
            Remove fee
          </Button>
          <Button disabled={submitting || !valid} onClick={() => void save(value)}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Save
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

/**
 * The only place a restaurant's contact numbers change. The vendor sees them
 * on their settings page but cannot edit them, so a number students call is
 * always one TREFOOD has checked. The first is the primary: it is the one
 * snapshotted onto new orders.
 */
function PhonesDialog({ vendor }: { vendor: AdminVendorRow }) {
  const [open, setOpen] = useState(false);
  const [phones, setPhones] = useState<string[]>(vendor.phones);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = phones.map((phone) => phone.trim());
  const valid =
    trimmed.length > 0 &&
    trimmed.every((phone) => PHONE_PATTERN.test(phone)) &&
    new Set(trimmed).size === trimmed.length;

  const update = (index: number, value: string): void =>
    setPhones((prev) => prev.map((phone, i) => (i === index ? value : phone)));
  const remove = (index: number): void =>
    setPhones((prev) => prev.filter((_, i) => i !== index));
  const makePrimary = (index: number): void =>
    setPhones((prev) => [...prev.filter((_, i) => i === index), ...prev.filter((_, i) => i !== index)]);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    const result = await saveVendorPhones({ restaurantId: vendor.restaurantId, phones: trimmed });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening starts from the saved numbers, not a half-edited list.
        if (next) setPhones(vendor.phones.length > 0 ? vendor.phones : [""]);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Phone />
          Phones
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Phone numbers for {vendor.name}</DialogTitle>
          <DialogDescription>
            Students and TREFOOD call these. The vendor can see them but cannot change them.
            The primary number is the one printed on new orders; orders already placed keep
            the number they had.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-2">
          {phones.map((phone, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                aria-label={`Phone ${index + 1}`}
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => update(index, event.target.value)}
                placeholder="9876543210"
                className="flex-1"
              />
              {index === 0 ? (
                <Badge tone="success">Primary</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => makePrimary(index)}
                  title="Make this the primary number"
                >
                  Make primary
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={phones.length === 1}
                onClick={() => remove(index)}
                className="text-muted hover:text-chili"
                title="Remove this number"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}

          <Button
            size="sm"
            variant="secondary"
            disabled={phones.length >= MAX_RESTAURANT_PHONES}
            onClick={() => setPhones((prev) => [...prev, ""])}
          >
            <Plus />
            Add number
          </Button>
          <p className="text-xs text-muted">
            10 to 15 digits, optional leading +. Up to {MAX_RESTAURANT_PHONES} numbers, no duplicates.
          </p>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={submitting || !valid} onClick={() => void submit()}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteVendorDialog({ vendor }: { vendor: AdminVendorRow }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async (): Promise<void> => {
    setSubmitting(true);
    const result = await deleteVendorAccount({ restaurantId: vendor.restaurantId });
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
        <Button
          size="sm"
          variant="ghost"
          className="text-muted hover:text-chili hover:bg-chili-wash/30"
          title="Delete restaurant and vendor account"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {vendor.name}?</DialogTitle>
          <DialogDescription>
            This will permanently remove this restaurant, all of its menu items and categories,
            and the linked vendor account. This action is irreversible.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={submitting} onClick={() => void handleDelete()}>
            {submitting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Delete Restaurant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VendorCredentialsDialog({ vendor }: { vendor: AdminVendorRow }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(vendor.vendorEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [savedCredentials, setSavedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const isLinking = !vendor.hasVendorAccount;

  const handleGenerate = () => {
    const prefixes = ["Chef", "Taste", "Spice", "Canteen", "Kitchen", "Bhojan", "Trefood"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    const pwd = `${prefix}@${num}`;
    setNewPassword(pwd);
    setShowPassword(true);
    toast.info("Generated a secure password");
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success(`${label} copied!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleCopyFullMessage = async () => {
    if (!savedCredentials) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://trefood.in";
    const loginUrl = `${origin}/signin?tab=vendor`;

    const msg = `🍽️ *TREFOOD Vendor Portal Credentials*
━━━━━━━━━━━━━━━━━━━━━
🏪 *Restaurant:* ${vendor.name}
🔗 *Vendor Login URL:* ${loginUrl}
📧 *Login Email:* ${savedCredentials.email}
🔑 *Password:* ${savedCredentials.password}
━━━━━━━━━━━━━━━━━━━━━
Sign in to view live orders, prepare KOTs, update menu availability, and manage daily operations.`;

    await handleCopy(msg, "Full credentials message");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isLinking) {
        const res = await linkVendorAccountAction({
          restaurantId: vendor.restaurantId,
          email,
          password: newPassword,
          ownerName: vendor.ownerName,
          phone: vendor.ownerPhone,
        });

        if (res.status === "error") {
          toast.error(res.message);
          setSubmitting(false);
          return;
        }

        setSavedCredentials({
          email: res.credentials?.email || email,
          password: res.credentials?.password || newPassword,
        });
        toast.success(res.message);
      } else {
        const res = await resetVendorPasswordAction({
          restaurantId: vendor.restaurantId,
          newPassword,
        });

        if (res.status === "error") {
          toast.error(res.message);
          setSubmitting(false);
          return;
        }

        setSavedCredentials({
          email: vendor.vendorEmail || email,
          password: newPassword,
        });
        toast.success(res.message);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update vendor credentials");
    } finally {
      setSubmitting(false);
    }
  };

  const resetState = () => {
    setNewPassword("");
    setShowPassword(false);
    setEmail(vendor.vendorEmail || "");
    setSavedCredentials(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5 text-saffron border-saffron/30 hover:border-saffron/60 hover:bg-saffron-wash/30"
          title="Manage vendor login credentials and password"
        >
          <KeyRound className="size-3.5 text-saffron" />
          <span>{isLinking ? "Setup Login" : "Credentials"}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-saffron" />
            <span>{isLinking ? "Setup Vendor Login" : "Vendor Credentials"}</span>
          </DialogTitle>
          <DialogDescription>
            {isLinking
              ? `Create vendor login credentials for ${vendor.name} so they can access their dashboard.`
              : `View or reset login credentials for ${vendor.name}.`}
          </DialogDescription>
        </DialogHeader>

        {savedCredentials ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-mint/30 bg-mint-wash/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-mint">
                <CheckCircle2 className="size-4" />
                <span>Credentials Updated Successfully!</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-muted">Login URL</span>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[11px] font-mono text-saffron">/signin?tab=vendor</code>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          `${typeof window !== "undefined" ? window.location.origin : ""}/signin?tab=vendor`,
                          "Sign-in link",
                        )
                      }
                      className="p-1 text-muted hover:text-bone"
                    >
                      {copiedField === "Sign-in link" ? (
                        <Check className="size-3 text-mint" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-muted">Login Email</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-medium text-bone">
                      {savedCredentials.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(savedCredentials.email, "Email")}
                      className="p-1 text-muted hover:text-bone"
                    >
                      {copiedField === "Email" ? (
                        <Check className="size-3 text-mint" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted">Password</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-medium text-bone">
                      {showPassword ? savedCredentials.password : "••••••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-muted hover:text-bone"
                    >
                      {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(savedCredentials.password, "Password")}
                      className="p-1 text-muted hover:text-bone"
                    >
                      {copiedField === "Password" ? (
                        <Check className="size-3 text-mint" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleCopyFullMessage}
              className="w-full gap-2 text-xs"
            >
              {copiedField === "Full credentials message" ? (
                <>
                  <Check className="size-3.5" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Share2 className="size-3.5" />
                  <span>Copy Full Message for Vendor (WhatsApp / SMS)</span>
                </>
              )}
            </Button>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  resetState();
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogBody className="space-y-4">
              {isLinking ? (
                <div>
                  <Label htmlFor={`vendor-email-${vendor.restaurantId}`}>Vendor Login Email *</Label>
                  <Input
                    id={`vendor-email-${vendor.restaurantId}`}
                    required
                    type="email"
                    placeholder="e.g. vendor@canteen.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    This email will be used by the vendor to sign in.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-surface-raised p-3">
                  <p className="text-[10px] uppercase tracking-wider text-faint">Linked Login Email</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-sm font-semibold text-bone">
                      {vendor.vendorEmail}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(vendor.vendorEmail || "", "Login Email")}
                      className="p-1 text-muted hover:text-bone"
                      title="Copy email"
                    >
                      {copiedField === "Login Email" ? (
                        <Check className="size-3.5 text-mint" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor={`vendor-pwd-${vendor.restaurantId}`}>
                    {isLinking ? "Set Initial Password *" : "Set New Password *"}
                  </Label>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="text-[11px] font-medium text-saffron hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="size-3" />
                    Generate
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id={`vendor-pwd-${vendor.restaurantId}`}
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-bone"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {isLinking
                    ? "Give this password to the vendor to access their portal."
                    : "Enter a new password. The vendor will immediately be able to sign in with it."}
                </p>
              </div>
            </DialogBody>

            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || newPassword.length < 6}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {isLinking ? "Create & Link Account" : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
