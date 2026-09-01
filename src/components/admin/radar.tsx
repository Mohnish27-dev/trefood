"use client";

import { Loader2, Phone, PlayCircle, Radar as RadarIcon, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status";
import { ConnectionBanner, EmptyState } from "@/components/shared/states";
import { cancelOrderAsAdmin, runSweepsNow } from "@/server/actions/admin";
import { usePoll } from "@/hooks/use-poll";
import { clientEnv } from "@/lib/env";
import { STUCK_LABEL } from "@/lib/constants";
// Type-only: erased at compile time, so no server module reaches the browser.
import type { RadarSnapshot } from "@/server/services/admin";
import { cn } from "@/lib/utils";

/**
 * The live radar.
 *
 * Not a dashboard — a queue of things that need a person. Healthy orders are
 * listed for context, but the screen is sorted and coloured entirely around
 * the stuck ones: a vendor who has not accepted, a gate whose grace ran out, a
 * payment that never confirmed, a stockout nobody answered.
 *
 * "Run timers now" fires the same sweeps the cron calls. It exists because
 * waiting sixty seconds to see whether a stuck order resolves itself is a
 * miserable way to work a support queue — and because it makes the entire
 * failure suite demonstrable without a stopwatch.
 */
export function LiveRadar({ initial }: { initial: RadarSnapshot }) {
  const [sweeping, setSweeping] = useState(false);

  const { data, connectionLost, lastSyncedAt, refresh } = usePoll<RadarSnapshot>(
    async () => {
      const response = await fetch("/api/admin/orders/poll", { cache: "no-store" });
      if (!response.ok) throw new Error(`Radar poll failed: ${response.status}`);
      return (await response.json()) as RadarSnapshot;
    },
    { intervalMs: clientEnv.NEXT_PUBLIC_POLL_ADMIN_MS },
  );

  const snapshot = data ?? initial;

  const sweep = async (): Promise<void> => {
    setSweeping(true);
    const result = await runSweepsNow();
    setSweeping(false);

    if (result.status === "error") toast.error(result.message);
    else toast.success(result.message);
    refresh();
  };

  return (
    <>
      <ConnectionBanner visible={connectionLost} lastSyncedAt={lastSyncedAt} />

      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-bone">Live radar</h1>
          <p className="mt-1 text-sm text-muted">
            {snapshot.activeCount} order{snapshot.activeCount === 1 ? "" : "s"} in flight
            {snapshot.stuckCount > 0 ? (
              <>
                {" · "}
                <span className="font-semibold text-chili">
                  {snapshot.stuckCount} need attention
                </span>
              </>
            ) : (
              " · nothing overdue"
            )}
          </p>
        </div>

        <Button variant="secondary" disabled={sweeping} onClick={() => void sweep()}>
          {sweeping ? <Loader2 className="animate-spin" /> : <PlayCircle />}
          Run timers now
        </Button>
      </header>

      {snapshot.orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={RadarIcon}
            title="Nothing in flight"
            description="Every order has reached a terminal state. This screen fills up between 16:00 and 02:30."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Order</TH>
              <TH>Status</TH>
              <TH>Restaurant</TH>
              <TH>Student</TH>
              <TH>Gate</TH>
              <TH className="text-right">Value</TH>
              <TH className="text-right">Waiting</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {snapshot.orders.map((order) => {
              const isStuck = order.stuck.length > 0;
              return (
                <TR key={order.orderId} className={cn(isStuck && "bg-chili-wash/40")}>
                  <TD>
                    <p className="font-mono text-xs text-bone">{order.orderNumber}</p>
                    <p className="mt-0.5 text-[11px] text-faint">{order.campusName}</p>
                    {isStuck ? (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {order.stuck.map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex items-center gap-1 rounded-md border border-chili/40 bg-chili-wash px-1.5 py-0.5 text-[10px] font-medium text-chili"
                          >
                            <TriangleAlert className="size-2.5" />
                            {STUCK_LABEL[reason]}
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </TD>
                  <TD>
                    <StatusBadge status={order.status} />
                  </TD>
                  <TD className="max-w-40 truncate">{order.restaurantName}</TD>
                  <TD>
                    <p className="max-w-36 truncate">{order.customerName}</p>
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted hover:text-saffron"
                    >
                      <Phone className="size-2.5" />
                      {order.customerPhone}
                    </a>
                  </TD>
                  <TD className="max-w-36 truncate text-muted">{order.zoneName}</TD>
                  <TD className="text-right">
                    <Money paise={order.grandTotalPaise} />
                    <p className="mt-0.5 text-[11px] text-faint">
                      {order.method === "HYBRID_COD" ? "Cash" : "Prepaid"}
                    </p>
                  </TD>
                  <TD
                    className={cn(
                      "text-right tabular whitespace-nowrap",
                      isStuck ? "font-semibold text-chili" : "text-muted",
                    )}
                  >
                    {order.minutesInState} min
                  </TD>
                  <TD className="text-right">
                    <CancelDialog
                      orderId={order.orderId}
                      orderNumber={order.orderNumber}
                      onDone={refresh}
                    />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   The override
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Admin cancellation.
 *
 * The only way an order can be cancelled after the vendor accepted it — vendors
 * deliberately cannot, because a vendor-side cancel button becomes a way to
 * dodge orders they do not fancy. This one always refunds in full and always
 * demands a written reason, which the student reads.
 */
function CancelDialog({
  orderId,
  orderNumber,
  onDone,
}: {
  orderId: string;
  orderNumber: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    const result = await cancelOrderAsAdmin({ orderId, reason });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    setReason("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {orderNumber}?</DialogTitle>
          <DialogDescription>
            The student is refunded the full refundable amount immediately, and reads the
            reason you write here. The vendor is not charged the gateway fee for a
            platform-side cancellation.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Power cut at the canteen, campus emergency, duplicate order…"
            maxLength={200}
          />
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Leave it running
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 5 || submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Cancel and refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
