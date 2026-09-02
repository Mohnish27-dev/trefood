"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Edit2,
  Filter,
  Layers,
  Loader2,
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
import { cn } from "@/lib/utils";
import type { AddOnGroup, AddOnOption, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import {
  createMenuCategoryAction,
  createMenuItemAction,
  deleteMenuCategoryAction,
  deleteMenuItemAction,
  toggleMenuItemAvailabilityAction,
  updateMenuCategoryAction,
  updateMenuItemAction,
} from "@/server/actions/admin-menu";

interface AdminMenuSection {
  category: MenuCategory;
  items: MenuItem[];
}

interface RestaurantMenuManagerProps {
  restaurant: Restaurant;
  campusName: string;
  sections: AdminMenuSection[];
}

export function RestaurantMenuManager({
  restaurant,
  campusName,
  sections,
}: RestaurantMenuManagerProps) {
  const [query, setQuery] = useState("");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "non-veg">("all");
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);
  const outOfStockCount = sections.reduce(
    (acc, s) => acc + s.items.filter((i) => !i.isAvailable).length,
    0,
  );

  const handleToggleAvailability = async (item: MenuItem, next: boolean) => {
    setTogglingItemId(item._id);
    try {
      const res = await toggleMenuItemAvailabilityAction({
        itemId: item._id,
        restaurantId: restaurant._id,
        isAvailable: next,
      });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
      }
    } catch {
      toast.error("Failed to update availability.");
    } finally {
      setTogglingItemId(null);
    }
  };

  const needle = query.trim().toLowerCase();
  const filteredSections = sections
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

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-5">
        <div>
          <Link
            href="/admin/vendors"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted hover:text-bone transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to Vendors
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-bone">{restaurant.name}</h1>
            <Badge tone="neutral">{campusName}</Badge>
            <Badge tone={restaurant.isOpen ? "success" : "warning"}>
              {restaurant.isOpen ? "Open" : "Closed"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Manage catalogue, categories, add-on groups, size options, and item availability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AddCategoryDialog restaurantId={restaurant._id} />
          <AddMenuItemDialog
            restaurantId={restaurant._id}
            categories={sections.map((s) => s.category)}
          />
        </div>
      </div>

      {/* ── Stats & Search Bar ───────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes or items..."
              className="pl-9 text-xs"
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
              All ({totalItems})
            </button>
            <button
              type="button"
              onClick={() => setVegFilter("veg")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                vegFilter === "veg" ? "bg-mint/15 text-mint" : "text-muted hover:text-bone",
              )}
            >
              <VegMark isVeg={true} /> Veg
            </button>
            <button
              type="button"
              onClick={() => setVegFilter("non-veg")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                vegFilter === "non-veg" ? "bg-chili/15 text-chili" : "text-muted hover:text-bone",
              )}
            >
              <VegMark isVeg={false} /> Non-Veg
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{sections.length} Categories</span>
          <span>·</span>
          <span>{totalItems} Total Items</span>
          {outOfStockCount > 0 ? (
            <>
              <span>·</span>
              <Badge tone="warning">{outOfStockCount} Out of stock</Badge>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Menu Sections ────────────────────────────────────────── */}
      {sections.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={UtensilsCrossed}
            title="No categories created yet"
            description="Start building the menu by adding your first category (e.g. Chai, Maggi, Burgers)."
          />
        </Card>
      ) : filteredSections.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Filter}
            title="No items match your filter"
            description="Try adjusting your search query or clear the filter."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredSections.map((section) => (
            <div key={section.category._id} className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-bone">
                    {section.category.name}
                  </h2>
                  <Badge tone="neutral" className="text-[10px]">
                    {section.items.length} item{section.items.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  <EditCategoryDialog
                    category={section.category}
                    restaurantId={restaurant._id}
                  />
                  <DeleteCategoryDialog
                    category={section.category}
                    restaurantId={restaurant._id}
                    itemCount={section.items.length}
                  />
                  <AddMenuItemDialog
                    restaurantId={restaurant._id}
                    categories={sections.map((s) => s.category)}
                    defaultCategoryId={section.category._id}
                    triggerButton={
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-saffron">
                        <Plus className="size-3.5" />
                        Add to {section.category.name}
                      </Button>
                    }
                  />
                </div>
              </div>

              {section.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
                  No items in this category yet.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item) => (
                    <Card
                      key={item._id}
                      className={cn(
                        "flex flex-col justify-between p-3.5 transition-opacity",
                        !item.isAvailable && "opacity-60 bg-surface/50",
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <VegMark isVeg={item.isVeg} />
                            <span className="truncate text-sm font-semibold text-bone">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.isPopular ? (
                              <span className="rounded bg-amber-wash px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber">
                                Pop
                              </span>
                            ) : null}
                            <Money
                              paise={item.pricePaise}
                              className="font-bold text-sm text-bone"
                            />
                          </div>
                        </div>

                        {item.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted leading-relaxed">
                            {item.description}
                          </p>
                        ) : null}

                        {item.addOnGroups.length > 0 ? (
                          <div className="mt-2.5 flex flex-wrap gap-1">
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
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.isAvailable}
                            disabled={togglingItemId === item._id}
                            onCheckedChange={(next) => void handleToggleAvailability(item, next)}
                            aria-label={`${item.name} availability`}
                          />
                          <span
                            className={cn(
                              "text-[11px] font-medium",
                              item.isAvailable ? "text-mint" : "text-chili",
                            )}
                          >
                            {item.isAvailable ? "In Stock" : "86-ed"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <EditMenuItemDialog
                            item={item}
                            restaurantId={restaurant._id}
                            categories={sections.map((s) => s.category)}
                          />
                          <DeleteMenuItemDialog
                            item={item}
                            restaurantId={restaurant._id}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Category Dialogs
   ══════════════════════════════════════════════════════════════════════ */

function AddCategoryDialog({ restaurantId }: { restaurantId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await createMenuCategoryAction({ restaurantId, name });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setName("");
        setOpen(false);
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
        <Button variant="outline" size="md" className="gap-1.5">
          <Plus className="size-4" />
          Add Category
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a new category to group related items (e.g. Chai, Maggi, Pizza, Shakes).
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                required
                placeholder="e.g. Chai, Maggi, Burger"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {submitting ? "Creating..." : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({
  category,
  restaurantId,
}: {
  category: MenuCategory;
  restaurantId: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await updateMenuCategoryAction({
        categoryId: category._id,
        restaurantId,
        name,
      });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setOpen(false);
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
          title="Edit Category"
        >
          <Edit2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="edit-cat-name">Category Name *</Label>
              <Input
                id="edit-cat-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({
  category,
  restaurantId,
  itemCount,
}: {
  category: MenuCategory;
  restaurantId: string;
  itemCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await deleteMenuCategoryAction({
        categoryId: category._id,
        restaurantId,
      });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setOpen(false);
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
          title="Delete Category"
        >
          <Trash2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-chili">Delete Category</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong className="text-bone">{category.name}</strong>?
            {itemCount > 0 ? (
              <span className="block mt-2 text-chili font-semibold">
                Warning: This will also delete all {itemCount} menu item(s) in this category!
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={submitting} onClick={() => void handleDelete()}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Delete Category"}
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
  restaurantId,
  categories,
  defaultCategoryId,
  triggerButton,
}: {
  restaurantId: string;
  categories: MenuCategory[];
  defaultCategoryId?: string;
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?._id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isVeg, setIsVeg] = useState(true);
  const [priceRupees, setPriceRupees] = useState("");
  const [isPopular, setIsPopular] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [addOnGroups, setAddOnGroups] = useState<AddOnGroupFormItem[]>([]);

  const resetForm = () => {
    setCategoryId(defaultCategoryId ?? categories[0]?._id ?? "");
    setName("");
    setDescription("");
    setIsVeg(true);
    setPriceRupees("");
    setIsPopular(false);
    setIsAvailable(true);
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
      toast.error("Please select a category.");
      return;
    }
    if (!name.trim()) {
      toast.error("Item name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createMenuItemAction({
        restaurantId,
        categoryId,
        name,
        description: description || undefined,
        isVeg,
        priceRupees: Number(priceRupees) || 0,
        isPopular,
        isAvailable,
        addOnGroups,
      });

      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        resetForm();
        setOpen(false);
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
          <Button variant="primary" size="md" className="gap-1.5 shadow-sm">
            <Plus className="size-4" />
            Add Menu Item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
            <DialogDescription>
              Add a new dish with custom price, veg/non-veg status, and optional size or add-on groups.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="item-category">Category *</Label>
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
                <Label htmlFor="item-price">Base Price (₹) *</Label>
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
                <Label htmlFor="item-name">Item Name *</Label>
                <Input
                  id="item-name"
                  required
                  placeholder="e.g. Adrak Chai, Hakka Noodles, Margherita Pizza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="item-desc">Description (Optional)</Label>
                <Input
                  id="item-desc"
                  placeholder="e.g. Freshly brewed ginger tea served piping hot in kulhad."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-surface p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isVeg} onCheckedChange={setIsVeg} />
                <span className="flex items-center gap-1.5">
                  <VegMark isVeg={isVeg} />
                  {isVeg ? "Veg" : "Non-Veg"}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isPopular} onCheckedChange={setIsPopular} />
                <span>Mark as Popular</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                <span className={isAvailable ? "text-mint" : "text-chili"}>
                  {isAvailable ? "In Stock" : "Out of Stock (86)"}
                </span>
              </label>
            </div>

            {/* Add-on Groups / Sizes Builder */}
            <div className="space-y-3 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-saffron">
                    Add-on & Size Groups
                  </h3>
                  <p className="text-[11px] text-muted">
                    Configure Regular/Large sizes, extra cheese, sugar-free, or toppings.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddGroup}
                  className="h-8 gap-1 text-xs"
                >
                  <Plus className="size-3.5" />
                  Add Group
                </Button>
              </div>

              {addOnGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                  No add-on groups. The dish will be ordered as-is at base price.
                </div>
              ) : (
                <div className="space-y-3">
                  {addOnGroups.map((group, gIdx) => (
                    <AddOnGroupEditor
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
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {submitting ? "Saving..." : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMenuItemDialog({
  item,
  restaurantId,
  categories,
}: {
  item: MenuItem;
  restaurantId: string;
  categories: MenuCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [isVeg, setIsVeg] = useState(item.isVeg);
  const [priceRupees, setPriceRupees] = useState((item.pricePaise / 100).toString());
  const [isPopular, setIsPopular] = useState(item.isPopular);
  const [isAvailable, setIsAvailable] = useState(item.isAvailable);
  const [addOnGroups, setAddOnGroups] = useState<AddOnGroupFormItem[]>(() =>
    item.addOnGroups.map((g) => ({
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
      toast.error("Please select a category.");
      return;
    }
    if (!name.trim()) {
      toast.error("Item name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await updateMenuItemAction({
        itemId: item._id,
        restaurantId,
        categoryId,
        name,
        description: description || undefined,
        isVeg,
        priceRupees: Number(priceRupees) || 0,
        isPopular,
        isAvailable,
        addOnGroups,
      });

      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setOpen(false);
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
          title="Edit Item"
        >
          <Edit2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-item-category">Category *</Label>
                <select
                  id="edit-item-category"
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
                <Label htmlFor="edit-item-price">Base Price (₹) *</Label>
                <Input
                  id="edit-item-price"
                  type="number"
                  required
                  min={0}
                  step={1}
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="edit-item-name">Item Name *</Label>
                <Input
                  id="edit-item-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="edit-item-desc">Description (Optional)</Label>
                <Input
                  id="edit-item-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-surface p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isVeg} onCheckedChange={setIsVeg} />
                <span className="flex items-center gap-1.5">
                  <VegMark isVeg={isVeg} />
                  {isVeg ? "Veg" : "Non-Veg"}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isPopular} onCheckedChange={setIsPopular} />
                <span>Mark as Popular</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-bone cursor-pointer">
                <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                <span className={isAvailable ? "text-mint" : "text-chili"}>
                  {isAvailable ? "In Stock" : "Out of Stock (86)"}
                </span>
              </label>
            </div>

            {/* Add-on Groups */}
            <div className="space-y-3 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-saffron">
                    Add-on & Size Groups
                  </h3>
                  <p className="text-[11px] text-muted">
                    Configure Regular/Large sizes, extra cheese, sugar-free, or toppings.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddGroup}
                  className="h-8 gap-1 text-xs"
                >
                  <Plus className="size-3.5" />
                  Add Group
                </Button>
              </div>

              {addOnGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                  No add-on groups.
                </div>
              ) : (
                <div className="space-y-3">
                  {addOnGroups.map((group, gIdx) => (
                    <AddOnGroupEditor
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
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteMenuItemDialog({
  item,
  restaurantId,
}: {
  item: MenuItem;
  restaurantId: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await deleteMenuItemAction({
        itemId: item._id,
        restaurantId,
      });
      if (res.status === "error") {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        setOpen(false);
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
          title="Delete Item"
        >
          <Trash2 className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-chili">Delete Menu Item</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong className="text-bone">{item.name}</strong>?
            This will permanently remove it from the catalogue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={submitting}
            onClick={() => void handleDelete()}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Delete Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Add-on Group Nested Editor
   ══════════════════════════════════════════════════════════════════════ */

function AddOnGroupEditor({
  group,
  onChange,
  onDelete,
}: {
  group: AddOnGroupFormItem;
  onChange: (updated: AddOnGroupFormItem) => void;
  onDelete: () => void;
}) {
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
            <Label className="text-[10px]">Group Name</Label>
            <Input
              value={group.name}
              onChange={(e) => onChange({ ...group, name: e.target.value })}
              placeholder="e.g. Size"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px]">Min Select (1=Required)</Label>
            <Input
              type="number"
              min={0}
              value={group.minSelect}
              onChange={(e) => onChange({ ...group, minSelect: Number(e.target.value) || 0 })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px]">Max Select</Label>
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
          <span>Options</span>
          <button
            type="button"
            onClick={handleAddOption}
            className="text-saffron hover:underline inline-flex items-center gap-0.5"
          >
            <Plus className="size-3" /> Add Option
          </button>
        </div>

        {group.options.map((opt, oIdx) => (
          <div key={opt.id} className="flex items-center gap-2">
            <Input
              value={opt.name}
              onChange={(e) => handleUpdateOption(oIdx, "name", e.target.value)}
              placeholder="Option name (e.g. Large)"
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
