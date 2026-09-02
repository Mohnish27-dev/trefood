"use client";

import { ClipboardList, Home, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

/**
 * Bottom navigation.
 *
 * Thumb-reachable on a 360px phone held one-handed, which is how this app is
 * actually used — walking to a gate, at night, carrying something else.
 * `pb-safe` keeps it clear of the home indicator once installed as a PWA.
 */
export function BottomNav({ campusSlug }: { campusSlug: string | null }) {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const activeCampus = campusSlug ?? "nit-patna";

  const items = [
    { href: `/c/${activeCampus}`, label: "Browse", icon: Home },
    { href: "/cart", label: "Cart", icon: ShoppingCart, badge: itemCount },
    { href: "/orders", label: "Orders", icon: ClipboardList },
    { href: "/account", label: "Account", icon: User },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur-lg pb-safe"
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
                  // 44px floor, same as Button.
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 transition-colors",
                  active ? "text-saffron" : "text-faint hover:text-muted",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {badge !== undefined && badge > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-bold tabular text-ink">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
