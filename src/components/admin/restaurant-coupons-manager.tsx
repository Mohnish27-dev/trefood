"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Power,
  Tag,
  Ticket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
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
import type { Coupon } from "@/types/finance";
import type { Restaurant } from "@/types/restaurant";
import {
  createRestaurantCouponAction,
  deleteCouponAction,
  toggleCouponStatusAction,
} from "@/server/actions/coupons";

interface RestaurantCouponsManagerProps {
  restaurant: Restaurant;
  campusName: string;
  coupons: Coupon[];
}

export function RestaurantCouponsManager({
  restaurant,
  campusName,
  coupons,
}: RestaurantCouponsManagerProps) {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/vendors"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted hover:text-bone transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to Vendors
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-bone">{restaurant.name}</h1>
            <Badge tone="neutral">{campusName}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Manage discount vouchers and promo codes applicable for this restaurant.
          </p>
        </div>

        <CreateCouponDialog restaurantId={restaurant._id} restaurantName={restaurant.name} />
      </div>

      {/* ── Coupons List ─────────────────────────────────────────── */}
      {coupons.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Ticket}
            title="No coupons created yet"
            description={`Create special discount codes for ${restaurant.name} so students can apply them at checkout.`}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {coupons.map((coupon) => (
            <CouponCard
              key={coupon._id}
              coupon={coupon}
              restaurantId={restaurant._id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CouponCard({
  coupon,
  restaurantId,
}: {
  coupon: Coupon;
  restaurantId: string;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isExpired = new Date(coupon.validUntil) < new Date();

  const handleToggle = async () => {
    setToggling(true);
    const res = await toggleCouponStatusAction({
      couponId: coupon._id,
      isActive: !coupon.isActive,
      restaurantId,
    });
    setToggling(false);
    if (res.status === "error") {
      toast.error(res.message);
    } else {
      toast.success(res.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete coupon ${coupon.code}?`)) return;
    setDeleting(true);
    const res = await deleteCouponAction({
      couponId: coupon._id,
      restaurantId,
    });
    setDeleting(false);
    if (res.status === "error") {
      toast.error(res.message);
    } else {
      toast.success(res.message);
    }
  };

  return (
    <Card className="p-4 flex flex-col justify-between border-line bg-surface relative overflow-hidden">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-saffron/40 bg-saffron-wash px-2.5 py-1 font-mono text-sm font-bold text-saffron">
              <Tag className="size-3.5" />
              {coupon.code}
            </span>
            <Badge tone={coupon.isActive && !isExpired ? "success" : isExpired ? "danger" : "neutral"}>
              {isExpired ? "Expired" : coupon.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          <Badge tone={coupon.fundedBy === "PLATFORM" ? "info" : "warning"}>
            {coupon.fundedBy === "PLATFORM" ? "Platform Funded" : "Vendor Funded"}
          </Badge>
        </div>

        {coupon.description ? (
          <p className="mt-2.5 text-xs text-bone/90">{coupon.description}</p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-line/60 pt-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">Discount</span>
            <span className="font-semibold text-bone">
              {coupon.type === "FLAT" ? (
                <span>₹{coupon.valuePaise / 100} FLAT OFF</span>
              ) : (
                <span>
                  {coupon.valueBps / 100}% OFF{" "}
                  {coupon.maxDiscountPaise > 0 ? `(up to ₹${coupon.maxDiscountPaise / 100})` : ""}
                </span>
              )}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">Min Order</span>
            <span className="text-bone">
              {coupon.minOrderPaise > 0 ? <Money paise={coupon.minOrderPaise} /> : "No minimum"}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">Usage</span>
            <span className="text-bone">
              {coupon.usedCount} used {coupon.totalLimit ? `/ ${coupon.totalLimit}` : "(unlimited)"}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">Valid Till</span>
            <span className="text-bone">
              {new Date(coupon.validUntil).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
        <Button
          size="sm"
          variant={coupon.isActive ? "secondary" : "primary"}
          disabled={toggling || isExpired}
          onClick={() => void handleToggle()}
          className="gap-1.5 text-xs h-9"
        >
          {toggling ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Power className="size-3.5" />
          )}
          <span>{coupon.isActive ? "Deactivate" : "Activate"}</span>
        </Button>

        <Button
          size="sm"
          variant="danger"
          disabled={deleting}
          onClick={() => void handleDelete()}
          className="gap-1.5 text-xs h-9"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
          <span>Delete</span>
        </Button>
      </div>
    </Card>
  );
}

function CreateCouponDialog({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [value, setValue] = useState("30");
  const [maxDiscountRupees, setMaxDiscountRupees] = useState("100");
  const [minOrderRupees, setMinOrderRupees] = useState("100");
  const [fundedBy, setFundedBy] = useState<"PLATFORM" | "VENDOR">("PLATFORM");
  const [perStudentLimit, setPerStudentLimit] = useState("1");
  const [totalLimit, setTotalLimit] = useState("");

  // Default validity: 30 days from now
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0] ?? "";
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const res = await createRestaurantCouponAction({
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      restaurantId,
      fundedBy,
      type,
      value: parseFloat(value),
      maxDiscountRupees: type === "PERCENT" && maxDiscountRupees ? parseFloat(maxDiscountRupees) : undefined,
      minOrderRupees: minOrderRupees ? parseFloat(minOrderRupees) : 0,
      perStudentLimit: perStudentLimit ? parseInt(perStudentLimit, 10) : 1,
      totalLimit: totalLimit ? parseInt(totalLimit, 10) : null,
      validUntil: new Date(`${validUntil}T23:59:59`).toISOString(),
    });

    setSubmitting(false);

    if (res.status === "error") {
      toast.error(res.message);
      return;
    }

    toast.success(res.message);
    setOpen(false);
    // Reset form
    setCode("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="md" className="gap-2">
          <Plus className="size-4" />
          <span>Add Coupon</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Coupon for {restaurantName}</DialogTitle>
          <DialogDescription>
            Create a promo code applicable exclusively when students order from this canteen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Coupon Code */}
            <div>
              <Label htmlFor="coupon-code">Coupon Code</Label>
              <Input
                id="coupon-code"
                placeholder="e.g. ROLLS30, TASTY50"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                required
                maxLength={20}
                className="font-mono uppercase tracking-wider"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="coupon-desc">Description / Offer Text</Label>
              <Input
                id="coupon-desc"
                placeholder="e.g. ₹30 off on all meal combos above ₹120"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Discount Type */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Discount Type</Label>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 border border-line">
                  <button
                    type="button"
                    onClick={() => setType("FLAT")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      type === "FLAT" ? "bg-saffron text-ink shadow-sm" : "text-muted hover:text-bone"
                    }`}
                  >
                    Flat ₹
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("PERCENT")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      type === "PERCENT" ? "bg-saffron text-ink shadow-sm" : "text-muted hover:text-bone"
                    }`}
                  >
                    Percentage %
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="coupon-value">
                  {type === "FLAT" ? "Discount Amount (₹)" : "Discount Percentage (%)"}
                </Label>
                <Input
                  id="coupon-value"
                  type="number"
                  min={1}
                  max={type === "PERCENT" ? 100 : 1000}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Max Discount (if Percent) and Min Order */}
            <div className="grid grid-cols-2 gap-3">
              {type === "PERCENT" ? (
                <div>
                  <Label htmlFor="coupon-max-cap">Max Discount Cap (₹)</Label>
                  <Input
                    id="coupon-max-cap"
                    type="number"
                    min={1}
                    value={maxDiscountRupees}
                    onChange={(e) => setMaxDiscountRupees(e.target.value)}
                    placeholder="e.g. 100"
                  />
                </div>
              ) : null}

              <div className={type === "FLAT" ? "col-span-2" : ""}>
                <Label htmlFor="coupon-min-order">Min Order Value (₹)</Label>
                <Input
                  id="coupon-min-order"
                  type="number"
                  min={0}
                  value={minOrderRupees}
                  onChange={(e) => setMinOrderRupees(e.target.value)}
                  placeholder="0 for no minimum"
                />
              </div>
            </div>

            {/* Funding Source & Per Student Limit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="coupon-funding">Funded By</Label>
                <select
                  id="coupon-funding"
                  value={fundedBy}
                  onChange={(e) => setFundedBy(e.target.value as "PLATFORM" | "VENDOR")}
                  className="w-full h-11 rounded-xl border border-line bg-surface px-3 text-xs text-bone focus:outline-none focus:border-saffron"
                >
                  <option value="PLATFORM">Platform (TREFOOD Commission)</option>
                  <option value="VENDOR">Vendor (Restaurant Base)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="coupon-per-student">Per Student Limit</Label>
                <Input
                  id="coupon-per-student"
                  type="number"
                  min={1}
                  value={perStudentLimit}
                  onChange={(e) => setPerStudentLimit(e.target.value)}
                />
              </div>
            </div>

            {/* Expiry Date & Total Redemptions */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="coupon-expiry">Valid Until</Label>
                <Input
                  id="coupon-expiry"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="coupon-total-limit">Total Limit (Optional)</Label>
                <Input
                  id="coupon-total-limit"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={totalLimit}
                  onChange={(e) => setTotalLimit(e.target.value)}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Tag className="size-4" />}
              <span>{submitting ? "Creating..." : "Save Coupon"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
