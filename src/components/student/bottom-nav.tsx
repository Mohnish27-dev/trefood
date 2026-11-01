"use client";

import { ClipboardList, Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

/**
 * A maroon bar under the tab that was just tapped while route is on wire.
 */
function TapHint() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      aria-hidden
      className="nav-tap-hint absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-tf-maroon animate-pulse"
    />
  );
}

export function BottomNav({ campusSlug }: { campusSlug: string | null }) {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const activeCampus = campusSlug ?? "nit-patna";

  const handleCategoriesClick = (e: React.MouseEvent) => {
    if (pathname.startsWith(`/c/${activeCampus}`)) {
      const el = document.getElementById("explore-categories");
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8ded9] dark:border-line bg-white/95 dark:bg-surface/95 backdrop-blur-xl shadow-[0_-4px_24px_rgba(131,0,32,0.06)] pb-safe"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-center justify-between px-2">
        {/* 1. Home */}
        {(() => {
          const isHome =
            pathname === `/c/${activeCampus}` ||
            pathname === `/c/${activeCampus}/` ||
            pathname === "/";
          return (
            <Link
              href={`/c/${activeCampus}`}
              aria-current={isHome ? "page" : undefined}
              className={cn(
                "relative flex flex-1 min-h-14 flex-col items-center justify-center gap-1 py-1 transition-all select-none",
                isHome
                  ? "text-tf-maroon dark:text-rose-400 font-bold"
                  : "text-[#7a7472] dark:text-muted hover:text-tf-maroon dark:hover:text-bone",
              )}
            >
              <Home
                className={cn(
                  "size-5 transition-transform",
                  isHome && "scale-110 stroke-[2.4]",
                )}
              />
              <span className="text-[10px] sm:text-[11px] font-medium leading-none">
                Home
              </span>
              {isHome ? (
                <span
                  aria-hidden
                  className="absolute inset-x-4 bottom-0 h-0.75 rounded-t-full bg-tf-maroon dark:bg-rose-400"
                />
              ) : null}
              <TapHint />
            </Link>
          );
        })()}

        {/* 2. Categories */}
        <Link
          href={`/c/${activeCampus}#explore-categories`}
          onClick={handleCategoriesClick}
          className={cn(
            "relative flex flex-1 min-h-14 flex-col items-center justify-center gap-1 py-1 transition-all select-none text-[#7a7472] dark:text-muted hover:text-tf-maroon dark:hover:text-bone",
          )}
        >
          <LayoutGrid className="size-5 transition-transform hover:scale-110 stroke-[2]" />
          <span className="text-[10px] sm:text-[11px] font-medium leading-none">
            Categories
          </span>
          <TapHint />
        </Link>

        {/* 3. Elevated Circular Cart Button (Center) */}
        <div className="relative flex flex-1 items-center justify-center">
          <Link
            href="/cart"
            aria-label={`Cart with ${itemCount} items`}
            className="group relative -top-3 flex size-12 sm:size-13 items-center justify-center rounded-full bg-tf-maroon hover:bg-tf-maroon-deep text-white shadow-lg ring-4 ring-white dark:ring-surface transition-transform active:scale-95 cursor-pointer"
          >
            <ShoppingCart className="size-5 stroke-[2.3] transition-transform group-hover:scale-110" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-xs border border-white">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            ) : null}
          </Link>
          <span className="absolute bottom-1.5 text-[10px] sm:text-[11px] font-medium leading-none text-[#7a7472] dark:text-muted">
            Cart
          </span>
        </div>

        {/* 4. Orders */}
        {(() => {
          const isOrders = pathname.startsWith("/orders");
          return (
            <Link
              href="/orders"
              aria-current={isOrders ? "page" : undefined}
              className={cn(
                "relative flex flex-1 min-h-14 flex-col items-center justify-center gap-1 py-1 transition-all select-none",
                isOrders
                  ? "text-tf-maroon dark:text-rose-400 font-bold"
                  : "text-[#7a7472] dark:text-muted hover:text-tf-maroon dark:hover:text-bone",
              )}
            >
              <ClipboardList
                className={cn(
                  "size-5 transition-transform",
                  isOrders && "scale-110 stroke-[2.4]",
                )}
              />
              <span className="text-[10px] sm:text-[11px] font-medium leading-none">
                Orders
              </span>
              {isOrders ? (
                <span
                  aria-hidden
                  className="absolute inset-x-4 bottom-0 h-0.75 rounded-t-full bg-tf-maroon dark:bg-rose-400"
                />
              ) : null}
              <TapHint />
            </Link>
          );
        })()}

        {/* 5. Account */}
        {(() => {
          const isAccount = pathname.startsWith("/account");
          return (
            <Link
              href="/account"
              aria-current={isAccount ? "page" : undefined}
              className={cn(
                "relative flex flex-1 min-h-14 flex-col items-center justify-center gap-1 py-1 transition-all select-none",
                isAccount
                  ? "text-tf-maroon dark:text-rose-400 font-bold"
                  : "text-[#7a7472] dark:text-muted hover:text-tf-maroon dark:hover:text-bone",
              )}
            >
              <User
                className={cn(
                  "size-5 transition-transform",
                  isAccount && "scale-110 stroke-[2.4]",
                )}
              />
              <span className="text-[10px] sm:text-[11px] font-medium leading-none">
                Account
              </span>
              {isAccount ? (
                <span
                  aria-hidden
                  className="absolute inset-x-4 bottom-0 h-0.75 rounded-t-full bg-tf-maroon dark:bg-rose-400"
                />
              ) : null}
              <TapHint />
            </Link>
          );
        })()}
      </div>
    </nav>
  );
}
