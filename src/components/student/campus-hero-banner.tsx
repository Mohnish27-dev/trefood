"use client";

import { CampusSearchBar } from "@/components/student/campus-search-bar";
import { cn } from "@/lib/utils";
import type { CampusSearchIndex, Suggestion } from "@/lib/dish-search";

export interface CampusCategoryBox {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  badgeEmoji: string;
  bgColor: string;
  accentBg: string;
  textColor: string;
}

export const CAMPUS_CATEGORY_BOXES: CampusCategoryBox[] = [
  {
    id: "senior",
    tag: "TOP PICKS",
    title: "Senior Recommends",
    subtitle: "Hostel favorites",
    badgeEmoji: "🍔",
    bgColor: "bg-[#ffd43b]",
    accentBg: "bg-amber-500/20",
    textColor: "text-slate-950",
  },
  {
    id: "budget",
    tag: "BUDGET",
    title: "Dishes Under ₹99",
    subtitle: "Student meals",
    badgeEmoji: "🏷️",
    bgColor: "bg-[#ffd43b]",
    accentBg: "bg-amber-500/20",
    textColor: "text-slate-950",
  },
  {
    id: "fast",
    tag: "FAST PREP",
    title: "Food In 15 Mins",
    subtitle: "Quick snacks",
    badgeEmoji: "⚡",
    bgColor: "bg-[#ffd43b]",
    accentBg: "bg-amber-500/20",
    textColor: "text-slate-950",
  },
  {
    id: "latenight",
    tag: "CURFEW",
    title: "Late Night Bites",
    subtitle: "Study sessions",
    badgeEmoji: "🌙",
    bgColor: "bg-[#ffd43b]",
    accentBg: "bg-amber-500/20",
    textColor: "text-slate-950",
  },
  {
    id: "biryani_rolls",
    tag: "FEAST",
    title: "Biryani & Rolls",
    subtitle: "Filling combos",
    badgeEmoji: "🌯",
    bgColor: "bg-[#ffd43b]",
    accentBg: "bg-amber-500/20",
    textColor: "text-slate-950",
  },
  {
    id: "chai_maggi",
    tag: "CLASSIC",
    title: "Chai & Maggi",
    subtitle: "Hot sips & snacks",
    badgeEmoji: "☕",
    bgColor: "bg-[#ffd43b]",
    accentBg: "bg-amber-500/20",
    textColor: "text-slate-950",
  },
];

interface CampusHeroBannerProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  searchIndex: CampusSearchIndex;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  onSearchWake?: () => void;
  searchIndexLoading?: boolean;
}

export function CampusHeroBanner({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  searchIndex,
  onSelectSuggestion,
  onSearchWake,
  searchIndexLoading = false,
}: CampusHeroBannerProps) {
  return (
    /**
     * The artwork is clipped by a CHILD layer rather than by this container.
     * The suggestion panel has to be able to spill past the banner's rounded
     * bottom edge, and an `overflow-hidden` here would slice it in half.
     */
    <div className="relative -mx-4 -mt-4 pt-3 pb-4 rounded-b-[2.5rem] shadow-xl bg-[#270c5e]">
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-b-[2.5rem] overflow-hidden"
        style={{
          backgroundImage: "url('/homePageBackground.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* ── Swiggy-Style Search Bar + Live Dish Suggestions ─────────── */}
      <div className="relative z-40 px-4">
        <CampusSearchBar
          value={searchQuery}
          onChange={onSearchChange}
          index={searchIndex}
          onWake={onSearchWake}
          onSelect={onSelectSuggestion}
          loading={searchIndexLoading}
        />
      </div>

      {/* ── Delivery Guy, Scooter & Food Artwork Space (Reduced height, zero overlap) ─── */}
      <div className="h-[270px] sm:h-[320px] w-full pointer-events-none" aria-hidden="true" />

      {/* ── 6 Yellow Boxes Carousel (Indented from left initially, smooth scroll left) ─── */}
      <div className="relative px-4 scroll-px-4 flex gap-3 sm:gap-3.5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth">
        {CAMPUS_CATEGORY_BOXES.map((box) => {
          const isSelected = selectedCategory === box.id;
          return (
            <button
              key={box.id}
              type="button"
              onClick={() => onSelectCategory(isSelected ? null : box.id)}
              className={cn(
                "relative flex flex-col justify-between rounded-2xl p-2.5 text-left shrink-0 select-none snap-start",
                // Compact height, 4 cards visible at once, constant size (no hover/active scaling)
                "w-[98px] sm:w-[102px] h-[122px] sm:h-[130px]",
                box.bgColor,
                box.textColor,
                isSelected
                  ? "ring-2 ring-white shadow-xl"
                  : "shadow-md",
              )}
            >
              {/* 1. Upper Written Text: Tag & Title */}
              <div>
                <span
                  className={cn(
                    "inline-block rounded px-1.5 py-0.5 text-[6.5px] sm:text-[7px] font-black uppercase tracking-wider",
                    box.accentBg,
                    "text-slate-900/90",
                  )}
                >
                  {box.tag}
                </span>
                <h3 className="font-display text-[10.5px] sm:text-[11px] font-black leading-tight mt-0.5 text-slate-950 line-clamp-2">
                  {box.title}
                </h3>
              </div>

              {/* 2. Middle: Increased Size Image / Icon in between upper and lower text */}
              <div className="flex items-center justify-center my-auto py-0.5">
                <span className="text-3xl sm:text-4xl leading-none select-none drop-shadow-2xs">
                  {box.badgeEmoji}
                </span>
              </div>

              {/* 3. Lower Written Text: Subtitle */}
              <div>
                <p className="text-[7.5px] sm:text-[8px] font-bold text-slate-800/85 leading-snug line-clamp-1">
                  {box.subtitle}
                </p>
              </div>

              {/* Active Selection Indicator Badge */}
              {isSelected ? (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-slate-950 text-white text-[8.5px] font-black shadow-md">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
