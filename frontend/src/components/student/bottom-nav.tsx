"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, ShoppingBag, User } from "lucide-react";

import { useCart } from "@/hooks/use-cart";
import { useDelivery } from "@/hooks/use-delivery-context";
import { cn } from "@/lib/utils";

/**
 * Bottom navigation.
 *
 * Bottom rather than top because this is a one-handed, thumb-reachable app used while
 * walking. Every target is 44×44 minimum.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { itemCount, isHydrated } = useCart();
  const { campusSlug } = useDelivery();

  const items = [
    { href: campusSlug === null ? "/" : `/c/${campusSlug}`, label: "Browse", icon: Home },
    { href: "/cart", label: "Cart", icon: ShoppingBag, badge: itemCount },
    { href: "/orders", label: "Orders", icon: ClipboardList },
    { href: "/account", label: "Account", icon: User },
  ];

  return (
    <nav
      className="bg-background sticky bottom-0 z-40 border-t"
      // Keeps the bar clear of the iOS home indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <ul className="flex">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0] ?? href);

          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "touch-target relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors",
                  isActive ? "text-brand font-medium" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {/* Rendered only after hydration: the count comes from localStorage,
                      and showing 0 on the server then 3 on the client would flash. */}
                  {isHydrated && badge !== undefined && badge > 0 ? (
                    <span className="bg-brand text-brand-foreground absolute -end-2 -top-1.5 flex size-4 items-center justify-center rounded-full text-[9px] font-bold">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
