"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/vendor/orders", label: "Orders" },
  { href: "/vendor/menu", label: "Menu" },
  { href: "/vendor/earnings", label: "Earnings" },
  { href: "/vendor/settings", label: "Settings" },
];

export function VendorNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Vendor">
      <ul className="flex gap-1">
        {LINKS.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "touch-target flex items-center rounded-md px-3 text-sm transition-colors",
                  isActive ? "bg-brand text-brand-foreground font-medium" : "hover:bg-accent",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
