"use client";

import { useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Power,
  Tag,
  Ticket,
  Trash2,
  Truck,
  UtensilsCrossed,
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
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { VegMark } from "@/components/shared/veg-mark";
import { useVendorLanguage } from "@/context/vendor-language-context";
import {
  createVendorCouponAction,
  deleteVendorCouponAction,
  toggleVendorCouponStatusAction,
  updateVendorCouponAction,
} from "@/server/actions/coupons";
import type { Coupon, CouponChannel } from "@/types/finance";
import type { Restaurant } from "@/types/restaurant";

export interface CouponMenuSection {
  categoryName: string;
  items: { id: string; name: string; isVeg: boolean; pricePaise: number }[];
}

interface CouponsViewProps {
  coupons: Coupon[];
  restaurant: Restaurant;
  menuSections: CouponMenuSection[];
}

export function CouponsView({ coupons, restaurant, menuSections }: CouponsViewProps) {
  const { t } = useVendorLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setDialogOpen(true);
  };

  const dineInCoupons = coupons.filter((c) => c.channel === "DINE_IN");
  const deliveryCoupons = coupons.filter((c) => c.channel !== "DINE_IN");

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-bone">{t("navCoupons")}</h1>
          <p className="mt-1 text-sm text-muted">{t("couponsDescription")}</p>
        </div>

        <Button
          variant="primary"
          size="md"
          className="gap-2 self-start sm:self-auto min-h-11"
          onClick={handleOpenCreate}
        >
          <Plus className="size-4" />
          <span>{t("addCoupon")}</span>
        </Button>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {coupons.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Ticket}
            title={t("couponsEmpty")}
            description={t("couponsEmptyDescription")}
            action={
              <Button variant="primary" size="md" className="gap-2 mt-4" onClick={handleOpenCreate}>
                <Plus className="size-4" />
                <span>{t("addCoupon")}</span>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {deliveryCoupons.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-bone">
                <Truck className="size-4 text-saffron" />
                {t("couponDeliveryOrders")}
                <span className="text-xs font-normal text-muted">({deliveryCoupons.length})</span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {deliveryCoupons.map((coupon) => (
                  <VendorCouponCard
                    key={coupon._id}
                    coupon={coupon}
                    onEdit={() => handleOpenEdit(coupon)}
                  />
                ))}
              </div>
            </section>
          )}

          {dineInCoupons.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-bone">
                <UtensilsCrossed className="size-4 text-saffron" />
                {t("couponDineIn")}
                <span className="text-xs font-normal text-muted">({dineInCoupons.length})</span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {dineInCoupons.map((coupon) => (
                  <VendorCouponCard
                    key={coupon._id}
                    coupon={coupon}
                    onEdit={() => handleOpenEdit(coupon)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Create / Edit Dialog ───────────────────────────── */}
      {dialogOpen && (
        <VendorCouponDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialCoupon={editingCoupon}
          restaurantName={restaurant.name}
          isDineInAvailable={Boolean(restaurant.isDineInAvailable)}
          menuSections={menuSections}
        />
      )}
    </div>
  );
}

function VendorCouponCard({
  coupon,
  onEdit,
}: {
  coupon: Coupon;
  onEdit: () => void;
}) {
  const { t } = useVendorLanguage();
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isActive = coupon.isActive;
  const personLimit = coupon.personLimit ?? 0;
  const customersUsed = coupon.redeemedCustomerIds?.length ?? 0;
  const itemNames = (coupon.menuItemNames ?? []).filter(Boolean);
  const isDineIn = coupon.channel === "DINE_IN";

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

  const handleDelete = async () => {
    if (!confirm(`${t("deleteCouponConfirm")} ${coupon.code}?`)) return;
    setDeleting(true);
    const res = await deleteVendorCouponAction({ couponId: coupon._id });
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-saffron/40 bg-saffron-wash px-2.5 py-1 font-mono text-sm font-bold text-saffron">
              <Tag className="size-3.5" />
              {coupon.code}
            </span>
            <Badge tone={isActive ? "success" : "neutral"}>
              {isActive ? t("couponActive") : t("couponInactive")}
            </Badge>
            {isDineIn ? (
              <Badge tone="accent" className="gap-1">
                <UtensilsCrossed className="size-3" />
                {t("couponDineIn")}
              </Badge>
            ) : null}
          </div>
        </div>

        {coupon.description ? (
          <p className="mt-2.5 text-xs text-bone/90">{coupon.description}</p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-line/60 pt-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">
              {t("couponDiscount")}
            </span>
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
            <span className="text-[10px] uppercase tracking-wider text-faint block">
              {t("couponMinOrder")}
            </span>
            <span className="text-bone">
              {coupon.minOrderPaise > 0 ? (
                <Money paise={coupon.minOrderPaise} />
              ) : (
                t("couponNoMinimum")
              )}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-faint block">
              {t("couponCustomers")}
            </span>
            <span className="text-bone">
              {isDineIn
                ? t("couponAtCounter")
                : personLimit > 0
                  ? `${customersUsed} / ${personLimit}`
                  : coupon.totalLimit
                    ? `${coupon.usedCount} ${t("couponUsed")} / ${coupon.totalLimit}`
                    : `${coupon.usedCount} ${t("couponUsed")} (${t("couponNoLimit")})`}
            </span>
          </div>

          <div className="col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-faint block">
              {t("couponAppliesTo")}
            </span>
            <span className="text-bone">
              {itemNames.length > 0 ? itemNames.join(", ") : t("couponEntireMenu")}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line/60 pt-3">
        <Button
          size="sm"
          variant={isActive ? "secondary" : "primary"}
          disabled={toggling}
          onClick={() => void handleToggle()}
          className="gap-1.5 text-xs h-10 flex-1"
        >
          {toggling ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
          <span>{isActive ? t("couponDeactivate") : t("couponActivate")}</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={onEdit}
          className="gap-1.5 text-xs h-10 px-3"
        >
          <Pencil className="size-3.5" />
          <span>{t("editCoupon")}</span>
        </Button>

        <Button
          size="sm"
          variant="danger"
          disabled={deleting}
          onClick={() => void handleDelete()}
          className="gap-1.5 text-xs h-10 px-3"
        >
          {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          <span>{t("deleteCoupon")}</span>
        </Button>
      </div>
    </Card>
  );
}

function VendorCouponDialog({
  open,
  onOpenChange,
  initialCoupon,
  restaurantName,
  isDineInAvailable,
  menuSections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCoupon: Coupon | null;
  restaurantName: string;
  isDineInAvailable: boolean;
  menuSections: CouponMenuSection[];
}) {
  const { t } = useVendorLanguage();
  const isEditing = Boolean(initialCoupon);

  const [submitting, setSubmitting] = useState(false);
  const [channel, setChannel] = useState<CouponChannel>(
    initialCoupon?.channel ?? "DELIVERY",
  );
  const [code, setCode] = useState(initialCoupon?.code ?? "");
  const [description, setDescription] = useState(initialCoupon?.description ?? "");
  const [type, setType] = useState<"FLAT" | "PERCENT">(initialCoupon?.type ?? "FLAT");
  const [value, setValue] = useState(
    initialCoupon
      ? initialCoupon.type === "FLAT"
        ? String(initialCoupon.valuePaise / 100)
        : String(initialCoupon.valueBps / 100)
      : "30",
  );
  const [maxDiscountRupees, setMaxDiscountRupees] = useState(
    initialCoupon?.maxDiscountPaise ? String(initialCoupon.maxDiscountPaise / 100) : "100",
  );
  const [minOrderRupees, setMinOrderRupees] = useState(
    initialCoupon ? String(initialCoupon.minOrderPaise / 100) : "100",
  );
  const [perStudentLimit, setPerStudentLimit] = useState(
    String(initialCoupon?.perStudentLimit ?? 1),
  );
  const [personLimit, setPersonLimit] = useState(
    String(initialCoupon?.personLimit ?? 0),
  );
  const [appliesTo, setAppliesTo] = useState<"ALL" | "ITEMS">(
    initialCoupon && (initialCoupon.menuItemIds?.length ?? 0) > 0 ? "ITEMS" : "ALL",
  );
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    initialCoupon?.menuItemIds ?? [],
  );
  const [itemFilter, setItemFilter] = useState("");

  const personLimitValue = parseInt(personLimit, 10) || 0;
  const isDineIn = channel === "DINE_IN";
  const isUsed = initialCoupon ? (initialCoupon.usedCount ?? 0) > 0 || (initialCoupon.redeemedCustomerIds?.length ?? 0) > 0 : false;

  const toggleItem = (id: string) =>
    setSelectedItemIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const filterText = itemFilter.trim().toLowerCase();
  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: filterText
        ? section.items.filter((item) => item.name.toLowerCase().includes(filterText))
        : section.items,
    }))
    .filter((section) => section.items.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appliesTo === "ITEMS" && selectedItemIds.length === 0) {
      toast.error(t("couponSelectedItems"));
      return;
    }
    setSubmitting(true);

    if (isEditing && initialCoupon) {
      const res = await updateVendorCouponAction({
        couponId: initialCoupon._id,
        code: isUsed ? undefined : code.trim().toUpperCase(),
        description: description.trim() || undefined,
        type,
        value: parseFloat(value),
        maxDiscountRupees:
          type === "PERCENT" && maxDiscountRupees ? parseFloat(maxDiscountRupees) : undefined,
        minOrderRupees: minOrderRupees ? parseFloat(minOrderRupees) : 0,
        perStudentLimit: perStudentLimit ? parseInt(perStudentLimit, 10) : 1,
        personLimit: personLimitValue,
        menuItemIds: appliesTo === "ITEMS" ? selectedItemIds : [],
        channel,
      });

      setSubmitting(false);
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      onOpenChange(false);
    } else {
      const res = await createVendorCouponAction({
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        type,
        value: parseFloat(value),
        maxDiscountRupees:
          type === "PERCENT" && maxDiscountRupees ? parseFloat(maxDiscountRupees) : undefined,
        minOrderRupees: minOrderRupees ? parseFloat(minOrderRupees) : 0,
        perStudentLimit: perStudentLimit ? parseInt(perStudentLimit, 10) : 1,
        personLimit: personLimitValue,
        menuItemIds: appliesTo === "ITEMS" ? selectedItemIds : [],
        channel,
      });

      setSubmitting(false);
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `${t("editCoupon")} - ${initialCoupon?.code}` : `${t("addCoupon")} (${restaurantName})`}
          </DialogTitle>
          <DialogDescription>
            {isDineIn ? t("couponDineInNotice") : t("couponDeliveryNotice")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Coupon For */}
            <div>
              <Label>{t("couponChannel")}</Label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 border border-line">
                <button
                  type="button"
                  onClick={() => setChannel("DELIVERY")}
                  className={`inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    !isDineIn ? "bg-saffron text-ink shadow-sm" : "text-muted hover:text-bone"
                  }`}
                >
                  <Truck className="size-3.5" />
                  {t("couponDeliveryOrders")}
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("DINE_IN")}
                  disabled={!isDineInAvailable}
                  className={`inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDineIn ? "bg-saffron text-ink shadow-sm" : "text-muted hover:text-bone"
                  }`}
                >
                  <UtensilsCrossed className="size-3.5" />
                  {t("couponDineIn")}
                </button>
              </div>
              {!isDineInAvailable && (
                <p className="mt-1 text-[11px] text-muted">{t("couponDineInDisabled")}</p>
              )}
            </div>

            {/* Coupon Code */}
            <div>
              <Label htmlFor="vendor-coupon-code">{t("couponCodeLabel")}</Label>
              <Input
                id="vendor-coupon-code"
                placeholder="e.g. ROLLS30, TASTY50"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                required
                maxLength={20}
                disabled={isEditing && isUsed}
                className="font-mono uppercase tracking-wider disabled:opacity-60"
              />
              {isEditing && isUsed && (
                <p className="mt-1 text-[11px] text-muted">{t("couponCodeLocked")}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="vendor-coupon-desc">{t("couponDescLabel")}</Label>
              <Input
                id="vendor-coupon-desc"
                placeholder="e.g. ₹30 off on all meal combos above ₹120"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Discount Type */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("couponDiscountType")}</Label>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 border border-line">
                  <button
                    type="button"
                    onClick={() => setType("FLAT")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      type === "FLAT" ? "bg-saffron text-ink shadow-sm" : "text-muted hover:text-bone"
                    }`}
                  >
                    {t("couponFlatAmount")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("PERCENT")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      type === "PERCENT" ? "bg-saffron text-ink shadow-sm" : "text-muted hover:text-bone"
                    }`}
                  >
                    {t("couponPercentAmount")}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="vendor-coupon-value">
                  {type === "FLAT" ? t("couponAmountLabel") : t("couponPercentLabel")}
                </Label>
                <Input
                  id="vendor-coupon-value"
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
                  <Label htmlFor="vendor-coupon-max-cap">{t("couponMaxCapLabel")}</Label>
                  <Input
                    id="vendor-coupon-max-cap"
                    type="number"
                    min={1}
                    value={maxDiscountRupees}
                    onChange={(e) => setMaxDiscountRupees(e.target.value)}
                    placeholder="e.g. 100"
                  />
                </div>
              ) : null}

              <div className={type === "FLAT" ? "col-span-2" : ""}>
                <Label htmlFor="vendor-coupon-min-order">{t("couponMinOrderLabel")}</Label>
                <Input
                  id="vendor-coupon-min-order"
                  type="number"
                  min={0}
                  value={minOrderRupees}
                  onChange={(e) => setMinOrderRupees(e.target.value)}
                  placeholder="0 for no minimum"
                />
              </div>
            </div>

            {/* Per Student & Person Limit: only checkout can enforce these */}
            {isDineIn ? null : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="vendor-coupon-per-student">{t("couponPerStudentLabel")}</Label>
                    <Input
                      id="vendor-coupon-per-student"
                      type="number"
                      min={1}
                      value={perStudentLimit}
                      onChange={(e) => setPerStudentLimit(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="vendor-coupon-person-limit">{t("couponPersonLimitLabel")}</Label>
                    <Input
                      id="vendor-coupon-person-limit"
                      type="number"
                      min={0}
                      value={personLimit}
                      onChange={(e) => setPersonLimit(e.target.value)}
                    />
                  </div>
                </div>
                <p className="-mt-2 text-[11px] text-muted">
                  {personLimitValue > 0
                    ? `${t("couponPersonLimitHelp")} (${personLimitValue})`
                    : t("couponPersonLimitHelp")}
                </p>
              </>
            )}

            {/* Applies To */}
            <div>
              <Label>{t("couponAppliesTo")}</Label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 border border-line">
                <button
                  type="button"
                  onClick={() => setAppliesTo("ALL")}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    appliesTo === "ALL" ? "bg-saffron text-ink shadow-sm" : "text-muted hover:text-bone"
                  }`}
                >
                  {t("couponEntireMenu")}
                </button>
                <button
                  type="button"
                  onClick={() => setAppliesTo("ITEMS")}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    appliesTo === "ITEMS" ? "bg-saffron text-ink shadow-sm" : "text-muted hover:text-bone"
                  }`}
                >
                  {t("couponSelectedItems")}
                </button>
              </div>

              {appliesTo === "ITEMS" ? (
                <div className="mt-2 space-y-2">
                  <Input
                    placeholder={t("couponSearchItems")}
                    value={itemFilter}
                    onChange={(e) => setItemFilter(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-line divide-y divide-line/60">
                    {visibleSections.length === 0 ? (
                      <p className="p-3 text-xs text-muted">
                        {menuSections.length === 0
                          ? "This restaurant has no menu items yet."
                          : "No items match."}
                      </p>
                    ) : (
                      visibleSections.map((section) => (
                        <div key={section.categoryName} className="p-2">
                          <p className="px-1 pb-1 text-[10px] uppercase tracking-wider text-faint">
                            {section.categoryName}
                          </p>
                          {section.items.map((item) => (
                            <label
                              key={item.id}
                              className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-1 text-xs hover:bg-surface-raised"
                            >
                              <input
                                type="checkbox"
                                checked={selectedItemIds.includes(item.id)}
                                onChange={() => toggleItem(item.id)}
                                className="size-4 accent-saffron"
                              />
                              <VegMark isVeg={item.isVeg} />
                              <span className="flex-1 text-bone">{item.name}</span>
                              <Money paise={item.pricePaise} className="text-muted" />
                            </label>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-[11px] text-muted">
                    {selectedItemIds.length} {t("couponItemsCountSelected")}.
                  </p>
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("couponCancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Tag className="size-4" />
              )}
              <span>{submitting ? t("couponSaving") : t("couponSave")}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
