import type { Metadata } from "next";

import { DisputeQueue, type DisputeRow } from "@/components/admin/dispute-queue";
import { requireAdmin } from "@/server/auth/session";
import { getDisputeWithContext, listDisputes } from "@/server/services/disputes";

export const metadata: Metadata = { title: "Disputes" };
export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  await requireAdmin();

  const disputes = await listDisputes({ limit: 50 });

  // Each card carries its own order timeline, because "the student says it
  // never arrived" is answered by the timeline and nothing else: it shows
  // whether the vendor tapped 'rider at gate', when, and whether a matching
  // code was ever confirmed.
  const rows: DisputeRow[] = [];
  for (const dispute of disputes) {
    const context = await getDisputeWithContext(dispute._id);
    if (!context) continue;

    rows.push({
      disputeId: dispute._id,
      orderNumber: dispute.orderNumber,
      reason: dispute.reason,
      note: dispute.note,
      photoUrls: dispute.photoUrls,
      status: dispute.status,
      createdAt: dispute.createdAt.toISOString(),
      ruling: dispute.ruling,
      refundAmountPaise: dispute.refundAmountPaise,
      vendorDebitPaise: dispute.vendorDebitPaise,

      restaurantName: context.order?.restaurantSnapshot.name ?? "Unknown restaurant",
      customerName: context.order?.customerSnapshot.name ?? "Unknown student",
      customerPhone: context.order?.customerSnapshot.phone ?? "",
      refundablePaise: context.order?.pricing.refundableAmountPaise ?? 0,
      // Admin sees the code unconditionally — a dispute ruling needs the full
      // record, and by this point the order is long delivered.
      gateCode: context.order?.gateCode ?? null,
      timeline: context.timeline.map((entry) => ({
        at: entry.at.toISOString(),
        from: entry.from,
        to: entry.to,
        actorRole: entry.actorRole,
        reason: entry.reason,
      })),
    });
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-xl font-semibold text-bone">Disputes</h1>
        <p className="mt-1 text-sm text-muted">
          Photo evidence is mandatory on every one of these, and every ruling is written to
          the audit log under your name.
        </p>
      </header>

      <DisputeQueue disputes={rows} />
    </>
  );
}
