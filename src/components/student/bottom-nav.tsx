"use client";

import { ClipboardList, Home, Search, ShoppingCart, User } from "lucide-react";
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

  const items = [
    { href: `/c/${activeCampus}`, label: "Home", icon: Home },
    { href: "/cart", label: "Cart", icon: ShoppingCart, badge: itemCount },
    { href: "/orders", label: "Orders", icon: ClipboardList },
    { href: "/account", label: "Account", icon: User },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8ded9] dark:border-line bg-white/95 dark:bg-surface/95 backdrop-blur-xl shadow-[0_-4px_24px_rgba(131,0,32,0.04)] pb-safe"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active =
            href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 py-1.5 transition-all select-none",
                  active
                    ? "text-tf-maroon dark:text-rose-400 font-bold"
                    : "text-[#7a7472] dark:text-muted hover:text-tf-maroon dark:hover:text-bone",
                )}
              >
                <span className="relative">
                  <Icon
                    className={cn(
                      "size-5 transition-transform",
                      active && "scale-110 stroke-[2.4]",
                    )}
                  />
                  {badge !== undefined && badge > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-tf-maroon text-white px-1 text-[10px] font-bold tabular shadow-xs">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-medium leading-none tracking-tight">
                  {label}
                </span>

                {/* Active Indicator Bar (Underline from reference) */}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-6 bottom-0 h-1 rounded-t-full bg-tf-maroon dark:bg-rose-400 transition-all"
                  />
                ) : null}

                <TapHint />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
