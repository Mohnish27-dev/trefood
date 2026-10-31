"use client";

import Image from "next/image";
import {
  ArrowRight,
  Bike,
  Clock,
  Gift,
  Percent,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";

import { CampusSearchBar } from "@/components/student/campus-search-bar";
import { TreFoodEmblem } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import type { CampusSearchIndex, Suggestion } from "@/lib/dish-search";

export interface CampusCategoryItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  cardBg: string;
  cardBorder: string;
  btnBg: string;
  badgeEmoji?: string;
}

export const CAMPUS_CORE_CATEGORIES: CampusCategoryItem[] = [
  {
    id: "food",
    title: "Food Delivery",
    subtitle: "Meals, Snacks, Biryani & More",
    image: "/categories/food.jpg",
    cardBg: "bg-[#FFF4EC] dark:bg-amber-950/25",
    cardBorder: "border-[#FCDCC9] dark:border-amber-900/40",
    btnBg: "bg-[#FF6B1A]",
    badgeEmoji: "🍔",
  },
  {
    id: "juice_shakes",
    title: "Fruits & Juices",
    subtitle: "Fresh Fruits, Juices & More",
    image: "/categories/juices.jpg",
    cardBg: "bg-[#EEFAF3] dark:bg-emerald-950/25",
    cardBorder: "border-[#D0F2E0] dark:border-emerald-900/40",
    btnBg: "bg-[#16A34A]",
    badgeEmoji: "🍊",
  },
  {
    id: "groceries",
    title: "Groceries",
    subtitle: "Daily Essentials, Snacks & More",
    image: "/categories/fruits.jpg",
    cardBg: "bg-[#EFF6FF] dark:bg-sky-950/25",
    cardBorder: "border-[#D1E5FF] dark:border-sky-900/40",
    btnBg: "bg-[#2563EB]",
    badgeEmoji: "🛒",
  },
];

export const CAMPUS_CATEGORY_BOXES: CampusCategoryItem[] = CAMPUS_CORE_CATEGORIES;

interface QuickPickItem {
  name: string;
  price: number;
  prepTime: string;
  image: string;
  isVeg: boolean;
}

