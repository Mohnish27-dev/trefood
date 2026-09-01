import { AlertTriangle, ArrowLeft, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DisputeForm } from "@/components/student/dispute-form";
import { EmptyState } from "@/components/shared/states";
import { getSession } from "@/server/auth/session";
import { disputeWindowOpen, getOrderForCustomer } from "@/server/services/orders";
import { DISPUTE_REASONS } from "@/server/services/disputes";
import { DEFAULTS } from "@/lib/constants";

export const metadata: Metadata = { title: "Report a problem" };
export const dynamic = "force-dynamic";

/**
 * The 30-minute reporting window.
 *
 * Long enough to walk back to a room and open the bag, short enough that the
 * food is still evidence. Once it closes the student is not refused rudely —
 * they get the restaurant's phone number, which is genuinely the faster fix
 * for a missing raita.
 */
export default async function DisputePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const session = await getSession();
  if (!session) redirect(`/signin?next=/orders/${orderId}/dispute`);

  const order = await getOrderForCustomer(orderId, session.user._id);
  if (!order) notFound();

  const open = disputeWindowOpen(order);

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-line bg-ink/95 px-2 backdrop-blur-lg pt-safe">
        <Link
          href={`/orders/${orderId}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-raised hover:text-bone"
          aria-label="Back to the order"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-base font-semibold text-bone">Report a problem</h1>
      </header>

      {open ? (
        <DisputeForm
          orderId={order._id}
          orderNumber={order.orderNumber}
          reasons={DISPUTE_REASONS.map((reason) => ({
            value: reason.value,
            label: reason.label,
          }))}
        />
      ) : (
        <div className="p-4">
          <Card>
            <EmptyState
              icon={AlertTriangle}
              title="That window has closed"
              description={`Problems can be reported for ${DEFAULTS.disputeWindowMinutes} minutes after delivery, while the food is still there to photograph. ${order.restaurantSnapshot.name} can usually sort it out faster than we can anyway.`}
              action={
                <Button asChild variant="secondary">
                  <a href={`tel:${order.restaurantSnapshot.phone}`}>
                    <Phone />
                    Call {order.restaurantSnapshot.name}
                  </a>
                </Button>
              }
            />
          </Card>
        </div>
      )}
    </>
  );
}
