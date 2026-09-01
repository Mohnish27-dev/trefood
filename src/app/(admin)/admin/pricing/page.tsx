import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { PricingForm } from "@/components/admin/pricing-form";
import { EmptyState } from "@/components/shared/states";
import { requireAdmin } from "@/server/auth/session";
import { listAllCampuses } from "@/server/services/admin";
import { MapPinned } from "lucide-react";

export const metadata: Metadata = { title: "Pricing & timers" };
export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  await requireAdmin();
  const campuses = await listAllCampuses();

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-xl font-semibold text-bone">Pricing & timers</h1>
        <p className="mt-1 text-sm text-muted">
          Every value here is snapshotted onto an order when it is created, so a change affects
          tomorrow&apos;s orders and never rewrites yesterday&apos;s.
        </p>
      </header>

      {campuses.length === 0 ? (
        <Card>
          <EmptyState
            icon={MapPinned}
            title="No campuses"
            description="Run the seed to create NIT Patna, then its rates and timers are editable here."
          />
        </Card>
      ) : (
        <div className="space-y-10">
          {campuses.map((campus) => (
            <section key={campus._id}>
              <h2 className="mb-3 font-display text-lg font-semibold text-bone">
                {campus.name}
                <span className="ml-2 text-sm font-normal text-faint">{campus.timezone}</span>
              </h2>

              <PricingForm
                campusId={campus._id}
                campusName={campus.name}
                initial={{
                  deliveryFeePaise: campus.settings.deliveryFeePaise,
                  commissionBps: campus.settings.commissionBps,
                  gatewayFeeBps: campus.settings.gatewayFeeBps,
                  codHandlingFeePaise: campus.settings.codHandlingFeePaise,
                  transitMinutes: campus.settings.transitMinutes,
                  vendorAckSeconds: campus.settings.vendorAckSeconds,
                  vendorAutoExpireSeconds: campus.settings.vendorAutoExpireSeconds,
                  gateGraceSeconds: campus.settings.gateGraceSeconds,
                  curfewBufferMinutes: campus.settings.curfewBufferMinutes,
                  stockoutResolutionSeconds: campus.settings.stockoutResolutionSeconds,
                  disputeWindowMinutes: campus.settings.disputeWindowMinutes,
                  codEnabled: campus.settings.codEnabled,
                }}
              />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
