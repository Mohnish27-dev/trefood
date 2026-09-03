"use client";

import {
  Banknote,
  FileClock,
  LogOut,
  MapPinned,
  Radar,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { signOut } from "@/server/actions/session";
import { cn } from "@/lib/utils";

const SECTIONS: { heading: string; links: { href: string; label: string; icon: typeof Radar }[] }[] =
  [
    {
      heading: "Operations",
      links: [
        { href: "/admin/orders", label: "Live radar", icon: Radar },
        { href: "/admin/disputes", label: "Disputes", icon: ShieldAlert },
        { href: "/admin/students", label: "Students", icon: Users },
      ],
    },
    {
      heading: "Money",
      links: [
        { href: "/admin/settlements", label: "Settlements", icon: Banknote },
        { href: "/admin/pricing", label: "Pricing & timers", icon: SlidersHorizontal },
      ],
    },
    {
      heading: "Platform",
      links: [
        { href: "/admin/vendors", label: "Vendors & KYC", icon: Store },
        { href: "/admin/campuses", label: "Campuses & gates", icon: MapPinned },
        { href: "/admin/audit", label: "Audit log", icon: FileClock },
      ],
    },
  ];

/**
 * The admin console shell. Desktop-only, and it says so rather than pretending
 * a settlement table works on a phone.
 *
 * Functional over beautiful, but consistent with the rest of the system — the
 * same palette, the same components, the same money renderer. An admin tool
 * that looks like a different product is an admin tool people distrust.
 */
export function AdminShell({
  children,
  adminName,
}: {
  children: ReactNode;
  adminName: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-line bg-surface/40 lg:min-h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="relative size-8 shrink-0 overflow-hidden rounded-lg border border-saffron/30">
              <Image
                src="/icons/icon-192.png"
                alt="TREFOOD Logo"
                width={32}
                height={32}
                className="size-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold leading-none text-bone">TREFOOD</p>
              <p className="mt-1 text-[11px] leading-none text-faint">Admin console</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex gap-4 overflow-x-auto px-2 pb-3 lg:block lg:overflow-visible lg:px-2">
          {SECTIONS.map((section) => (
            <div key={section.heading} className="lg:mb-4">
              <p className="hidden px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-faint lg:block">
                {section.heading}
              </p>
              <ul className="flex gap-1 lg:block lg:space-y-0.5">
                {section.links.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm whitespace-nowrap transition-colors",
                          active
                            ? "bg-surface-raised font-medium text-bone"
                            : "text-muted hover:bg-surface hover:text-bone",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-line px-3 py-3 lg:block">
          <p className="truncate px-1 text-xs text-muted">{adminName}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-1.5 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-xs text-muted hover:text-bone"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 lg:px-8 lg:py-7">{children}</main>
      <Toaster />
    </div>
  );
}
