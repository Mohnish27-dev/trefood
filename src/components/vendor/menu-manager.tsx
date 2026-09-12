"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Edit2,
  Filter,
  Layers,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { VegMark } from "@/components/shared/veg-mark";
import {
  createVendorCategory,
  createVendorMenuItem,
  deleteVendorCategory,
  deleteVendorMenuItem,
  setItemAvailability,
  updateVendorCategory,
  updateVendorMenuItem,
  type AffectedOrder,
} from "@/server/actions/vendor";
import { packingFeePaiseOf } from "@/lib/packing-fee";
import { cn } from "@/lib/utils";
import { useVendorLanguage } from "@/context/vendor-language-context";
import type { AddOnGroup, MenuCategory } from "@/types/restaurant";

export interface MenuManagerItem {
  itemId: string;
  categoryId?: string;
  name: string;
  description: string;
  isVeg: boolean;
  pricePaise: number;
  isAvailable: boolean;
  isPopular?: boolean;
  packingFeeEnabled?: boolean;
  packingFeePaise?: number;
  addOnGroups?: AddOnGroup[];
  addOnGroupCount: number;
}

export interface MenuManagerSection {
  categoryId: string;
  categoryName: string;
  category?: MenuCategory;
  items: MenuManagerItem[];
}

/**
 * Menu management, built around one control.
 *
 * The 86 toggle is the only thing on this screen a vendor touches during
 * service, so it is a switch rather than a menu buried behind an edit form.
 * Flipping it does two separate things, and the UI has to make both visible:
 *
 *   (a) the item disappears from every future order, instantly
 *   (b) any order already in the kitchen containing it needs a decision from
 *       its student — which is F6, and is surfaced here as a list of the
 *       affected orders rather than a silent side effect
 *
 * Availability is a boolean, never a count. There is no "3 left" field to
 * type, because true stock counting means decrements, reservations and TTL
 * release on abandoned carts — machinery a canteen that cooks to order will
 * never keep accurate.
 */
