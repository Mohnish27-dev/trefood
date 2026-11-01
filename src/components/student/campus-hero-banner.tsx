"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bike,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gift,
  Heart,
  Percent,
  Plus,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";

import { CampusSearchBar } from "@/components/student/campus-search-bar";
import { FavouriteButton } from "@/components/student/account/favourite-button";
import { getRestaurantImages } from "@/lib/restaurant-media";
import { formatRating, cn } from "@/lib/utils";
import type { CampusSearchIndex, Suggestion } from "@/lib/dish-search";
import type { RestaurantListItem } from "@/server/services/catalog";

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
    title: "Food",
    subtitle: "Meals, Snacks, Biryani & More",
    image: "/categories/food_cat.png",
    cardBg: "bg-[#FFF4EC] dark:bg-amber-950/25",
    cardBorder: "border-[#FCDCC9] dark:border-amber-900/40",
    btnBg: "bg-[#FF6B1A]",
    badgeEmoji: "🍔",
  },
  {
    id: "juice_shakes",
    title: "Fruits & Juices",
    subtitle: "Fresh Fruits, Juices & More",
    image: "/categories/fruits_cat.png",
    cardBg: "bg-[#FFF8E7] dark:bg-yellow-950/25",
    cardBorder: "border-[#FEE6AF] dark:border-yellow-900/40",
    btnBg: "bg-[#EAB308]",
    badgeEmoji: "🍊",
  },
  {
    id: "vegetables",
    title: "Vegetables",
    subtitle: "Fresh Vegetables & Greens",
    image: "/categories/vegetables_cat.png",
    cardBg: "bg-[#F0FDF4] dark:bg-emerald-950/25",
    cardBorder: "border-[#DCFCE7] dark:border-emerald-900/40",
    btnBg: "bg-[#16A34A]",
    badgeEmoji: "🥬",
  },
  {
    id: "groceries",
    title: "Groceries",
    subtitle: "Daily Essentials, Snacks & More",
    image: "/categories/groceries_cat.png",
    cardBg: "bg-[#EFF6FF] dark:bg-sky-950/25",
    cardBorder: "border-[#DBEAFE] dark:border-sky-900/40",
    btnBg: "bg-[#2563EB]",
    badgeEmoji: "🛒",
  },
  {
    id: "chicken",
    title: "Fresh Chicken",
    subtitle: "Fresh Chicken & Meat Cuts",
    image: "/categories/chicken_cat.png",
    cardBg: "bg-[#FFF1F2] dark:bg-rose-950/25",
    cardBorder: "border-[#FFE4E6] dark:border-rose-900/40",
    btnBg: "bg-[#E11D48]",
    badgeEmoji: "🍗",
  },
];

export const CAMPUS_CATEGORY_BOXES: CampusCategoryItem[] = CAMPUS_CORE_CATEGORIES;

export interface HeroCarouselSlide {
  id: string;
  image: string;
  title: string;
  alt: string;
  target: "feed" | "categories";
}

export const HERO_CAROUSEL_SLIDES: HeroCarouselSlide[] = [
  {
    id: "campus-all-in-one",
    image: "/banners/campus-hero-banner-1.jpg",
    title: "One App. Everything You Need on Campus.",
    alt: "One App. Everything You Need on Campus - TreFood",
    target: "feed",
  },
  {
    id: "happy-customers",
    image: "/banners/campus-hero-banner-2.jpg",
    title: "5,000+ Happy Customers - Trusted by the Campus Community",
    alt: "5,000+ Happy Customers - Trusted by the Campus Community - TreFood",
    target: "feed",
  },
  {
    id: "food-and-more",
    image: "/banners/campus-hero-banner-3.jpg",
    title: "Food & More on Your Campus - Food, Fruits, Vegetables, Groceries, Chicken & Meat",
    alt: "Food & More on Your Campus - TreFood",
    target: "categories",
  },
];

