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
        // Sticky bar below the main gate header (top-14 + notch safe area on mobile)
        "sticky top-[calc(3.5rem+max(env(safe-area-inset-top),0rem))] z-20 -mx-4 px-2.5 sm:px-4 py-2 bg-ink/95 backdrop-blur-md border-b border-line/50 transition-all shadow-xs",
        className,
      )}
    >
      <div
        role="tablist"
        aria-label="Filter kitchens by category"
        className="grid grid-cols-4 gap-1.5 sm:gap-2 py-0.5 w-full"
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
                "group relative flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 rounded-full px-1.5 sm:px-3 py-2 sm:py-1.5 text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 border",
                isSelected
                  ? "bg-saffron text-slate-950 border-saffron shadow-sm shadow-saffron/20 font-bold"
                  : "bg-surface text-muted border-line hover:text-bone hover:border-line-strong hover:bg-surface-raised",
              )}
            >
              <span className="text-sm leading-none shrink-0" aria-hidden="true">
                {option.emoji}
              </span>
              <span className="truncate">{option.label}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    "ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] sm:text-[10.5px] font-bold transition-colors leading-none shrink-0",
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
