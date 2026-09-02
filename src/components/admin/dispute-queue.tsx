"use client";

import { Gavel, Loader2, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
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
import { EmptyState } from "@/components/shared/states";
import { Money } from "@/components/shared/money";
import { ruleOnDispute } from "@/server/actions/admin";
import { formatINR, rupeesToPaise } from "@/lib/money";

export interface DisputeRow {
  disputeId: string;
  orderNumber: string;
  reason: string;
  note: string;
  photoUrls: string[];
  status: "OPEN" | "UPHELD" | "REJECTED";
  createdAt: string;
  ruling: string | null;
  refundAmountPaise: number | null;
  vendorDebitPaise: number | null;

  restaurantName: string;
  customerName: string;
  customerPhone: string;
  refundablePaise: number;
  gateCode: string | null;
  timeline: { at: string; from: string | null; to: string; actorRole: string; reason: string | null }[];
}

/**
 * The dispute queue.
 *
 * Everything an admin needs to rule fairly is on one card: the photo, the
 * student's words, and the full order timeline with the gate code. That
 * timeline is the answer to "the student says it never arrived" — it shows
 * whether the vendor tapped "rider at gate", when, and whether the student
 * confirmed with a matching code.
 *
 * A ruling always costs someone something. Upholding refunds the student and
 * debits the vendor by the same amount by default, because a refund the
 * platform silently absorbs teaches a kitchen nothing.
 */
export function DisputeQueue({ disputes }: { disputes: DisputeRow[] }) {
  const open = disputes.filter((dispute) => dispute.status === "OPEN");
  const closed = disputes.filter((dispute) => dispute.status !== "OPEN");

  if (disputes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="No disputes"
          description="Students have 30 minutes after delivery to report a problem, with a photo. An empty queue is the normal state."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {open.length > 0 ? (
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 font-display text-sm font-semibold text-bone">
            Waiting on a ruling
            <Badge tone="warning">{open.length}</Badge>
          </h2>
          <div className="space-y-3">
            {open.map((dispute) => (
              <DisputeCard key={dispute.disputeId} dispute={dispute} />
            ))}
          </div>
        </section>
      ) : null}

      {closed.length > 0 ? (
        <section>
          <h2 className="mb-2.5 font-display text-sm font-semibold text-bone">Closed</h2>
          <div className="space-y-3">
            {closed.map((dispute) => (
              <DisputeCard key={dispute.disputeId} dispute={dispute} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DisputeCard({ dispute }: { dispute: DisputeRow }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-wider text-faint">{dispute.orderNumber}</p>
          <p className="mt-0.5 font-display text-sm font-semibold text-bone">
            {readableReason(dispute.reason)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {dispute.restaurantName} → {dispute.customerName} ·{" "}
            {new Date(dispute.createdAt).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {dispute.status === "OPEN" ? (
          <Badge tone="warning">Open</Badge>
        ) : dispute.status === "UPHELD" ? (
          <Badge tone="success">Upheld</Badge>
        ) : (
          <Badge tone="neutral">Rejected</Badge>
        )}
      </div>

      {dispute.note ? (
        <p className="mt-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm leading-relaxed text-bone">
          “{dispute.note}”
        </p>
      ) : null}

      {/* Photo evidence is mandatory, so there is always at least one. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {dispute.photoUrls.map((url, index) => (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl border border-line"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- evidence may be a
                data URL from the stub storage provider, which next/image cannot take. */}
            <img
              src={url}
              alt={`Evidence ${index + 1} for ${dispute.orderNumber}`}
              className="size-28 object-cover"
            />
          </a>
        ))}
      </div>

      <details className="mt-3 rounded-xl border border-line">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-muted hover:text-bone">
          Order timeline ({dispute.timeline.length} events)
          {dispute.gateCode ? ` · gate code ${dispute.gateCode}` : ""}
        </summary>
        <ol className="space-y-1.5 border-t border-line px-3 py-2.5">
          {dispute.timeline.map((event, index) => (
            <li key={index} className="flex gap-3 text-xs">
              <span className="w-28 shrink-0 tabular text-faint">
                {new Date(event.at).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="min-w-0">
                <span className="text-bone">
                  {event.from ? `${event.from} → ` : ""}
                  {event.to}
                </span>
                <span className="ml-2 text-faint">{event.actorRole}</span>
                {event.reason ? (
                  <span className="block text-muted">{event.reason}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </details>

      {dispute.status === "OPEN" ? (
        <div className="mt-4">
          <RulingDialog dispute={dispute} />
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-xs">
          <p className="text-bone">{dispute.ruling}</p>
          {dispute.refundAmountPaise !== null && dispute.refundAmountPaise > 0 ? (
            <p className="mt-1 text-muted">
              Refunded <Money paise={dispute.refundAmountPaise} exact /> · vendor debited{" "}
              <Money paise={dispute.vendorDebitPaise ?? 0} exact />
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function RulingDialog({ dispute }: { dispute: DisputeRow }) {
  const [open, setOpen] = useState(false);
  const [ruling, setRuling] = useState("");
  const [refundRupees, setRefundRupees] = useState(String(dispute.refundablePaise / 100));
  const [submitting, setSubmitting] = useState(false);

  const submit = async (uphold: boolean): Promise<void> => {
    setSubmitting(true);
    const refundPaise = toPaise(refundRupees);

    const result = await ruleOnDispute({
      disputeId: dispute.disputeId,
      uphold,
      ruling,
      ...(uphold ? { refundAmountPaise: refundPaise, vendorDebitPaise: refundPaise } : {}),
    });
    setSubmitting(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Gavel />
          Rule on this
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dispute.orderNumber}</DialogTitle>
          <DialogDescription>
            Both the student and the vendor see the sentence you write. Upholding refunds the
            student and debits the same amount from {dispute.restaurantName}&apos;s next payout.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div>
            <Label htmlFor={`refund-${dispute.disputeId}`}>Refund (rupees)</Label>
            <Input
              id={`refund-${dispute.disputeId}`}
              type="number"
              inputMode="decimal"
              min={0}
              max={dispute.refundablePaise / 100}
              value={refundRupees}
              onChange={(event) => setRefundRupees(event.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted">
              Maximum {formatINR(dispute.refundablePaise)} — the amount paid online, less the
              convenience fee, which the gateway never returns.
            </p>
          </div>

          <div>
            <Label htmlFor={`ruling-${dispute.disputeId}`}>Ruling</Label>
            <Textarea
              id={`ruling-${dispute.disputeId}`}
              value={ruling}
              onChange={(event) => setRuling(event.target.value)}
              placeholder="Photo shows the wrong curry. Refunded in full and debited to the vendor."
              maxLength={300}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="secondary"
            disabled={ruling.trim().length < 5 || submitting}
            onClick={() => void submit(false)}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
            Reject the claim
          </Button>
          <Button
            variant="success"
            disabled={ruling.trim().length < 5 || submitting}
            onClick={() => void submit(true)}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <ThumbsUp />}
            Uphold and refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Rupees typed by an admin, converted through the one money helper that
 * understands them. Anything it refuses (sub-paise precision, a stray letter)
 * falls back to zero, which the action then rejects with a readable message
 * rather than silently refunding a wrong amount.
 */
function toPaise(input: string): number {
  try {
    return rupeesToPaise(Number(input));
  } catch {
    return 0;
  }
}

function readableReason(reason: string): string {
  const map: Record<string, string> = {
    WRONG_ITEM: "Wrong item delivered",
    MISSING_ITEM: "Something was missing",
    SPILLED: "Spilled or damaged",
    COLD: "Cold or inedible",
    NOT_DELIVERED: "Never actually delivered",
    OTHER: "Other problem",
  };
  return map[reason] ?? reason;
}
