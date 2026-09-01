"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/shared/money";
import type { AvailableCouponDto } from "@/app/api/cart/preview/route";

interface CouponSectionProps {
  appliedCoupon?: {
    code: string;
    discountPaise: number;
    description?: string | null | undefined;
  } | null | undefined;
  availableCoupons?: AvailableCouponDto[] | undefined;
  couponError?: string | null | undefined;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
}

export function CouponSection({
  appliedCoupon,
  availableCoupons = [],
  couponError,
  onApplyCoupon,
  onRemoveCoupon,
}: CouponSectionProps) {
  const [inputCode, setInputCode] = useState("");
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [applying, setApplying] = useState(false);

  const handleManualApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setApplying(true);
    onApplyCoupon(inputCode.trim().toUpperCase());
    setTimeout(() => setApplying(false), 300);
  };

  const handleSelectOffer = (code: string) => {
    setApplying(true);
    onApplyCoupon(code);
    setInputCode(code);
    setTimeout(() => setApplying(false), 300);
  };

  return (
    <Card className="mt-4 p-4 border-line bg-surface">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-faint flex items-center gap-1.5">
          <Ticket className="size-3.5 text-saffron" />
          Coupons &amp; Offers
        </h2>
        {availableCoupons.length > 0 && !appliedCoupon ? (
          <button
            type="button"
            onClick={() => setShowAllOffers(!showAllOffers)}
            className="text-xs text-saffron hover:underline flex items-center gap-1 font-medium"
          >
            <span>{availableCoupons.length} available</span>
            {showAllOffers ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        ) : null}
      </div>

      {/* ── Applied state ────────────────────────────────────────── */}
      {appliedCoupon ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-mint/40 bg-mint-wash p-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-mint text-ink font-bold font-mono">
              <Check className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold uppercase text-bone">{appliedCoupon.code}</span>
                <span className="font-semibold text-mint">
                  Saved <Money paise={appliedCoupon.discountPaise} />
                </span>
              </div>
              {appliedCoupon.description ? (
                <p className="text-[11px] text-muted truncate">{appliedCoupon.description}</p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onRemoveCoupon}
            className="text-xs font-medium text-chili hover:text-chili/80 shrink-0 px-2 py-1 rounded-md hover:bg-surface-raised"
          >
            Remove
          </button>
        </div>
      ) : (
        /* ── Input code form ─────────────────────────────────────── */
        <div className="space-y-3">
          <form onSubmit={handleManualApply} className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Enter coupon code"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="font-mono uppercase tracking-wider h-11 text-xs"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={!inputCode.trim() || applying}
              className="h-11 px-4"
            >
              {applying ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
            </Button>
          </form>

          {couponError ? (
            <p className="text-xs text-chili rounded-lg border border-chili/30 bg-chili-wash p-2.5 leading-relaxed">
              {couponError}
            </p>
          ) : null}

          {/* ── Available Offers List ─────────────────────────────── */}
          {availableCoupons.length > 0 && (showAllOffers || availableCoupons.some((c) => c.isEligible)) ? (
            <div className="space-y-2 pt-2 border-t border-line/60">
              <p className="text-[11px] font-medium text-muted">Available for this canteen:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {availableCoupons.map((coupon) => (
                  <div
                    key={coupon.code}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs transition-colors ${
                      coupon.isEligible
                        ? "border-line bg-surface-raised/40 hover:border-saffron/40"
                        : "border-line/40 bg-surface/40 opacity-70"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-saffron tracking-wide">
                          {coupon.code}
                        </span>
                        <span className="text-[11px] font-semibold text-bone">
                          {coupon.type === "FLAT" ? (
                            `₹${coupon.valuePaise / 100} OFF`
                          ) : (
                            `${coupon.valueBps / 100}% OFF`
                          )}
                        </span>
                      </div>
                      {coupon.description ? (
                        <p className="text-[11px] text-muted truncate mt-0.5">{coupon.description}</p>
                      ) : null}
                      {!coupon.isEligible && coupon.reason ? (
                        <p className="text-[10px] text-amber mt-0.5">{coupon.reason}</p>
                      ) : null}
                    </div>

                    {coupon.isEligible ? (
                      <button
                        type="button"
                        onClick={() => handleSelectOffer(coupon.code)}
                        className="text-xs font-semibold text-saffron hover:underline px-2.5 py-1 rounded-lg border border-saffron/30 hover:bg-saffron-wash shrink-0"
                      >
                        Apply
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
