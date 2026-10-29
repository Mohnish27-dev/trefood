"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Check,
  Edit2,
  Filter,
  Layers,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  UploadCloud,
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
  updateVendorMenuItemImage,
  type AffectedOrder,
} from "@/server/actions/vendor";
import { uploadMenuItemImage } from "@/lib/client-image";
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
  imageUrl?: string | null;
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
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <QuickPhotoDialog item={item} />
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
                      </div>

                      {/* Right side controls: On/86 toggle + Photo / Edit / Delete */}
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
                          <QuickPhotoDialog
                            item={item}
                            trigger={
                              <button
                                type="button"
                                className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-bone"
                                title={item.imageUrl ? t("changePhoto") : t("addPhoto")}
                              >
                                <Camera className="size-3.5" />
                              </button>
                            }
                          />
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

/* ══════════════════════════════════════════════════════════════════════
   Food Image Field & Quick Photo Dialog
   ══════════════════════════════════════════════════════════════════════ */

function FoodImageField({
  previewUrl,
  urlValue,
  onFileSelect,
  onUrlChange,
  onClear,
}: {
  previewUrl: string | null;
  urlValue: string;
  onFileSelect: (file: File) => void;
  onUrlChange: (url: string) => void;
  onClear: () => void;
}) {
  const { t } = useVendorLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [useLink, setUseLink] = useState(
    Boolean(urlValue && !urlValue.startsWith("data:") && !urlValue.startsWith("/api/")),
  );

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-saffron">
          {t("foodPhoto")}
        </Label>
        <button
          type="button"
          onClick={() => setUseLink(!useLink)}
          className="text-[11px] text-muted hover:text-bone underline underline-offset-2"
        >
          {useLink ? t("useFile") : t("orUseWebLink")}
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Preview Thumbnail */}
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-raised flex items-center justify-center">
          {previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="size-full object-cover" />
              <button
                type="button"
                onClick={onClear}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white hover:bg-black"
                title={t("removePhoto")}
              >
                <X className="size-3" />
              </button>
            </>
          ) : (
            <Camera className="size-6 text-faint" />
          )}
        </div>

        {/* Input / Upload triggers */}
        <div className="flex-1 min-w-0">
          {useLink ? (
            <Input
              type="text"
              placeholder={t("imageUrlOptional")}
              value={urlValue}
              onChange={(e) => onUrlChange(e.target.value)}
              className="text-xs"
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelect(file);
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 gap-1.5 text-xs"
                >
                  <UploadCloud className="size-3.5" />
                  <span>{previewUrl ? t("changePhoto") : t("uploadPhoto")}</span>
                </Button>
                {previewUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="h-8 text-xs text-chili hover:bg-chili/10"
                  >
                    {t("removePhoto")}
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted">{t("photoUploadLimits")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickPhotoDialog({
  item,
  trigger,
}: {
  item: MenuManagerItem;
  trigger?: React.ReactNode;
}) {
  const { t } = useVendorLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [useLink, setUseLink] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(item.imageUrl ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState<string>(item.imageUrl ?? "");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPreviewUrl(item.imageUrl ?? null);
      setSelectedFile(null);
      setUrlInput(item.imageUrl ?? "");
      setUseLink(false);
    }
    setOpen(nextOpen);
  };

  const handleFilePicked = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please select a JPG, PNG, or WebP image.");
      return;
    }
    setSelectedFile(file);
    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);
    setUrlInput("");
  };

  const handleUrlChanged = (val: string) => {
    setUrlInput(val);
    setSelectedFile(null);
    setPreviewUrl(val.trim() ? val.trim() : null);
  };

  const handleRemovePhoto = async () => {
    setSubmitting(true);
    try {
      const res = await updateVendorMenuItemImage({ itemId: item.itemId, imageUrl: null });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message || t("photoRemoved"));
        setPreviewUrl(null);
        setSelectedFile(null);
        setUrlInput("");
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to remove photo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      if (selectedFile) {
        const uploadRes = await uploadMenuItemImage(selectedFile, item.itemId);
        if (!uploadRes.ok) {
          toast.error(uploadRes.error || "Failed to upload image.");
          setSubmitting(false);
          return;
        }
        toast.success(t("photoSaved"));
        setOpen(false);
        router.refresh();
      } else if (useLink) {
        const finalUrl = urlInput.trim();
        const res = await updateVendorMenuItemImage({
          itemId: item.itemId,
          imageUrl: finalUrl || null,
        });
        if (res.status === "error") {
          toast.error(res.message);
        } else {
          toast.success(res.message || t("photoSaved"));
          setOpen(false);
          router.refresh();
        }
      } else if (!previewUrl && item.imageUrl) {
        await handleRemovePhoto();
      } else {
        setOpen(false);
      }
    } catch {
      toast.error("Failed to update photo.");
    } finally {
      setSubmitting(false);
    }
  };

  const defaultTrigger = item.imageUrl ? (
    <button
      type="button"
      className="group relative size-14 shrink-0 overflow-hidden rounded-xl border border-line bg-surface hover:border-saffron transition-all"
      title={t("changePhoto")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl}
        alt={item.name}
        className="size-full object-cover transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
        <Camera className="size-4 text-white" />
      </div>
    </button>
  ) : (
    <button
      type="button"
      className="group flex size-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line hover:border-saffron/60 bg-surface/50 hover:bg-saffron/5 text-muted hover:text-saffron transition-all"
      title={t("addPhoto")}
    >
      <Camera className="size-4" />
      <span className="text-[9px] font-medium leading-none">{t("addPhoto")}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5 text-saffron" />
            <span>
              {t("quickPhotoTitle")}: {item.name}
            </span>
          </DialogTitle>
          <DialogDescription>{t("quickPhotoSubtitle")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Large Preview */}
          <div className="relative mx-auto flex h-48 w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border-2 border-line bg-surface-raised">
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={item.name}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedFile(null);
                    setUrlInput("");
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black transition-colors"
                  title={t("removePhoto")}
                >
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted">
                <UtensilsCrossed className="size-8 text-faint" />
                <span className="text-xs font-medium">{t("noPhotoYet")}</span>
              </div>
            )}
          </div>

          {/* Toggle between Upload File and Web Link */}
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUseLink(false)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  !useLink
                    ? "bg-surface-raised text-bone border border-line"
                    : "text-muted hover:text-bone",
                )}
              >
                {t("useFile")}
              </button>
              <button
                type="button"
                onClick={() => setUseLink(true)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  useLink
                    ? "bg-surface-raised text-bone border border-line"
                    : "text-muted hover:text-bone",
                )}
              >
                {t("useUrl")}
              </button>
            </div>

            {item.imageUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={submitting}
                className="text-xs text-chili hover:underline"
              >
                {t("removePhoto")}
              </button>
            )}
          </div>

          {!useLink ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFilePicked(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
                isDragOver
                  ? "border-saffron bg-saffron/10 text-saffron"
                  : "border-line hover:border-saffron/60 bg-surface/50 text-muted hover:text-bone",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFilePicked(file);
                }}
              />
              <UploadCloud className="size-8 text-saffron" />
              <div>
                <p className="text-xs font-medium text-bone">{t("dropPhotoHere")}</p>
                <p className="mt-1 text-[11px] text-muted">{t("photoUploadLimits")}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`image-url-input-${item.itemId}`}>{t("orUseWebLink")}</Label>
              <Input
                id={`image-url-input-${item.itemId}`}
                type="text"
                placeholder={t("imageUrlPlaceholder")}
                value={urlInput}
                onChange={(e) => handleUrlChanged(e.target.value)}
                className="text-xs"
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            <span>{submitting ? t("saving") : t("applyPhoto")}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    setImageUrl("");
    setPreviewUrl(null);
    setSelectedFile(null);
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
      let finalImageUrl: string | null | undefined = imageUrl.trim() || undefined;
      if (selectedFile) {
        const uploadRes = await uploadMenuItemImage(selectedFile);
        if (!uploadRes.ok) {
          toast.error(uploadRes.error || "Failed to upload image.");
          setSubmitting(false);
          return;
        }
        finalImageUrl = uploadRes.imageUrl;
      }

      const res = await createVendorMenuItem({
        categoryId,
        name,
        description: description || undefined,
        isVeg,
        priceRupees: Number(priceRupees) || 0,
        imageUrl: finalImageUrl,
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

              <FoodImageField
                previewUrl={previewUrl}
                urlValue={imageUrl}
                onFileSelect={(file) => {
                  setSelectedFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                  setImageUrl("");
                }}
                onUrlChange={(url) => {
                  setImageUrl(url);
                  setSelectedFile(null);
                  setPreviewUrl(url.trim() ? url.trim() : null);
                }}
                onClear={() => {
                  setImageUrl("");
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              />
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
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(item.imageUrl ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setCategoryId(item.categoryId ?? categories[0]?._id ?? "");
      setName(item.name);
      setDescription(item.description);
      setIsVeg(item.isVeg);
      setPriceRupees((item.pricePaise / 100).toString());
      setImageUrl(item.imageUrl ?? "");
      setPreviewUrl(item.imageUrl ?? null);
      setSelectedFile(null);
      setIsPopular(item.isPopular ?? false);
      setIsAvailable(item.isAvailable);
      setPackingFeeEnabled(item.packingFeeEnabled ?? false);
      setPackingFeeRupees(
        item.packingFeePaise ? (item.packingFeePaise / 100).toString() : "",
      );
    }
    setOpen(nextOpen);
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
      let finalImageUrl: string | null | undefined = imageUrl.trim() || null;
      if (selectedFile) {
        const uploadRes = await uploadMenuItemImage(selectedFile, item.itemId);
        if (!uploadRes.ok) {
          toast.error(uploadRes.error || "Failed to upload image.");
          setSubmitting(false);
          return;
        }
        finalImageUrl = uploadRes.imageUrl;
      } else if (!previewUrl && item.imageUrl) {
        finalImageUrl = null;
      }

      const res = await updateVendorMenuItem({
        itemId: item.itemId,
        categoryId,
        name,
        description: description || undefined,
        isVeg,
        priceRupees: Number(priceRupees) || 0,
        imageUrl: finalImageUrl,
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

              <FoodImageField
                previewUrl={previewUrl}
                urlValue={imageUrl}
                onFileSelect={(file) => {
                  setSelectedFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                  setImageUrl("");
                }}
                onUrlChange={(url) => {
                  setImageUrl(url);
                  setSelectedFile(null);
                  setPreviewUrl(url.trim() ? url.trim() : null);
                }}
                onClear={() => {
                  setImageUrl("");
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              />
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
