"use client";

import { useState } from "react";
import { Loader2, Power, Tag, Ticket } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { useVendorLanguage } from "@/context/vendor-language-context";
import { toggleVendorCouponStatusAction } from "@/server/actions/coupons";
import type { Coupon } from "@/types/finance";

export function CouponsView({ coupons }: { coupons: Coupon[] }) {
  const { t } = useVendorLanguage();

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="font-display text-xl font-semibold text-bone">{t("navCoupons")}</h1>
        <p className="mt-1 text-sm text-muted">{t("couponsDescription")}</p>
      </div>

      {coupons.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Ticket}
            title={t("couponsEmpty")}
            description={t("couponsEmptyDescription")}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {coupons.map((coupon) => (
            <CouponCard key={coupon._id} coupon={coupon} />
          ))}
        </div>
      )}
    </div>
  );
}

function CouponCard({ coupon }: { coupon: Coupon }) {
  const { t, lang } = useVendorLanguage();
  const [toggling, setToggling] = useState(false);
  const isExpired = new Date(coupon.validUntil) < new Date();
  const personLimit = coupon.personLimit ?? 0;
  const customersUsed = coupon.redeemedCustomerIds?.length ?? 0;
  const itemNames = (coupon.menuItemNames ?? []).filter(Boolean);

  const handleToggle = async () => {
    setToggling(true);
    const res = await toggleVendorCouponStatusAction({
      couponId: coupon._id,
      isActive: !coupon.isActive,
    });
    setToggling(false);
    if (res.status === "error") {
      toast.error(res.message);
    } else {
      toast.success(res.message);
    }
  };

  return (
    <Card className="p-4 flex flex-col justify-between border-line bg-surface">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-saffron/40 bg-saffron-wash px-2.5 py-1 font-mono text-sm font-bold text-saffron">
            <Tag className="size-3.5" />
            {coupon.code}
          </span>
          <Badge tone={coupon.isActive && !isExpired ? "success" : isExpired ? "danger" : "neutral"}>
            {isExpired ? t("couponExpired") : coupon.isActive ? t("couponActive") : t("couponInactive")}
          </Badge>
        </div>

        {coupon.description ? (
          <p className="mt-2.5 text-xs text-bone/90">{coupon.description}</p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-line/60 pt-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">{t("couponDiscount")}</span>
            <span className="font-semibold text-bone">
              {coupon.type === "FLAT"
                ? `₹${coupon.valuePaise / 100} ${t("couponFlatOff")}`
                : `${coupon.valueBps / 100}% ${t("couponPercentOff")}${
                    coupon.maxDiscountPaise > 0
                      ? ` (${t("couponUpTo")} ₹${coupon.maxDiscountPaise / 100})`
                      : ""
                  }`}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">{t("couponMinOrder")}</span>
            <span className="text-bone">
              {coupon.minOrderPaise > 0 ? <Money paise={coupon.minOrderPaise} /> : t("couponNoMinimum")}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">{t("couponCustomers")}</span>
            <span className="text-bone">
              {personLimit > 0
                ? `${customersUsed} / ${personLimit}`
                : coupon.totalLimit
                  ? `${coupon.usedCount} ${t("couponUsed")} / ${coupon.totalLimit}`
                  : `${coupon.usedCount} ${t("couponUsed")} (${t("couponNoLimit")})`}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">{t("couponValidTill")}</span>
            <span className="text-bone">
              {new Date(coupon.validUntil).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-faint block">{t("couponAppliesTo")}</span>
            <span className="text-bone">
              {itemNames.length > 0 ? itemNames.join(", ") : t("couponEntireMenu")}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-line/60 pt-3">
        <Button
          size="sm"
          variant={coupon.isActive ? "secondary" : "primary"}
          disabled={toggling || isExpired}
          onClick={() => void handleToggle()}
          className="gap-1.5 text-xs h-11"
        >
          {toggling ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
          <span>{coupon.isActive ? t("couponDeactivate") : t("couponActivate")}</span>
        </Button>
      </div>
    </Card>
  );
}
