import { Monitor } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";

/**
 * The admin console shell — desktop only, and honest about it.
 *
 * Not laziness: an admin draws campus geofences with a mouse, reads a settlement
 * table thirty rows wide, and compares dispute photos against an order timeline.
 * A cramped phone version of those screens would be worse than a clear refusal,
 * because it would invite someone to rule on a refund from a bus.
 *
 * The block is CSS-only (`lg:` breakpoints), so there is no viewport sniffing to get
 * wrong and rotating a tablet to landscape simply works.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center lg:hidden">
        <Monitor className="text-muted-foreground size-10" aria-hidden />
        <h1 className="text-lg font-semibold">Open this on a desktop</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          The admin console needs a wide screen — geofence drawing, settlement tables
          and dispute evidence do not fit on a phone, and ruling on a refund from one
          is a bad idea anyway.
        </p>
      </div>

      <div className="hidden min-h-full lg:flex">
        <AdminNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
