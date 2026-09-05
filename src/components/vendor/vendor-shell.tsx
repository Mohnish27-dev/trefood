"use client";

import { BanknoteArrowUp, ClipboardList, LogOut, Settings, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { signOut } from "@/server/actions/session";
import { setRestaurantOpen } from "@/server/actions/vendor";
import { cn } from "@/lib/utils";

import { VendorLanguageProvider, useVendorLanguage } from "@/context/vendor-language-context";
import { VendorLanguageToggle } from "./vendor-language-toggle";

/**
 * The console chrome.
 *
 * The open/closed switch lives in the header rather than buried in settings on
 * purpose: it is the release valve for an exam-week surge, and the runbook is
 * explicit that a vendor who cannot find it in one tap will instead let four
 * orders expire. Everything else here is navigation.
 */
export function VendorShell(props: {
  children: ReactNode;
  restaurantName: string;
  staffName: string;
  isOpen: boolean;
  autoClosed: boolean;
}) {
  return (
    <VendorLanguageProvider>
      <VendorShellContent {...props} />
    </VendorLanguageProvider>
  );
}

function VendorShellContent({
  children,
  restaurantName,
  staffName,
  isOpen,
  autoClosed,
}: {
  children: ReactNode;
  restaurantName: string;
  staffName: string;
  isOpen: boolean;
  /** True when F4's three-expiry rule shut this restaurant automatically. */
  autoClosed: boolean;
}) {
  const pathname = usePathname();
  const { t } = useVendorLanguage();
  const [open, setOpen] = useState(isOpen);
  const [saving, setSaving] = useState(false);

  const tabs = [
    { href: "/vendor/orders", label: t("navOrders"), icon: ClipboardList },
    { href: "/vendor/menu", label: t("navMenu"), icon: UtensilsCrossed },
    { href: "/vendor/earnings", label: t("navEarnings"), icon: BanknoteArrowUp },
    { href: "/vendor/settings", label: t("navSettings"), icon: Settings },
  ];

  // The KOT is a print surface. It gets the whole page, with no navigation to
  // waste 58mm of thermal paper on.
  const isPrintView = pathname.endsWith("/kot");
  if (isPrintView) return <>{children}</>;

  const toggle = async (next: boolean): Promise<void> => {
    setSaving(true);
    // Optimistic: the switch must feel instant on a tablet mid-surge. The
    // server result reconciles it a moment later either way.
    setOpen(next);

    const result = await setRestaurantOpen({ isOpen: next });
    if (result.status === "error") {
      setOpen(!next);
      toast.error(result.message);
    } else {
      toast.success(result.message ?? t("savedSuccessfully"));
    }
    setSaving(false);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-bone">
              {restaurantName}
            </p>
            <p className="text-xs text-faint">{staffName}</p>
          </div>

          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-surface-raised text-bone"
                      : "text-muted hover:bg-surface hover:text-bone",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5">
              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-semibold leading-none",
                    open ? "text-mint" : "text-chili",
                  )}
                >
                  {open ? t("takingOrders") : t("closed")}
                </p>
                {!open && autoClosed ? (
                  <p className="mt-1 text-[11px] leading-none text-amber">{t("autoClosed")}</p>
                ) : null}
              </div>
              <Switch
                checked={open}
                disabled={saving}
                onCheckedChange={(next) => void toggle(next)}
                aria-label={open ? t("stopTakingOrders") : t("startTakingOrders")}
              />
            </div>

            <VendorLanguageToggle />

            <ThemeToggle />

            <form action={signOut}>
              <button
                type="submit"
                className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-surface-raised hover:text-bone"
                aria-label={t("signOut")}
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>

        {/* F4 — the restaurant was shut by the system, not by the vendor. Say
            so plainly, because otherwise the first thing they notice is that
            orders stopped, and they blame the app. */}
        {!open && autoClosed ? (
          <div className="border-t border-amber/30 bg-amber-wash px-4 py-2">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-xs text-amber">
              <Badge tone="warning">{t("autoClosedBannerTitle")}</Badge>
              <span>{t("autoClosedBannerDesc")}</span>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
      <Toaster />
    </div>
  );
}
