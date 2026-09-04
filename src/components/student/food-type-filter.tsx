"use client";

import { cn } from "@/lib/utils";
import {
  FOOD_TYPE_OPTIONS,
  type FoodTypeFilter,
} from "@/lib/restaurant-filter";

interface FoodTypeFilterBarProps {
  selected: FoodTypeFilter;
  onChange: (filter: FoodTypeFilter) => void;
  counts: Record<FoodTypeFilter, number>;
  className?: string;
}

export function FoodTypeFilterBar({
  selected,
  onChange,
  counts,
  className,
}: FoodTypeFilterBarProps) {
  return (
    <div
      className={cn(
        // Sticky bar below the main gate header (top-14)
        "sticky top-14 z-20 -mx-4 px-4 py-2 bg-ink/95 backdrop-blur-md border-b border-line/50 transition-all shadow-xs",
        className,
      )}
    >
      <div
        role="tablist"
        aria-label="Filter kitchens by category"
        className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 scroll-smooth"
      >
        {FOOD_TYPE_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          const count = counts[option.id] ?? 0;

          return (
            <button
              key={option.id}
              role="tab"
              type="button"
              aria-selected={isSelected}
              onClick={() => {
                // Tapping active filter resets back to "all" (except clicking "all" itself)
                if (isSelected && option.id !== "all") {
                  onChange("all");
                } else {
                  onChange(option.id);
                }
              }}
              className={cn(
                "group relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 cursor-pointer select-none active:scale-95 border",
                isSelected
                  ? "bg-saffron text-slate-950 border-saffron shadow-sm shadow-saffron/20 font-bold"
                  : "bg-surface text-muted border-line hover:text-bone hover:border-line-strong hover:bg-surface-raised",
              )}
            >
              <span className="text-sm leading-none" aria-hidden="true">
                {option.emoji}
              </span>
              <span>{option.label}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    "ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10.5px] font-bold transition-colors leading-none",
                    isSelected
                      ? "bg-slate-950/15 text-slate-950"
                      : "bg-surface-raised text-faint group-hover:text-muted",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
