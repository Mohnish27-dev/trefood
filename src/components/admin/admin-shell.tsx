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
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/shared/logo";
import { Toaster } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { signOut } from "@/server/actions/session";
import { cn } from "@/lib/utils";

const SECTIONS: {
  heading: string;
  links: { href: string; label: string; icon: typeof Radar; coAdmin?: boolean }[];
}[] = [
  {
    heading: "Operations",
    links: [
      { href: "/admin/orders", label: "Live radar", icon: Radar, coAdmin: true },
      { href: "/admin/issues", label: "Issue Desk", icon: ShieldAlert },
      { href: "/admin/students", label: "Students", icon: Users },
    ],
  },
  {
    heading: "Money",
    links: [
      { href: "/admin/earnings", label: "Earnings", icon: TrendingUp },
      { href: "/admin/settlements", label: "Settlements", icon: Banknote },
      { href: "/admin/pricing", label: "Pricing & timers", icon: SlidersHorizontal },
    ],
  },
  {
    heading: "Platform",
    links: [
      { href: "/admin/vendors", label: "Restaurants & Vendors", icon: Store, coAdmin: true },
      { href: "/admin/campuses", label: "Campuses & gates", icon: MapPinned, coAdmin: true },
      { href: "/admin/audit", label: "Audit log", icon: FileClock },
    ],
  },
];

export function AdminShell({
  children,
  adminName,
  isCoAdmin = false,
}: {
  children: ReactNode;
  adminName: string;
  isCoAdmin?: boolean;
}) {
  const pathname = usePathname();
  const sections = isCoAdmin
    ? SECTIONS.map((section) => ({
        ...section,
        links: section.links.filter((link) => link.coAdmin),
      })).filter((section) => section.links.length > 0)
    : SECTIONS;

  return (
    <div className="min-h-dvh lg:flex bg-ink">
      <aside className="border-b border-line bg-surface lg:min-h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r shadow-xs">
        <div className="flex items-center justify-between px-4 py-4 border-b border-line">
          <div className="flex flex-col">
            <BrandLogo size="sm" showText />
            <p className="mt-1 pl-9 text-[10px] font-bold uppercase tracking-wider text-tf-maroon dark:text-rose-400">
              {isCoAdmin ? "Co-admin Console" : "Admin Console"}
            </p>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex gap-4 overflow-x-auto px-2 py-4 lg:block lg:overflow-visible lg:px-3">
          {sections.map((section) => (
            <div key={section.heading} className="lg:mb-5">
              <p className="hidden px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-faint lg:block">
                {section.heading}
              </p>
              <ul className="flex gap-1 lg:block lg:space-y-1">
                {section.links.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm whitespace-nowrap transition-all",
                          active
                            ? "bg-tf-maroon/10 text-tf-maroon dark:bg-rose-950/30 dark:text-rose-400 font-bold border-l-3 border-tf-maroon"
                            : "text-muted hover:bg-surface-raised hover:text-bone font-medium",
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", active && "text-tf-maroon dark:text-rose-400")} />
                        <span>{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-line px-4 py-4 lg:block mt-auto">
          <p className="truncate text-xs font-semibold text-bone">{adminName}</p>
          <p className="text-[10px] text-faint">Platform Administrator</p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-2.5 inline-flex min-h-9 items-center gap-2 rounded-xl text-xs font-medium text-muted hover:text-tf-maroon transition-colors cursor-pointer"
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
