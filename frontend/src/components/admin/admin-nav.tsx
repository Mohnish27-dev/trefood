"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  MapPin,
  Radar,
  Store,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/orders", label: "Live radar", icon: Radar },
  { href: "/admin/campuses", label: "Campuses", icon: MapPin },
  { href: "/admin/vendors", label: "Vendors", icon: Store },
  { href: "/admin/disputes", label: "Disputes", icon: ClipboardList },
  { href: "/admin/settlements", label: "Settlements", icon: Wallet },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/audit", label: "Audit log", icon: FileText },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="w-56 shrink-0 border-e p-3">
      <p className="px-3 pb-3 font-bold">
        TREFOOD <span className="text-muted-foreground font-normal">admin</span>
      </p>
      <ul className="space-y-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-brand text-brand-foreground font-medium" : "hover:bg-accent",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
