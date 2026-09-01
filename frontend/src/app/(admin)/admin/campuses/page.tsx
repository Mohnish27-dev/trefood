"use client";

import Link from "next/link";
import { formatClock, nitPatnaCampus } from "@trefood/shared";

import { MoneyDisplay } from "@/components/shared";
import { Button } from "@/components/ui/button";

/**
 * Campus list.
 *
 * Multi-tenancy is the point: a second campus is a database row here, never a code
 * change. Everything that differs between campuses — the delivery fee, the transit
 * time, the gates and their curfews — is config on this document.
 */
export default function CampusListPage() {
  const campuses = [nitPatnaCampus];

  return (
    <main className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Campuses</h1>
          <p className="text-muted-foreground text-sm">
            A new campus is a row, not a deploy.
          </p>
        </div>
        <Button>Add campus</Button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-start text-xs uppercase">
          <tr>
            <th className="py-2 text-start font-medium">Campus</th>
            <th className="py-2 text-start font-medium">Zones</th>
            <th className="py-2 text-start font-medium">Delivery fee</th>
            <th className="py-2 text-start font-medium">Commission</th>
            <th className="py-2 text-start font-medium">Transit</th>
            <th className="py-2 text-end font-medium">Earliest curfew</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {campuses.map((campus) => {
            const curfews = campus.zones
              .map((zone) => zone.curfewMinutes)
              .filter((value): value is number => value !== undefined);
            const earliest = curfews.length === 0 ? null : Math.min(...curfews);

            return (
              <tr key={campus._id}>
                <td className="py-3">
                  <Link href={`/admin/campuses/${campus._id}/zones`} className="font-medium underline">
                    {campus.name}
                  </Link>
                  <span className="text-muted-foreground block text-xs">
                    {campus.city} · {campus.timezone}
                  </span>
                </td>
                <td>{campus.zones.length}</td>
                <td>
                  <MoneyDisplay amountPaise={campus.settings.deliveryFeePaise} />
                </td>
                <td>{campus.settings.commissionPct}%</td>
                <td>{campus.settings.transitMinutes} min</td>
                <td className="text-end">{earliest === null ? "—" : formatClock(earliest)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
