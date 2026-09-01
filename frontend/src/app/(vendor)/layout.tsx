import Link from "next/link";

import { VendorNav } from "@/components/vendor/vendor-nav";

/**
 * The vendor console shell.
 *
 * Tablet-first, not mobile-first: this runs on a device propped on a counter, mains-
 * powered, with the screen awake all day. That is also why the layout is a wide
 * horizontal board rather than a scrolling list.
 *
 * Role gating arrives in Phase 6. Middleware will keep students out of this route
 * group — but middleware is routing, and every backend route re-checks the role AND
 * that the order belongs to this restaurant.
 */
export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <Link href="/vendor/orders" className="font-bold">
          TREFOOD <span className="text-muted-foreground font-normal">vendor</span>
        </Link>
        <VendorNav />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
