import { BellRing, Smartphone } from "lucide-react";
import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { SubPageHeader } from "@/components/student/account/sub-page-header";
import { PushPermissionCard } from "@/components/student/push-permission-card";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

/**
 * Notifications.
 *
 * F17 — the notification that never arrived. The honest framing is repeated
 * here rather than softened: push is a convenience and never the only channel.
 * The order screen polls regardless and the gate code is on it whether a
 * notification fired or not, so a student who lands here after missing one
 * leaves knowing where the real information lives.
 */
export default function NotificationsPage() {
  return (
    <>
      <SubPageHeader title="Notifications" />

      <div className="space-y-4 p-4">
        <PushPermissionCard />

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber/25 bg-amber-wash">
              <BellRing className="size-4 text-amber" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-bone">
                What you get buzzed about
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
                <li>The restaurant accepted your order, and how long it will take.</li>
                <li>An item ran out mid-cook and needs a decision from you.</li>
                <li>Your food has reached the gate — this is the one that matters.</li>
                <li>The 15-minute gate window is about to close.</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-raised">
              <Smartphone className="size-4 text-muted" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-bone">
                If a notification never arrives
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Nothing is lost. The order screen refreshes itself every few seconds and
                shows the same status, the same countdown and the same gate code. Open the
                order and you will see exactly where it is.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                On an iPhone, web notifications only work once TREFOOD is added to the home
                screen. Share → Add to Home Screen, then come back and turn them on.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