const DEFAULT_QUICK_PICKS: QuickPickItem[] = [
  {
    name: "Veg Burger",
    price: 79,
    prepTime: "10-15 min",
    image: "/csb/burger.jpg",
    isVeg: true,
  },
  {
    name: "Masala Dosa",
    price: 89,
    prepTime: "15-20 min",
    image: "/kolkata_biyani/chowmein.jpg",
    isVeg: true,
  },
  {
    name: "Fresh Juice",
    price: 59,
    prepTime: "10-15 min",
    image: "/categories/juices.jpg",
    isVeg: true,
  },
  {
    name: "Chicken Biryani",
    price: 129,
    prepTime: "20-30 min",
    image: "/kolkata_biyani/biryani.jpg",
    isVeg: false,
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
  const scrollToFeed = () => {
    window.scrollBy({ top: 400, behavior: "smooth" });
  };

  const handleQuickPickClick = (dishName: string) => {
    const matchedDish = searchIndex.dishes.find(
      (d) => d.name.toLowerCase() === dishName.toLowerCase(),
    );
    if (matchedDish) {
      onSelectSuggestion(matchedDish);
    } else {
      onSearchChange(dishName);
    }
  };

  return (
    <div className="space-y-4 pt-1">
      {/* ── 1. Search Bar ───────────────────────────────────────────── */}
      <div className="relative z-40">
        <CampusSearchBar
          value={searchQuery}
          onChange={onSearchChange}
          index={searchIndex}
          onWake={onSearchWake}
          onSelect={onSelectSuggestion}
          loading={searchIndexLoading}
        />
      </div>

      {/* ── 2. Hero Promo Banner Card (Maroon Gradient + Gold Action) ── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#800020] via-[#650019] to-[#450011] p-4 sm:p-5 text-white shadow-xl">
        {/* Subtle decorative glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-tf-yellow/15 blur-3xl"
        />

        <div className="relative z-10 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="max-w-[62%] sm:max-w-[65%]">
              {/* Brand Wordmark Tag */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="font-display font-black text-sm tracking-tight text-white">
                  Tre<span className="text-tf-yellow">Food</span>
                </span>
                <span className="text-[7.5px] font-bold uppercase tracking-wider text-white/70">
                  Campus Food &amp; Essentials
                </span>
              </div>

              {/* Bold Headline */}
              <h2 className="font-display text-xl sm:text-2xl font-black leading-tight tracking-tight text-white drop-shadow-sm">
                Everything You Need,{" "}
                <span className="text-tf-yellow">On Campus!</span>
              </h2>

              {/* 3 Perks Pills */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] font-bold text-white/90">
                <span className="inline-flex items-center gap-1">
                  <Bike className="size-3 text-tf-yellow" />
                  <span>ZERO Delivery Fee</span>
                </span>
                <span className="text-white/40">•</span>
                <span className="inline-flex items-center gap-1">
                  <Zap className="size-3 text-tf-yellow" />
                  <span>10-20 min Delivery</span>
                </span>
              </div>

              {/* Order Now CTA */}
              <div className="mt-3.5">
                <button
                  type="button"
                  onClick={scrollToFeed}
                  className="inline-flex items-center gap-1.5 rounded-full bg-tf-yellow px-4 sm:px-5 py-2 text-xs sm:text-sm font-black text-slate-950 shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Order Now</span>
                  <ArrowRight className="size-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Right Side: Hero Visual Badge */}
            <div className="relative shrink-0 flex flex-col items-center justify-center">
              <div className="relative size-24 sm:size-28 overflow-hidden rounded-2xl border-2 border-white/20 shadow-lg">
                <Image
                  src="/kolkata_biyani/biryani.jpg"
                  alt="Delicious campus food spread"
                  fill
                  sizes="120px"
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <span className="absolute bottom-1 inset-x-1 text-center rounded bg-tf-maroon/90 text-white text-[8px] font-bold py-0.5 tracking-wider uppercase">
                  ZERO Fee
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Three Category Cards (Food Delivery, Fruits & Juices, Groceries) ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {CAMPUS_CORE_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl p-2.5 sm:p-3 text-left transition-all border cursor-pointer select-none",
                cat.cardBg,
                cat.cardBorder,
                isSelected
                  ? "ring-2 ring-tf-maroon shadow-md scale-[1.02]"
                  : "hover:shadow-sm active:scale-[0.98]",
              )}
            >
              {/* Top: Category Image */}
              <div className="relative mx-auto size-14 sm:size-16 overflow-hidden rounded-xl border border-black/5 shadow-2xs">
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  sizes="64px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              </div>

              {/* Middle: Title & Subtitle */}
              <div className="mt-2 text-center">
                <h3 className="font-display text-[11px] sm:text-xs font-bold leading-tight text-slate-900 dark:text-bone line-clamp-1">
                  {cat.title}
                </h3>
                <p className="mt-0.5 text-[8.5px] sm:text-[9px] text-slate-500 dark:text-muted leading-tight line-clamp-1">
                  {cat.subtitle}
                </p>
              </div>

              {/* Bottom: Arrow Badge Button */}
              <div className="mt-2 flex justify-center">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-white shadow-xs transition-transform group-hover:translate-x-0.5",
                    cat.btnBg,
                  )}
                >
                  <ArrowRight className="size-3 stroke-[2.5]" />
                </span>
              </div>

              {/* Selection Indicator */}
              {isSelected ? (
                <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-tf-maroon text-white text-[8px] font-black shadow-xs">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── 4. Promotional Offer Chips Strip ───────────────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 pt-0.5">
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 px-3 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 shadow-2xs">
          <Percent className="size-3.5 shrink-0 text-rose-600" />
          <span>Up to 50% OFF for New Users</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-purple-50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 px-3 py-1 text-[11px] font-bold text-purple-700 dark:text-purple-400 shadow-2xs">
          <Gift className="size-3.5 shrink-0 text-purple-600" />
          <span>Up to 20% OFF for Regular Users</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 px-3 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 shadow-2xs">
          <Bike className="size-3.5 shrink-0 text-amber-600" />
          <span>ZERO Delivery Fee</span>
        </div>
      </div>

      {/* ── 5. Quick Picks For You ───────────────────────────────────── */}
      <div className="pt-2">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-bone">
            Quick picks for you
          </h3>
          <button
            type="button"
            onClick={scrollToFeed}
            className="inline-flex items-center gap-0.5 text-xs font-bold text-tf-maroon dark:text-rose-400 hover:underline cursor-pointer"
          >
            <span>See all</span>
            <ArrowRight className="size-3 stroke-[2.5]" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DEFAULT_QUICK_PICKS.map((dish) => (
            <div
              key={dish.name}
              className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-2.5 shadow-xs hover:shadow-sm transition-all group"
            >
              {/* Dish Image with Prep Time Badge */}
              <div className="relative h-24 w-full overflow-hidden rounded-xl bg-surface-raised border border-line/60">
                <Image
                  src={dish.image}
                  alt={dish.name}
                  fill
                  sizes="(max-width: 640px) 140px, 120px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[9px] font-bold text-white">
                  <Clock className="size-2.5 text-tf-yellow" />
                  <span>{dish.prepTime}</span>
                </span>
              </div>

              {/* Title & Price Row with Maroon (+) Button */}
              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xs font-bold text-bone">
                    {dish.name}
                  </p>
                  <p className="text-xs font-black text-tf-maroon dark:text-rose-400">
                    ₹{dish.price}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleQuickPickClick(dish.name)}
                  aria-label={`Select ${dish.name}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tf-maroon hover:bg-tf-maroon-deep text-white shadow-xs active:scale-90 transition-all cursor-pointer"
                >
                  <Plus className="size-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
