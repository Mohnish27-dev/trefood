import { ArrowLeft, Clock, Phone, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/shared/money";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { CartBar } from "@/components/student/cart-bar";
import { RestaurantMenuSearch } from "@/components/student/restaurant-menu-search";
import { formatRating } from "@/lib/utils";
import {
  getCampusBySlug,
  getMenu,
  getRestaurantBySlug,
  isRestaurantServing,
} from "@/server/services/catalog";
import { campusLocalMinutes, formatTime12h } from "@/server/services/curfew";

export const dynamic = "force-dynamic";

export default async function MenuPage({
  params,
}: PageProps<"/c/[campusSlug]/r/[restaurantSlug]">) {
  const { campusSlug, restaurantSlug } = await params;

  const [campus, restaurant] = await Promise.all([
    getCampusBySlug(campusSlug),
    getRestaurantBySlug(restaurantSlug),
  ]);

  if (!campus || !restaurant || restaurant.campusId !== campus._id) notFound();

  const sections = await getMenu(restaurant._id);
  const nowMinutes = campusLocalMinutes(new Date(), campus.timezone);
  const isServing = isRestaurantServing(restaurant, nowMinutes);

  const outOfStockCount = sections.reduce(
    (n, s) => n + s.items.filter((i) => !i.isAvailable).length,
    0,
  );

  const highlightTag =
    restaurant.rating !== null && restaurant.rating >= 4.5
      ? `🏅 Best in ${restaurant.cuisines[0] || "Campus"}`
      : null;

  return (
    <>
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0b0f19] text-white pt-safe">
        <div className="flex min-h-14 items-center gap-2 px-3">
          <Link
            href={`/c/${campusSlug}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Back to restaurants"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-white">
            {restaurant.name}
          </h1>
          <a
            href={`tel:${restaurant.phone}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            aria-label={`Call ${restaurant.name}`}
          >
            <Phone className="size-5" />
          </a>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Swiggy-Style Hero Container (Dark Backdrop) ──────────── */}
      <section className="bg-[#0b0f19] px-4 sm:px-5 pt-1 pb-7 sm:pb-8 rounded-b-[2.5rem] shadow-2xl">
        {/* ── Floating Box (White in Light Mode, Dark in Dark Mode) ── */}
        <div className="restaurant-hero-card rounded-[1.35rem] p-4 sm:p-5 border transition-colors duration-200">
          {/* Top Tag & Serving Status Row */}
          <div className="mb-2 flex items-center justify-between gap-2">
            {highlightTag ? (
              <p className="text-xs font-semibold text-saffron tracking-tight">
                {highlightTag}
              </p>
            ) : (
              <span />
            )}

            {isServing ? (
              <Badge tone="success" className="px-2.5 py-0.5 text-[11px] font-medium shadow-2xs">
                <span className="size-1.5 rounded-full bg-mint" />
                Open now ({formatTime12h(restaurant.opensMinutes)} – {formatTime12h(restaurant.closesMinutes)})
              </Badge>
            ) : (
              <Badge tone="warning" className="px-2.5 py-0.5 text-[11px] font-medium shadow-2xs">
                Closed · opens {formatTime12h(restaurant.opensMinutes)}
              </Badge>
            )}
          </div>

          {/* Restaurant Title & Rating Badge Row */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="hero-card-title font-display text-xl sm:text-2xl font-bold tracking-tight leading-tight">
              {restaurant.name}
            </h2>

            {restaurant.rating !== null ? (
              <div className="flex flex-col items-end shrink-0">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs">
                  <Star className="size-3 fill-white text-white" />
                  <span>{formatRating(restaurant.rating)}</span>
                </span>
                <span className="hero-card-subtext mt-0.5 text-[10px] font-medium">
                  {restaurant.ratingCount} ratings
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs shrink-0">
                <Star className="size-3 fill-white text-white" />
                <span>New</span>
              </span>
            )}
          </div>

          {/* Prep Time & Campus Location Line */}
          <div className="hero-card-subtext mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 font-medium">
              <Clock className="size-3.5 opacity-70" />
              {restaurant.prepMinutes}-{restaurant.prepMinutes + 5} min prep
            </span>
            <span className="opacity-40">•</span>
            <span className="hero-card-strong font-medium">{campus.name}</span>
            <span className="opacity-40">•</span>
            <span>{formatTime12h(restaurant.opensMinutes)} to {formatTime12h(restaurant.closesMinutes)}</span>
          </div>

          {/* Cuisines & Min Order Line */}
          <div className="hero-card-subtext mt-1 flex items-center justify-between text-xs">
            <p className="truncate pr-2 font-normal">
              {restaurant.cuisines.join(", ")}
            </p>
            <span className="hero-card-strong shrink-0 font-semibold">
              Min <Money paise={restaurant.minOrderPaise} />
              {restaurant.lateNightMinOrderPaise ? (
                <span className="text-[11px] font-normal text-muted ml-1">
                  (₹{restaurant.lateNightMinOrderPaise / 100} after 12:00 AM)
                </span>
              ) : null}
            </span>
          </div>

          {/* Campus Night Safety Protocol */}
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
            <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-400" />
            <p className="leading-relaxed">
              <span className="font-semibold text-white">Campus Night Safety:</span> After 7:00 PM, deliveries are handled personally by the restaurant owner, co-owner, or senior staff with complete trust to ensure campus premises safety.
            </p>
          </div>

          {/* Divider */}
          <div className="hero-card-divider my-3 border-t" />

          {/* Hotel Description */}
          <p className="hero-card-subtext text-xs sm:text-[13px] leading-relaxed font-normal">
            {restaurant.description}
          </p>

          {/* Out-of-Stock Badge (if applicable) */}
          {outOfStockCount > 0 ? (
            <p className="hero-card-chip mt-2.5 rounded-md border px-2.5 py-1 text-[11px] font-medium">
              {outOfStockCount} item{outOfStockCount === 1 ? " is" : "s are"} out of stock today
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Search & Menu (Directly under the black box) ───────────── */}
      <RestaurantMenuSearch
        sections={sections}
        restaurantId={restaurant._id}
        restaurantSlug={restaurant.slug}
        campusSlug={campusSlug}
        restaurantIsOpen={isServing}
      />

      <CartBar />
    </>
  );
}