export function MenuManager({ sections }: { sections: MenuManagerSection[] }) {
  const { t } = useVendorLanguage();
  const [query, setQuery] = useState("");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "non-veg">("all");
  const [pending, setPending] = useState<string | null>(null);
  const [available, setAvailable] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.flatMap((section) => section.items.map((item) => [item.itemId, item.isAvailable])),
    ),
  );
  const [affected, setAffected] = useState<{ itemName: string; orders: AffectedOrder[] } | null>(
    null,
  );

  const categories: MenuCategory[] = sections.map((s) => ({
    _id: s.categoryId,
    restaurantId: s.category?.restaurantId ?? "",
    name: s.categoryName,
    sortOrder: s.category?.sortOrder ?? 1,
  }));

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);

  const toggle = async (item: MenuManagerItem, next: boolean): Promise<void> => {
    setPending(item.itemId);
    setAvailable((prev) => ({ ...prev, [item.itemId]: next }));

    const result = await setItemAvailability({ itemId: item.itemId, isAvailable: next });
    setPending(null);

    if (result.status === "error") {
      setAvailable((prev) => ({ ...prev, [item.itemId]: !next }));
      toast.error(result.message);
      return;
    }

    toast.success(result.message ?? "Saved");

    if (result.affectedOrders && result.affectedOrders.length > 0) {
      setAffected({ itemName: item.name, orders: result.affectedOrders });
    }
  };

  const needle = query.trim().toLowerCase();
  const filtered = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const matchesQuery =
          needle.length === 0 ||
          item.name.toLowerCase().includes(needle) ||
          item.description?.toLowerCase().includes(needle);
        const matchesVeg =
          vegFilter === "all" ||
          (vegFilter === "veg" && item.isVeg) ||
          (vegFilter === "non-veg" && !item.isVeg);
        return matchesQuery && matchesVeg;
      }),
    }))
    .filter((section) => section.items.length > 0 || (needle.length === 0 && vegFilter === "all"));

  const offCount = Object.values(available).filter((value) => !value).length;

  return (
    <div className="space-y-5 pb-16">
      {/* ── Page Header with Actions ─────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-bone">{t("menuPageTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{t("menuPageSubtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AddCategoryDialog />
          <AddMenuItemDialog categories={categories} />
        </div>
      </header>

      {/* ── Search Bar & Filter Options ─────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("findAnItem")}
              className="pl-9 text-xs"
              aria-label={t("findAnItem")}
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setVegFilter("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                vegFilter === "all" ? "bg-surface-raised text-bone" : "text-muted hover:text-bone",
              )}
            >
              {t("allFilter")} ({totalItems})
            </button>
            <button
              type="button"
              onClick={() => setVegFilter("veg")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                vegFilter === "veg" ? "bg-mint/15 text-mint" : "text-muted hover:text-bone",
              )}
            >
              <VegMark isVeg={true} /> {t("vegFilter")}
            </button>
            <button
              type="button"
              onClick={() => setVegFilter("non-veg")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                vegFilter === "non-veg" ? "bg-chili/15 text-chili" : "text-muted hover:text-bone",
              )}
            >
              <VegMark isVeg={false} /> {t("nonVegFilter")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {offCount > 0 ? (
            <Badge tone="warning">
              {offCount} {offCount === 1 ? t("itemOffMenu") : t("itemsOffMenu")}
            </Badge>
          ) : (
            <Badge tone="success">{t("everythingOn")}</Badge>
          )}
        </div>
      </div>

      {/* ── F6: Orders in Kitchen Affected by Out-of-Stock ───────── */}
      {affected ? (
        <Card className="border-amber/40">
          <div className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-bone">
                {affected.orders.length}{" "}
                {affected.orders.length === 1
                  ? t("orderAlreadyContains")
                  : t("ordersAlreadyContain")}{" "}
                {affected.itemName}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t("affectedOrdersExplanation")}
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {affected.orders.map((order) => (
                  <li
                    key={order.orderId}
                    className="rounded-lg border border-line bg-surface-raised px-2.5 py-1 font-mono text-[11px] text-bone"
                  >
                    {order.orderNumber} · {order.customerName}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setAffected(null)}
                className="mt-3 min-h-11 text-xs text-muted hover:text-bone"
              >
                {t("dismiss")}
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ── Sections & Menu Items ─────────────────────────────────── */}
      {sections.length === 0 ? (
        <Card>
          <EmptyState
            icon={UtensilsCrossed}
            title={t("noMenuYet")}
            description={t("noMenuYetDesc")}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Filter}
            title={t("nothingMatches")}
            description={t("nothingMatchesDesc")}
          />
        </Card>
      ) : (
        filtered.map((section) => (
          <section key={section.categoryId} className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
                  {section.categoryName}
                </h2>
                <Badge tone="neutral" className="text-[10px]">
                  {section.items.length}
                </Badge>
              </div>

              <div className="flex items-center gap-1">
                <EditCategoryDialog
                  category={{
                    _id: section.categoryId,
                    restaurantId: section.category?.restaurantId ?? "",
                    name: section.categoryName,
                    sortOrder: section.category?.sortOrder ?? 1,
                  }}
                />
                <DeleteCategoryDialog
                  category={{
                    _id: section.categoryId,
                    restaurantId: section.category?.restaurantId ?? "",
                    name: section.categoryName,
                    sortOrder: section.category?.sortOrder ?? 1,
                  }}
                  itemCount={section.items.length}
                />
                <AddMenuItemDialog
                  categories={categories}
                  defaultCategoryId={section.categoryId}
                  triggerButton={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs text-saffron hover:bg-saffron/10"
                    >
                      <Plus className="size-3" />
                      <span>{t("addToCategory")} {section.categoryName}</span>
                    </Button>
                  }
                />
              </div>
            </div>

            {section.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
                {t("emptyCategoryHint")}
              </div>
            ) : (
              <Card className="divide-y divide-line">
                {section.items.map((item) => {
                  const isOn = available[item.itemId] ?? item.isAvailable;
                  return (
                    <div
                      key={item.itemId}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 transition-opacity",
                        !isOn && "opacity-60 bg-surface/40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <VegMark isVeg={item.isVeg} />
                          <span
                            className={cn(
                              "truncate text-sm font-medium",
                              isOn ? "text-bone" : "text-faint line-through",
                            )}
                          >
                            {item.name}
                          </span>
                          {item.isPopular ? (
                            <span className="rounded bg-amber-wash px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber">
                              {t("popularTag")}
                            </span>
                          ) : null}
                        </div>

                        {item.description ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                            {item.description}
                          </p>
                        ) : null}

                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <Money paise={item.pricePaise} className="font-semibold text-bone" />
                          {packingFeePaiseOf(item) > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-muted">
                              <Package className="size-2.5" />
                              +<Money paise={packingFeePaiseOf(item)} /> {t("packingTag")}
                            </span>
                          ) : null}
                          {item.addOnGroups && item.addOnGroups.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.addOnGroups.map((grp) => (
                                <span
                                  key={grp.id}
                                  className="inline-flex items-center gap-1 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-faint"
                                >
                                  <Layers className="size-2.5" />
                                  {grp.name} ({grp.options.length})
                                </span>
                              ))}
                            </div>
                          ) : item.addOnGroupCount > 0 ? (
                            <span className="text-faint">
                              · {item.addOnGroupCount}{" "}
                              {item.addOnGroupCount === 1 ? t("addOnGroup") : t("addOnGroups")}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Right side controls: On/86 toggle + Edit / Delete */}
                      <div className="flex shrink-0 items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/40">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              isOn ? "text-mint" : "text-chili",
                            )}
                          >
                            {pending === item.itemId ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : isOn ? (
                              t("statusOn")
                            ) : (
                              t("status86")
                            )}
                          </span>
                          <Switch
                            checked={isOn}
                            disabled={pending === item.itemId}
                            onCheckedChange={(next) => void toggle(item, next)}
                            aria-label={`${item.name} ${isOn ? t("inStock") : t("outOfStock")}`}
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <EditMenuItemDialog item={item} categories={categories} />
                          <DeleteMenuItemDialog item={item} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </section>
        ))
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Category Dialogs
   ══════════════════════════════════════════════════════════════════════ */

function AddCategoryDialog() {
  const { t } = useVendorLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await createVendorCategory({ name });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setName("");
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to create category.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs">
          <Plus className="size-3.5" />
          {t("addCategory")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{t("addCategory")}</DialogTitle>
            <DialogDescription>{t("categoryDesc")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="category-name">{t("categoryName")} *</Label>
              <Input
                id="category-name"
                required
                placeholder={t("categoryNamePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {submitting ? t("saving") : t("createCategory")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({ category }: { category: MenuCategory }) {
  const { t } = useVendorLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await updateVendorCategory({
        categoryId: category._id,
        name,
      });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to update category.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-bone"
          title={t("editCategory")}
        >
          <Edit2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{t("editCategory")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor={`edit-cat-${category._id}`}>{t("categoryName")} *</Label>
              <Input
                id={`edit-cat-${category._id}`}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? t("saving") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({
  category,
  itemCount,
}: {
  category: MenuCategory;
  itemCount: number;
}) {
  const { t } = useVendorLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await deleteVendorCategory({ categoryId: category._id });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to delete category.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-chili/10 hover:text-chili"
          title={t("deleteCategory")}
        >
          <Trash2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-chili">{t("confirmDeleteCategoryTitle")}</DialogTitle>
          <DialogDescription>
            {t("confirmDeleteCategoryDesc")}
            {itemCount > 0 ? (
              <span className="block mt-2 font-semibold text-chili">
                ({itemCount} {itemCount === 1 ? t("itemOffMenu") : t("itemsOffMenu")})
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={submitting}
            onClick={() => void handleDelete()}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {submitting ? t("saving") : t("deleteCategory")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Menu Item Add / Edit Form State and Components
   ══════════════════════════════════════════════════════════════════════ */

interface AddOnGroupFormItem {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: {
    id: string;
    name: string;
    priceRupees: number;
    isAvailable: boolean;
  }[];
}

function AddMenuItemDialog({
  categories,
  defaultCategoryId,
  triggerButton,
}: {
  categories: MenuCategory[];
  defaultCategoryId?: string;
  triggerButton?: React.ReactNode;
}) {
  const { t } = useVendorLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?._id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isVeg, setIsVeg] = useState(true);
  const [priceRupees, setPriceRupees] = useState("");
  const [isPopular, setIsPopular] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [packingFeeEnabled, setPackingFeeEnabled] = useState(false);
  const [packingFeeRupees, setPackingFeeRupees] = useState("");
  const [addOnGroups, setAddOnGroups] = useState<AddOnGroupFormItem[]>([]);

  const resetForm = () => {
    setCategoryId(defaultCategoryId ?? categories[0]?._id ?? "");
    setName("");
    setDescription("");
    setIsVeg(true);
    setPriceRupees("");
    setIsPopular(false);
    setIsAvailable(true);
    setPackingFeeEnabled(false);
    setPackingFeeRupees("");
    setAddOnGroups([]);
  };

  const handleAddGroup = () => {
    setAddOnGroups((prev) => [
      ...prev,
      {
        id: `grp_${Date.now()}`,
        name: "Size",
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: `opt_${Date.now()}_1`, name: "Regular", priceRupees: 0, isAvailable: true },
          { id: `opt_${Date.now()}_2`, name: "Large", priceRupees: 10, isAvailable: true },
        ],
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      toast.error(t("selectCategory"));
      return;
    }
    if (!name.trim()) {
      toast.error(t("itemName"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await createVendorMenuItem({
        categoryId,
        name,
        description: description || undefined,
        isVeg,
        priceRupees: Number(priceRupees) || 0,
        isPopular,
        isAvailable,
        packingFeeEnabled,
        packingFeeRupees: Number(packingFeeRupees) || 0,
        addOnGroups,
      });

      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        resetForm();
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to create menu item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton ?? (
          <Button variant="primary" size="sm" className="gap-1.5 h-9 text-xs">
            <Plus className="size-3.5" />
            {t("addItem")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{t("addItem")}</DialogTitle>
            <DialogDescription>{t("itemDialogSubtitleAdd")}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="item-category">{t("category")} *</Label>
                <select
                  id="item-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="flex h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-bone focus-visible:border-saffron focus-visible:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="item-price">{t("basePrice")} *</Label>
                <Input
                  id="item-price"
                  type="number"
                  required
                  min={0}
                  step={1}
                  placeholder="e.g. 50"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="item-name">{t("itemName")} *</Label>
                <Input
                  id="item-name"
                  required
                  placeholder={t("itemNamePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="item-desc">{t("descriptionOptional")}</Label>
                <Input
                  id="item-desc"
                  placeholder={t("itemDescriptionPlaceholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Toggles: Veg / Popular / Available */}
            <div className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-surface p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isVeg} onCheckedChange={setIsVeg} />
                <span className="flex items-center gap-1.5">
                  <VegMark isVeg={isVeg} />
                  {isVeg ? t("veg") : t("nonVeg")}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isPopular} onCheckedChange={setIsPopular} />
                <span>{t("markPopular")}</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                <span className={isAvailable ? "text-mint" : "text-chili"}>
                  {isAvailable ? t("inStock") : t("outOfStock")}
                </span>
              </label>
            </div>

            <PackingFeeField
              idPrefix="item"
              enabled={packingFeeEnabled}
              onEnabledChange={setPackingFeeEnabled}
              rupees={packingFeeRupees}
              onRupeesChange={setPackingFeeRupees}
            />

            {/* Add-on Groups / Sizes Builder */}
            <div className="space-y-3 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-saffron">
                    {t("addOnsAndSizes")}
                  </h3>
                  <p className="text-[11px] text-muted">{t("addOnsAndSizesDesc")}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddGroup}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="size-3" />
                  {t("addGroup")}
                </Button>
              </div>

              {addOnGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                  {t("noAddOnGroups")}
                </div>
              ) : (
                <div className="space-y-3">
                  {addOnGroups.map((group, gIdx) => (
                    <VendorAddOnGroupEditor
                      key={group.id}
                      group={group}
                      onChange={(updated) => {
                        setAddOnGroups((prev) =>
                          prev.map((g, idx) => (idx === gIdx ? updated : g)),
                        );
                      }}
                      onDelete={() => {
                        setAddOnGroups((prev) => prev.filter((_, idx) => idx !== gIdx));
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {submitting ? t("saving") : t("createItem")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMenuItemDialog({
  item,
  categories,
}: {
  item: MenuManagerItem;
  categories: MenuCategory[];
}) {
  const { t } = useVendorLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [categoryId, setCategoryId] = useState(item.categoryId ?? categories[0]?._id ?? "");
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [isVeg, setIsVeg] = useState(item.isVeg);
  const [priceRupees, setPriceRupees] = useState((item.pricePaise / 100).toString());
  const [isPopular, setIsPopular] = useState(item.isPopular ?? false);
  const [isAvailable, setIsAvailable] = useState(item.isAvailable);
  const [packingFeeEnabled, setPackingFeeEnabled] = useState(item.packingFeeEnabled ?? false);
  const [packingFeeRupees, setPackingFeeRupees] = useState(
    item.packingFeePaise ? (item.packingFeePaise / 100).toString() : "",
  );
  const [addOnGroups, setAddOnGroups] = useState<AddOnGroupFormItem[]>(() =>
    (item.addOnGroups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceRupees: o.pricePaise / 100,
        isAvailable: o.isAvailable,
      })),
    })),
  );

  const handleAddGroup = () => {
    setAddOnGroups((prev) => [
      ...prev,
      {
        id: `grp_${Date.now()}`,
        name: "Size",
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: `opt_${Date.now()}_1`, name: "Regular", priceRupees: 0, isAvailable: true },
          { id: `opt_${Date.now()}_2`, name: "Large", priceRupees: 10, isAvailable: true },
        ],
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      toast.error(t("selectCategory"));
      return;
    }
    if (!name.trim()) {
      toast.error(t("itemName"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await updateVendorMenuItem({
        itemId: item.itemId,
        categoryId,
        name,
        description: description || undefined,
        isVeg,
        priceRupees: Number(priceRupees) || 0,
        isPopular,
        isAvailable,
        packingFeeEnabled,
        packingFeeRupees: Number(packingFeeRupees) || 0,
        addOnGroups,
      });

      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to update menu item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-bone"
          title={t("editItem")}
        >
          <Edit2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{t("editItem")}</DialogTitle>
            <DialogDescription>{t("itemDialogSubtitleEdit")}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`edit-item-category-${item.itemId}`}>{t("category")} *</Label>
                <select
                  id={`edit-item-category-${item.itemId}`}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="flex h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-bone focus-visible:border-saffron focus-visible:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor={`edit-item-price-${item.itemId}`}>{t("basePrice")} *</Label>
                <Input
                  id={`edit-item-price-${item.itemId}`}
                  type="number"
                  required
                  min={0}
                  step={1}
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor={`edit-item-name-${item.itemId}`}>{t("itemName")} *</Label>
                <Input
                  id={`edit-item-name-${item.itemId}`}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor={`edit-item-desc-${item.itemId}`}>{t("descriptionOptional")}</Label>
                <Input
                  id={`edit-item-desc-${item.itemId}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Toggles: Veg / Popular / Available */}
            <div className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-surface p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isVeg} onCheckedChange={setIsVeg} />
                <span className="flex items-center gap-1.5">
                  <VegMark isVeg={isVeg} />
                  {isVeg ? t("veg") : t("nonVeg")}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isPopular} onCheckedChange={setIsPopular} />
                <span>{t("markPopular")}</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                <span className={isAvailable ? "text-mint" : "text-chili"}>
                  {isAvailable ? t("inStock") : t("outOfStock")}
                </span>
              </label>
            </div>

            <PackingFeeField
              idPrefix={`edit-item-${item.itemId}`}
              enabled={packingFeeEnabled}
              onEnabledChange={setPackingFeeEnabled}
              rupees={packingFeeRupees}
              onRupeesChange={setPackingFeeRupees}
            />

            {/* Add-on Groups */}
            <div className="space-y-3 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-saffron">
                    {t("addOnsAndSizes")}
                  </h3>
                  <p className="text-[11px] text-muted">{t("addOnsAndSizesDesc")}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddGroup}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="size-3" />
                  {t("addGroup")}
                </Button>
              </div>

              {addOnGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                  {t("noAddOnGroups")}
                </div>
              ) : (
                <div className="space-y-3">
                  {addOnGroups.map((group, gIdx) => (
                    <VendorAddOnGroupEditor
                      key={group.id}
                      group={group}
                      onChange={(updated) => {
                        setAddOnGroups((prev) =>
                          prev.map((g, idx) => (idx === gIdx ? updated : g)),
                        );
                      }}
                      onDelete={() => {
                        setAddOnGroups((prev) => prev.filter((_, idx) => idx !== gIdx));
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? t("saving") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The per-item packing fee: a switch, and an amount that only matters while
 * the switch is on.
 *
 * The amount stays in the box when the switch goes off, so a vendor who stops
 * charging for a day can switch it back on without retyping the number. The
 * server ignores it while the switch is off.
 */
function PackingFeeField({
  idPrefix,
  enabled,
  onEnabledChange,
  rupees,
  onRupeesChange,
}: {
  idPrefix: string;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  rupees: string;
  onRupeesChange: (next: string) => void;
}) {
  const { t } = useVendorLanguage();
  const inputId = `${idPrefix}-packing-fee`;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-3">
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-bone">
            <Package className="size-3.5 text-saffron" />
            {t("packingFeeTitle")}
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
            {t("packingFeeDesc")}
          </span>
        </span>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </label>

      {enabled ? (
        <div className="max-w-xs">
          <Label htmlFor={inputId}>{t("packingFeeAmount")} *</Label>
          <Input
            id={inputId}
            type="number"
            required
            min={1}
            max={500}
            step={1}
            placeholder="e.g. 10"
            value={rupees}
            onChange={(e) => onRupeesChange(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-faint">{t("packingFeePerUnitHint")}</p>
        </div>
      ) : null}
    </div>
  );
}

function DeleteMenuItemDialog({ item }: { item: MenuManagerItem }) {
  const { t } = useVendorLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await deleteVendorMenuItem({ itemId: item.itemId });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to delete menu item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-chili/10 hover:text-chili"
          title={t("deleteItem")}
        >
          <Trash2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-chili">{t("confirmDeleteItemTitle")}</DialogTitle>
          <DialogDescription>
            {t("confirmDeleteItemDesc")}{" "}
            <strong className="text-bone">{item.name}</strong>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={submitting}
            onClick={() => void handleDelete()}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {submitting ? t("saving") : t("deleteItem")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Add-on Group Nested Editor
   ══════════════════════════════════════════════════════════════════════ */

function VendorAddOnGroupEditor({
  group,
  onChange,
  onDelete,
}: {
  group: AddOnGroupFormItem;
  onChange: (updated: AddOnGroupFormItem) => void;
  onDelete: () => void;
}) {
  const { t } = useVendorLanguage();

  const handleAddOption = () => {
    onChange({
      ...group,
      options: [
        ...group.options,
        {
          id: `opt_${Date.now()}_${group.options.length + 1}`,
          name: "Extra",
          priceRupees: 0,
          isAvailable: true,
        },
      ],
    });
  };

  const handleUpdateOption = (
    optIdx: number,
    field: "name" | "priceRupees" | "isAvailable",
    val: string | number | boolean,
  ) => {
    const updatedOptions = group.options.map((opt, idx) => {
      if (idx !== optIdx) return opt;
      return { ...opt, [field]: val };
    });
    onChange({ ...group, options: updatedOptions });
  };

  const handleDeleteOption = (optIdx: number) => {
    onChange({
      ...group,
      options: group.options.filter((_, idx) => idx !== optIdx),
    });
  };

  return (
    <div className="rounded-xl border border-line bg-surface-raised/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="grid grid-cols-3 gap-2 flex-1">
          <div className="col-span-1">
            <Label className="text-[10px]">{t("groupName")}</Label>
            <Input
              value={group.name}
              onChange={(e) => onChange({ ...group, name: e.target.value })}
              placeholder="e.g. Size"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px]">{t("minSelect")}</Label>
            <Input
              type="number"
              min={0}
              value={group.minSelect}
              onChange={(e) => onChange({ ...group, minSelect: Number(e.target.value) || 0 })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px]">{t("maxSelect")}</Label>
            <Input
              type="number"
              min={1}
              value={group.maxSelect}
              onChange={(e) => onChange({ ...group, maxSelect: Number(e.target.value) || 1 })}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="mt-3 flex size-7 items-center justify-center rounded-lg text-muted hover:bg-chili/10 hover:text-chili"
          title="Delete Group"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Option Rows */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-faint uppercase font-semibold">
          <span>{t("addOnsCount")}</span>
          <button
            type="button"
            onClick={handleAddOption}
            className="text-saffron hover:underline inline-flex items-center gap-0.5"
          >
            <Plus className="size-3" /> {t("addOption")}
          </button>
        </div>

        {group.options.map((opt, oIdx) => (
          <div key={opt.id} className="flex items-center gap-2">
            <Input
              value={opt.name}
              onChange={(e) => handleUpdateOption(oIdx, "name", e.target.value)}
              placeholder={t("optionName")}
              className="h-7 text-xs flex-1"
            />
            <div className="flex items-center gap-1 w-24">
              <span className="text-[11px] text-muted">+₹</span>
              <Input
                type="number"
                min={0}
                value={opt.priceRupees}
                onChange={(e) =>
                  handleUpdateOption(oIdx, "priceRupees", Number(e.target.value) || 0)
                }
                className="h-7 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => handleDeleteOption(oIdx)}
              className="flex size-6 items-center justify-center rounded text-muted hover:text-chili"
              title="Remove Option"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