interface QuickPickItem {
  name: string;
  price: number;
  restaurant: string;
  restaurantSlug?: string;
  unit?: string;
  prepTime: string;
  image: string;
  isVeg: boolean;
  aliases?: string[];
}

const DEFAULT_QUICK_PICKS: QuickPickItem[] = [
  {
    name: "Veg Burger",
    price: 65,
    restaurant: "Chai Sutta Bar",
    restaurantSlug: "csb",
    prepTime: "10-15 min",
    image: "/csb/burger.jpg",
    isVeg: true,
    aliases: ["Veg Burger", "Aloo Tikki Burger"],
  },
  {
    name: "Masala Dosa",
    price: 99,
    restaurant: "Sone Zone",
    restaurantSlug: "sone-zone",
    prepTime: "15-20 min",
    image: "/categories/masala_dosa.png",
    isVeg: true,
    aliases: ["Masala Dosa"],
  },
  {
    name: "Chicken Biryani",
    price: 140,
    restaurant: "Zaika Biryani",
    restaurantSlug: "zaika",
    prepTime: "15-20 min",
    image: "/zaika/biryani1.jpg",
    isVeg: false,
    aliases: ["Moradabadi Biryani", "Hyderabadi Biryani", "Chicken Biryani", "Chicken Dum Biryani"],
  },
  {
    name: "Mango Shake",
    price: 59,
    restaurant: "Sone Zone",
    restaurantSlug: "sone-zone",
    prepTime: "10-15 min",
    image: "/categories/orange_juice_dish.png",
    isVeg: true,
    aliases: ["Mango Shake", "Orange Juice", "Shake"],
  },
  {
    name: "Margherita Pizza",
    price: 89,
    restaurant: "Wrapchik Pizza",
    restaurantSlug: "wrapchik",
    prepTime: "15-20 min",
    image: "/wrapchick/pizza.jpg",
    isVeg: true,
    aliases: ["Margherita Pizza", "Veg Pizza"],
  },
];

