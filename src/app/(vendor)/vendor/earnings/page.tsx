import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EarningsView } from "@/components/vendor/earnings-view";
import { requireVendor } from "@/server/auth/session";
import { getCampusById, getRestaurantById } from "@/server/services/catalog";
import { getVendorEarnings } from "@/server/services/vendor";
import { bpsToPct } from "@/lib/money";

export const metadata: Metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

export default async function VendorEarningsPage() {
  const { restaurantId } = await requireVendor();

  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) notFound();

  const campus = await getCampusById(restaurant.campusId);
  if (!campus) notFound();

  const earnings = await getVendorEarnings({ restaurant, campus });
  const commissionBps = restaurant.commissionBpsOverride ?? campus.settings.commissionBps;

  return (
    <EarningsView
        days={earnings.days}
        today={earnings.today}
        commissionPct={String(bpsToPct(commissionBps))}
        pendingPayoutPaise={earnings.pendingPayoutPaise}
        ledgerTotalPaise={earnings.ledgerTotalPaise}
        ledger={earnings.ledger.map((entry) => ({
          id: entry._id,
          createdAt: entry.createdAt.toISOString(),
          type: entry.type,
          note: entry.note,
          amountPaise: entry.amountPaise,
        }))}
        settlements={earnings.settlements.map((row) => ({
          id: row._id,
          settlementDate: row.settlementDate,
          grossPrepaidPaise: row.grossPrepaidPaise,
          adjustmentsPaise: row.adjustmentsPaise,
          netPayablePaise: row.netPayablePaise,
          carriedForwardPaise: row.carriedForwardPaise,
          status: row.status,
          utrReference: row.utrReference,
        }))}
      />
  );
}
