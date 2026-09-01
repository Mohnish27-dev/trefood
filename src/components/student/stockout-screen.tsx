"use client";

import { AlertTriangle, ArrowRight, Loader2, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountdownText } from "@/components/shared/countdown";
import { Money } from "@/components/shared/money";
import { VegMark } from "@/components/shared/veg-mark";
import { listSubstitutes, resolveStockoutChoice } from "@/server/actions/student-extra";
import { cn } from "@/lib/utils";

interface Substitute {
  itemId: string;
  name: string;
  isVeg: boolean;
  pricePaise: number;
}

/**
 * F6 — the blocking three-choice screen.
 *
 * This is the only screen in the student app that deliberately blocks
 * everything else. The kitchen is mid-cook and physically cannot proceed until
 * someone decides, so a toast or a banner would be the wrong shape: it has to
 * be answered.
 *
 * The five-minute timer is visible and its consequence is stated plainly,
 * because "we removed it and refunded you" arriving as a surprise is worse
 * than the stockout itself. If it runs out we choose "remove it" — the only
 * option that cannot make things worse, since the student still eats and the
 * money for what did not arrive comes back regardless.
 *
 * A dearer substitute is never charged for. Collecting an extra twenty rupees
 * mid-order needs a second gateway flow that would fail more often than it
 * works, so the vendor absorbs the difference and the copy says so.
 */
export function StockoutScreen({
  orderId,
  itemName,
  expiresAt,
  onResolved,
}: {
  orderId: string;
  itemName: string;
  expiresAt: string;
  onResolved: () => void;
}) {
  const [substitutes, setSubstitutes] = useState<Substitute[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const options = await listSubstitutes(orderId);
      if (!cancelled) setSubstitutes(options);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const decide = async (
    choice: "SUBSTITUTE" | "REMOVE" | "CANCEL",
    substituteItemId?: string,
  ): Promise<void> => {
    setSubmitting(choice);
    setError(null);

    const result = await resolveStockoutChoice({
      orderId,
      choice,
      substituteItemId: substituteItemId ?? null,
    });

    if (result.status === "error") {
      setError(result.message);
      setSubmitting(null);
      return;
    }

    onResolved();
  };

  return (
    <div className="p-4">
      <Card className="border-amber/40 bg-amber-wash/40 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber/30 bg-amber-wash">
            <AlertTriangle className="size-5 text-amber" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold text-bone">
              {itemName} has run out
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The kitchen found out mid-cook. The rest of your order is fine — tell us what to
              do about this one item.
            </p>
          </div>
        </div>

        <p className="mt-4 flex items-baseline gap-2 rounded-xl border border-amber/25 bg-ink/40 px-3.5 py-2.5 text-sm text-amber">
          <CountdownText
            deadline={new Date(expiresAt)}
            className="text-lg font-semibold"
            expiredLabel="0:00"
          />
          <span className="text-xs leading-relaxed">
            left. If you do not choose, we drop the item, refund it, and deliver the rest.
          </span>
        </p>
      </Card>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-chili/30 bg-chili-wash px-3.5 py-3 text-sm text-chili">
          {error}
        </p>
      ) : null}

      {/* ── 1. Swap it ───────────────────────────────────────────── */}
      <section className="mt-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          Swap it for something else
        </h2>

        {substitutes === null ? (
          <Card className="flex items-center gap-3 p-4">
            <Loader2 className="size-4 animate-spin text-faint" />
            <p className="text-sm text-muted">Finding what is still available…</p>
          </Card>
        ) : substitutes.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-muted">
              Nothing else is available from this kitchen right now.
            </p>
          </Card>
        ) : (
          <>
            <Card className="max-h-64 divide-y divide-line overflow-y-auto">
              {substitutes.map((option) => (
                <button
                  key={option.itemId}
                  type="button"
                  onClick={() => setChosen(option.itemId)}
                  className={cn(
                    "flex w-full min-h-14 items-center gap-3 px-3.5 text-left transition-colors",
                    chosen === option.itemId ? "bg-saffron-wash" : "hover:bg-surface-raised",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      chosen === option.itemId ? "border-saffron bg-saffron" : "border-line",
                    )}
                  >
                    {chosen === option.itemId ? (
                      <span className="size-2 rounded-full bg-ink" />
                    ) : null}
                  </span>
                  <VegMark isVeg={option.isVeg} />
                  <span className="min-w-0 flex-1 truncate text-sm text-bone">{option.name}</span>
                  <Money paise={option.pricePaise} className="shrink-0 text-sm text-muted" />
                </button>
              ))}
            </Card>

            <Button
              block
              size="lg"
              className="mt-2"
              disabled={chosen === null || submitting !== null}
              onClick={() => void decide("SUBSTITUTE", chosen ?? undefined)}
            >
              {submitting === "SUBSTITUTE" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowRight />
              )}
              Swap it
            </Button>

            <p className="mt-1.5 text-center text-xs leading-relaxed text-faint">
              Cheaper? We refund the difference. Dearer? The restaurant covers it — you are
              never charged twice.
            </p>
          </>
        )}
      </section>

      {/* ── 2. Drop it ───────────────────────────────────────────── */}
      <section className="mt-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          Or just leave it out
        </h2>
        <Button
          block
          size="lg"
          variant="secondary"
          disabled={submitting !== null}
          onClick={() => void decide("REMOVE")}
        >
          {submitting === "REMOVE" ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Drop it and deliver the rest
        </Button>
        <p className="mt-1.5 text-center text-xs text-faint">
          That line is refunded, or taken off your cash total.
        </p>
      </section>

      {/* ── 3. Cancel ────────────────────────────────────────────── */}
      <section className="mt-5">
        <Button
          block
          size="lg"
          variant="ghost"
          disabled={submitting !== null}
          onClick={() => void decide("CANCEL")}
        >
          {submitting === "CANCEL" ? <Loader2 className="animate-spin" /> : <XCircle />}
          Cancel the whole order
        </Button>
        <p className="mt-1.5 text-center text-xs leading-relaxed text-faint">
          Full refund, minus the non-refundable payment-gateway fee that was never ours.
        </p>
      </section>
    </div>
  );
}