const DAILY_ESSENTIALS_PILLS = [
  {
    id: "vegetables",
    title: "Vegetables",
    image: "/categories/vegetables_cat.png",
  },
  {
    id: "juice_shakes",
    title: "Fruits",
    image: "/categories/fruits_cat.png",
  },
  {
    id: "groceries",
    title: "Groceries",
    image: "/categories/groceries_cat.png",
  },
  {
    id: "chicken",
    title: "Chicken",
    image: "/categories/chicken_cat.png",
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
  restaurants?: RestaurantListItem[];
  campusSlug?: string;
  favouriteIds?: string[];
  signedIn?: boolean;
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
  restaurants = [],
  campusSlug = "nit-patna",
  favouriteIds = [],
  signedIn = false,
}: CampusHeroBannerProps) {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const favouritesSet = new Set(favouriteIds);

  const scrollToFeed = () => {
    const el = document.getElementById("restaurant-feed");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollBy({ top: 400, behavior: "smooth" });
    }
  };

  const scrollToCategories = () => {
    const el = document.getElementById("explore-categories");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Auto-rotate hero banner slide indicators gently (pauses on hover/touch)
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartX.current = touch.clientX;
      setIsPaused(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touch = e.changedTouches[0];
    if (touch) {
      const diff = touchStartX.current - touch.clientX;
      if (diff > 40) {
        // Swiped left -> next slide
        setActiveSlide((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length);
      } else if (diff < -40) {
        // Swiped right -> prev slide
        setActiveSlide((prev) => (prev - 1 + HERO_CAROUSEL_SLIDES.length) % HERO_CAROUSEL_SLIDES.length);
      }
    }
    touchStartX.current = null;
    setIsPaused(false);
  };

  const handleSlideClick = (slide: HeroCarouselSlide) => {
    if (slide.target === "categories") {
      scrollToCategories();
    } else {
      scrollToFeed();
    }
  };

  const handleQuickPickClick = (dish: QuickPickItem) => {
    const searchTerms = [dish.name, ...(dish.aliases || [])].map((s) => s.toLowerCase());

    const targetRest = dish.restaurantSlug
      ? restaurants.find(
          (r) =>
            r.slug.toLowerCase().includes(dish.restaurantSlug!.toLowerCase()) ||
            r.name.toLowerCase().includes(dish.restaurant.toLowerCase()),
        )
      : undefined;

    const matchedDish =
      (targetRest
        ? searchIndex.dishes.find(
            (d) =>
              searchTerms.includes(d.name.toLowerCase()) &&
              d.restaurantIds.includes(targetRest._id),
          )
        : undefined) ??
      searchIndex.dishes.find((d) => searchTerms.includes(d.name.toLowerCase()));

    if (matchedDish) {
      if (targetRest && matchedDish.restaurantIds.includes(targetRest._id) && campusSlug) {
        onSearchChange("");
        router.push(
          `/c/${campusSlug}/r/${targetRest.slug}?dish=${encodeURIComponent(matchedDish.name)}`,
        );
        return;
      }
      onSelectSuggestion(matchedDish);
    } else {
      if (targetRest && campusSlug) {
        onSearchChange("");
        router.push(
          `/c/${campusSlug}/r/${targetRest.slug}?dish=${encodeURIComponent(dish.name)}`,
        );
        return;
      }
      onSearchChange(dish.name);
      scrollToFeed();
    }
  };

  // Dynamically attach live restaurant names & ensure real menu pricing from active restaurants
  const quickPicks = useMemo(() => {
    return DEFAULT_QUICK_PICKS.map((dish) => {
      const searchTerms = [dish.name, ...(dish.aliases || [])].map((s) => s.toLowerCase());

      const targetRest = dish.restaurantSlug
        ? restaurants.find(
            (r) =>
              r.slug.toLowerCase().includes(dish.restaurantSlug!.toLowerCase()) ||
              r.name.toLowerCase().includes(dish.restaurant.toLowerCase()),
          )
        : undefined;

      const matched =
        (targetRest
          ? searchIndex.dishes.find(
              (d) =>
                searchTerms.includes(d.name.toLowerCase()) &&
                d.restaurantIds.includes(targetRest._id),
            )
          : undefined) ??
        searchIndex.dishes.find((d) => searchTerms.includes(d.name.toLowerCase()));

      if (matched) {
        const matchedRest =
          targetRest ??
          restaurants.find((r) => matched.restaurantIds.includes(r._id));

        return {
          ...dish,
          restaurant: matchedRest ? matchedRest.name : dish.restaurant,
        };
      }
      return dish;
    });
  }, [searchIndex.dishes, restaurants]);

  // Popular restaurants to display on homepage
  const popularRestaurants = restaurants.slice(0, 6);

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

      {/* ── 2. Hero 3-Slide Carousel Card ───────────────────────────── */}
      <div
        className="space-y-2 select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#eedfd8] dark:border-line bg-gradient-to-br from-[#800020] via-[#650019] to-[#450011] shadow-lg">
          {/* Sliding Track for 3 Hero Banners */}
          <div
            className="flex w-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {HERO_CAROUSEL_SLIDES.map((slide, idx) => (
              <div
                key={slide.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSlideClick(slide)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSlideClick(slide);
                  }
                }}
                className="relative min-w-full aspect-[1024/485] cursor-pointer overflow-hidden focus:outline-none"
                aria-label={slide.title}
              >
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 512px"
                  priority={idx === 0}
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                />
                {/* Subtle interactive sheen */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </div>

          {/* Desktop Next/Prev Arrow Controls */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveSlide((prev) => (prev - 1 + HERO_CAROUSEL_SLIDES.length) % HERO_CAROUSEL_SLIDES.length);
            }}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
          >
            <ChevronLeft className="size-4 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveSlide((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length);
            }}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
          >
            <ChevronRight className="size-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Carousel pagination indicator dots */}
        <div className="flex items-center justify-center gap-1.5 pt-0.5">
          {HERO_CAROUSEL_SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(idx)}
              aria-label={`Go to slide ${idx + 1}: ${slide.title}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                activeSlide === idx
                  ? "w-5 bg-tf-maroon dark:bg-rose-400"
                  : "w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400",
              )}
            />
          ))}
        </div>
      </div>

      {/* ── 3. Explore Categories (Food, Fruits, Vegetables, Groceries, Fresh Chicken) ── */}
      <section id="explore-categories" className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-bone">
            Explore Categories
          </h2>
          <button
            type="button"
            onClick={() => {
              onSelectCategory(null);
              scrollToFeed();
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-tf-maroon dark:text-rose-400 hover:underline cursor-pointer"
          >
            <span>See all</span>
            <ArrowRight className="size-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* 5 Categories Rail matching Reference */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {CAMPUS_CORE_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onSelectCategory(isSelected ? null : cat.id);
                  scrollToFeed();
                }}
                className={cn(
                  "group relative flex w-[88px] sm:w-[94px] shrink-0 flex-col items-center justify-between rounded-2xl p-2 text-center transition-all border cursor-pointer select-none",
                  cat.cardBg,
                  cat.cardBorder,
                  isSelected
                    ? "ring-2 ring-tf-maroon dark:ring-rose-400 shadow-md scale-[1.02]"
                    : "hover:shadow-sm active:scale-95",
                )}
              >
                {/* Category Image */}
                <div className="relative size-14 sm:size-16 overflow-hidden rounded-xl border border-black/5 bg-white/60 dark:bg-black/20 shadow-2xs">
                  <Image
                    src={cat.image}
                    alt={cat.title}
                    fill
                    sizes="64px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                </div>

                {/* Title & Subtitle */}
                <div className="mt-1.5 w-full">
                  <h3 className="font-display text-[11px] font-bold leading-tight text-slate-900 dark:text-bone truncate">
                    {cat.title}
                  </h3>
                  <p className="mt-0.5 text-[8px] text-slate-500 dark:text-muted leading-tight line-clamp-2">
                    {cat.subtitle}
                  </p>
                </div>

                {/* Selected Checkmark Badge */}
                {isSelected ? (
                  <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-tf-maroon text-white text-[9px] font-black shadow-xs">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 4. Promotional Offer Cards Strip (3 Cards) ─────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* Offer 1: 50% OFF */}
        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/25 border border-rose-200/90 dark:border-rose-900/40 px-3 py-2 text-rose-800 dark:text-rose-300 shadow-2xs">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white shadow-xs">
            <Percent className="size-4 stroke-[2.5]" />
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-xs font-black">Up to 50% OFF</span>
            <span className="text-[9.5px] font-semibold text-rose-600/90 dark:text-rose-400">
              for New Users
            </span>
          </div>
        </div>

        {/* Offer 2: 20% OFF */}
        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-purple-50 dark:bg-purple-950/25 border border-purple-200/90 dark:border-purple-900/40 px-3 py-2 text-purple-800 dark:text-purple-300 shadow-2xs">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
            <Gift className="size-4 stroke-[2.5]" />
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-xs font-black">Up to 20% OFF</span>
            <span className="text-[9.5px] font-semibold text-purple-600/90 dark:text-purple-400">
              for Regular Users
            </span>
          </div>
        </div>

        {/* Offer 3: ZERO Fee */}
        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200/90 dark:border-amber-900/40 px-3 py-2 text-amber-900 dark:text-amber-300 shadow-2xs">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
            <Bike className="size-4 stroke-[2.5]" />
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-xs font-black">ZERO Delivery Fee</span>
            <span className="text-[9.5px] font-semibold text-amber-700/90 dark:text-amber-400">
              on Eligible Orders
            </span>
          </div>
        </div>
      </div>

      {/* ── 5. Secondary Highlight Banner: Fresh & Daily Essentials ─── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          onSelectCategory("vegetables");
          scrollToFeed();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectCategory("vegetables");
            scrollToFeed();
          }
        }}
        className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-[#DCFCE7] via-[#ECFDF5] to-[#F0FDF4] dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/30 p-3 sm:p-3.5 border border-[#86EFAC]/80 dark:border-emerald-800/40 shadow-xs hover:shadow-sm cursor-pointer transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          {/* Vegetable Basket Artwork */}
          <div className="relative size-14 sm:size-16 shrink-0 overflow-hidden rounded-xl border border-emerald-600/10 shadow-xs">
            <Image
              src="/categories/veg_basket.png"
              alt="Fresh vegetables and daily essentials"
              fill
              sizes="64px"
              className="object-cover transition-transform group-hover:scale-105"
            />
          </div>

          <div className="flex flex-col">
            <h3 className="font-display text-xs sm:text-sm font-bold text-slate-900 dark:text-bone leading-tight">
              Fresh &amp; Daily Essentials <br />
              <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                Now on TreFood!
              </span>
            </h3>
            <p className="mt-1 text-[9px] sm:text-[10px] font-semibold text-slate-600 dark:text-muted">
              Vegetables • Groceries • Fresh Chicken
            </p>
          </div>
        </div>

        {/* Shop Now CTA */}
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer group-hover:translate-x-0.5"
        >
          <span>Shop Now</span>
          <ArrowRight className="size-3 stroke-[2.5]" />
        </button>
      </div>

      {/* ── 6. Quick Picks For You (Burger, Dosa, Biryani, Juice, Veggies) ── */}
      <section className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-bone">
            Quick picks for you
          </h2>
          <button
            type="button"
            onClick={scrollToFeed}
            className="inline-flex items-center gap-1 text-xs font-bold text-tf-maroon dark:text-rose-400 hover:underline cursor-pointer"
          >
            <span>See all</span>
            <ArrowRight className="size-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Quick Picks Horizontal Rail */}
        <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {quickPicks.map((dish) => (
            <div
              key={dish.name}
              onClick={() => handleQuickPickClick(dish)}
              className="relative flex w-[130px] sm:w-[140px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-2xs hover:shadow-sm hover:border-tf-maroon/30 transition-all group cursor-pointer"
            >
              {/* Dish Image with Prep Time Badge */}
              <div className="relative h-20 w-full overflow-hidden rounded-xl bg-surface-raised border border-line/60">
                <Image
                  src={dish.image}
                  alt={dish.name}
                  fill
                  sizes="140px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/65 backdrop-blur-xs px-1.5 py-0.5 text-[8.5px] font-bold text-white shadow-2xs">
                  <Clock className="size-2.5 text-tf-yellow" />
                  <span>{dish.prepTime}</span>
                </span>
              </div>

              {/* Title, Restaurant, Price and (+) Button */}
              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xs font-bold text-slate-900 dark:text-bone group-hover:text-tf-maroon dark:group-hover:text-rose-400 transition-colors">
                    {dish.name}
                  </p>
                  <p className="truncate text-[10px] font-medium text-slate-500 dark:text-muted">
                    {dish.restaurant}
                  </p>
                  <p className="text-xs font-black text-tf-maroon dark:text-rose-400">
                    ₹{dish.price}
                    {dish.unit ? (
                      <span className="text-[9px] font-normal text-muted">
                        {dish.unit}
                      </span>
                    ) : null}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickPickClick(dish);
                  }}
                  aria-label={`Select ${dish.name} from ${dish.restaurant}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tf-maroon hover:bg-tf-maroon-deep text-white shadow-xs active:scale-90 transition-all cursor-pointer"
                >
                  <Plus className="size-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 7. Popular Restaurants (Reference Card Row) ─────────────── */}
      {popularRestaurants.length > 0 ? (
        <section className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-bone">
              Popular Restaurants
            </h2>
            <button
              type="button"
              onClick={scrollToFeed}
              className="inline-flex items-center gap-1 text-xs font-bold text-tf-maroon dark:text-rose-400 hover:underline cursor-pointer"
            >
              <span>See all</span>
              <ArrowRight className="size-3.5 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {popularRestaurants.map((restaurant) => {
              const images = getRestaurantImages(restaurant);
              const mainPhoto = images[0] || "/kolkata_biyani/biryani.jpg";
              const isFav = favouritesSet.has(restaurant._id);

              return (
                <div
                  key={restaurant._id}
                  className="relative flex w-[210px] sm:w-[230px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xs hover:shadow-md transition-all group"
                >
                  {/* Photo with Favourite Button */}
                  <div className="relative h-28 w-full overflow-hidden bg-surface-raised">
                    <Image
                      src={mainPhoto}
                      alt={restaurant.name}
                      fill
                      sizes="230px"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    <FavouriteButton
                      restaurantId={restaurant._id}
                      restaurantName={restaurant.name}
                      initialFavourited={isFav}
                      signedIn={signedIn}
                      className="absolute right-2 top-2 z-10"
                    />
                  </div>

                  {/* Body Content */}
                  <Link
                    href={`/c/${campusSlug}/r/${restaurant.slug}`}
                    className="flex flex-1 flex-col justify-between p-2.5 text-left"
                  >
                    <div>
                      <h3 className="font-display text-xs sm:text-sm font-bold text-slate-900 dark:text-bone truncate group-hover:text-tf-maroon dark:group-hover:text-rose-400 transition-colors">
                        {restaurant.name}
                      </h3>

                      {/* Rating + Time row */}
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-muted">
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                          <Star className="size-2.5 fill-white text-white" />
                          <span>
                            {restaurant.rating !== null
                              ? formatRating(restaurant.rating)
                              : "New"}
                          </span>
                          {restaurant.ratingCount ? (
                            <span className="opacity-90">
                              ({restaurant.ratingCount})
                            </span>
                          ) : null}
                        </span>

                        <span>•</span>
                        <span>
                          {restaurant.prepMinutes}-{restaurant.prepMinutes + 10} min
                        </span>
                        <span>•</span>
                        <span>Min ₹{Math.round(restaurant.minOrderPaise / 100)}</span>
                      </div>
                    </div>

                    {/* Tag Pills matching Reference */}
                    <div className="mt-2 flex flex-wrap items-center gap-1 pt-1 border-t border-line/60 text-[9px] font-bold">
                      <span className="inline-flex items-center gap-1 rounded bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 text-rose-700 dark:text-rose-400">
                        <Bike className="size-2.5 text-rose-600" />
                        <span>ZERO Delivery Fee</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-purple-50 dark:bg-purple-950/20 px-1.5 py-0.5 text-purple-700 dark:text-purple-400">
                        <Gift className="size-2.5 text-purple-600" />
                        <span>Student Offers</span>
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── 8. Shop Daily Essentials Quick Pills ──────────────────────── */}
      <section className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-bone">
            Shop Daily Essentials
          </h2>
          <button
            type="button"
            onClick={() => {
              onSelectCategory("groceries");
              scrollToFeed();
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-tf-maroon dark:text-rose-400 hover:underline cursor-pointer"
          >
            <span>See all</span>
            <ArrowRight className="size-3.5 stroke-[2.5]" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DAILY_ESSENTIALS_PILLS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectCategory(item.id);
                scrollToFeed();
              }}
              className="flex items-center justify-between rounded-xl border border-line bg-surface p-2 text-left hover:border-emerald-500/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all cursor-pointer shadow-2xs group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-surface-raised border border-line">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="32px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <span className="truncate font-display text-xs font-bold text-slate-900 dark:text-bone">
                  {item.title}
                </span>
              </div>

              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="size-2.5 stroke-[2.5]" />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}