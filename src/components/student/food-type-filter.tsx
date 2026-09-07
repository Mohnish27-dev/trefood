"use client";

import Image from "next/image";
import { Apple, ChevronRight, CupSoda, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FoodTypeFilter } from "@/lib/restaurant-filter";

interface CategoryCardItem {
  id: FoodTypeFilter;
  label: string;
  imageSrc: string;
  imageAlt: string;
  icon: typeof UtensilsCrossed;
  iconColor: string;
  selectedRing: string;
  selectedBorder: string;
  selectedGlow: string;
}

const CATEGORY_CARDS: CategoryCardItem[] = [
  {
    id: "food",
    label: "Food",
    imageSrc: "/categories/food.jpg",
    imageAlt: "Cooked food, meals, and snacks",
    icon: UtensilsCrossed,
    iconColor: "text-orange-500",
    selectedRing: "ring-orange-500/80",
    selectedBorder: "border-orange-500",
    selectedGlow: "shadow-orange-500/20",
  },
  {
    id: "fruits",
    label: "Fruits",
    imageSrc: "/categories/fruits.jpg",
    imageAlt: "Fresh farm fruits",
    icon: Apple,
    iconColor: "text-emerald-500",
    selectedRing: "ring-emerald-500/80",
    selectedBorder: "border-emerald-500",
    selectedGlow: "shadow-emerald-500/20",
  },
  {
    id: "juice_shakes",
    label: "Juices",
    imageSrc: "/categories/juices.jpg",
    imageAlt: "Fresh juices, shakes, and smoothies",
    icon: CupSoda,
    iconColor: "text-purple-400",
    selectedRing: "ring-purple-500/80",
    selectedBorder: "border-purple-500",
    selectedGlow: "shadow-purple-500/20",
  },
];

interface FoodTypeFilterBarProps {
  selected: FoodTypeFilter;
  onChange: (filter: FoodTypeFilter) => void;
  counts?: Record<FoodTypeFilter, number>;
  className?: string;
}

export function FoodTypeFilterBar({
  selected,
  onChange,
  className,
}: FoodTypeFilterBarProps) {
  return (
    <div className={cn("w-full py-1", className)}>
      <div
        role="tablist"
        aria-label="Filter kitchens by category"
        className="grid grid-cols-3 gap-2.5 sm:gap-3"
      >
        {CATEGORY_CARDS.map((card) => {
          const isSelected = selected === card.id;
          const IconComponent = card.icon;

          return (
            <button
              key={card.id}
              role="tab"
              type="button"
              aria-selected={isSelected}
              aria-label={`Filter by ${card.label}`}
              onClick={() => {
                // Tapping active filter resets back to "all"
                if (isSelected) {
                  onChange("all");
                } else {
                  onChange(card.id);
                }
              }}
              className={cn(
                "group relative flex flex-col rounded-2xl overflow-hidden text-left transition-all duration-200 cursor-pointer select-none border",
                "bg-surface",
                isSelected
                  ? cn(
                      "ring-2 shadow-lg",
                      card.selectedRing,
                      card.selectedBorder,
                      card.selectedGlow,
                      "bg-surface-raised",
                    )
                  : "border-line/60 hover:border-line-strong hover:bg-surface-raised shadow-xs active:scale-[0.98]",
              )}
            >
              {/* ── Top Image Container ─────────────────────────────── */}
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-raised">
                <Image
                  src={card.imageSrc}
                  alt={card.imageAlt}
                  fill
                  sizes="(max-width: 640px) 33vw, 200px"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                  unoptimized
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />

                {/* Active Checkmark Pill */}
                {isSelected ? (
                  <span className="absolute top-1.5 right-1.5 z-10 flex size-4.5 items-center justify-center rounded-full bg-black/80 backdrop-blur-xs text-white text-[10px] font-black shadow-md border border-white/20">
                    ✓
                  </span>
                ) : null}
              </div>

              {/* ── Bottom Label & Icon Bar ─────────────────────────── */}
              <div className="flex items-center justify-between px-2.5 py-2 sm:px-3 sm:py-2.5 bg-[#13161f] border-t border-line/40 transition-colors">
                <div className="flex items-center gap-1.5 min-w-0">
                  <IconComponent
                    className={cn("size-3.5 sm:size-4 shrink-0", card.iconColor)}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "font-bold text-xs sm:text-sm truncate transition-colors",
                      isSelected ? "text-bone" : "text-bone/90 group-hover:text-bone",
                    )}
                  >
                    {card.label}
                  </span>
                </div>

                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 transition-all duration-200",
                    isSelected
                      ? "text-bone translate-x-0.5"
                      : "text-muted/60 group-hover:text-bone group-hover:translate-x-0.5",
                  )}
                  aria-hidden="true"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
