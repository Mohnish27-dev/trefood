"use client";

import {
  ArrowRight,
  ChefHat,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  PackageCheck,
  PlayCircle,
  RotateCcw,
  Shuffle,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/input";
import { Toaster } from "@/components/ui/toast";
import { Money } from "@/components/shared/money";
import { StatusBadge } from "@/components/shared/status";
import { EmptyState } from "@/components/shared/states";
import {
  ageDemoOrder,
  createDemoOrder,
  driveDemoOrder,
  raiseDemoStockout,
  rerouteDemoOrder,
  resetDemoOrders,
  runDemoSweeps,
} from "@/server/actions/demo";
import { ORDER_STATUS, PAYMENT_METHOD, type OrderStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface DemoOption {
  id: string;
  label: string;
  hint?: string;
}

export interface DemoOrderRow {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  restaurantName: string;
  customerName: string;
  zoneName: string;
  method: string;
  grandTotalPaise: number;
  cashDueOnDeliveryPaise: number;
  gateCode: string | null;
  hasOpenStockout: boolean;
}

/**
 * The simulation panel.
 *
 * Its job is to make the whole loop demonstrable in ninety seconds from a cold
 * browser, in front of a restaurant owner who has no interest in waiting four
 * minutes for a timer to fire.
 *
 * Every button here drives the REAL state machine — the same guarded
 * transitions, the same audit entries, the same refunds. Nothing is faked, and
 * that is the point: a vendor watching this is watching the product, not a
 * slideshow. The one shortcut is authorisation, which is why the whole panel
 * is refused outside a stub-auth development environment.
 *
 * The "age the clock" control deserves its own note. Rather than pretending an
 * order expired, it moves the order's timestamps backwards and then runs the
 * real sweep, which finds it genuinely overdue and acts. The failure being
 * shown is the actual failure path, not a mock of it.
 */
export function DemoPanel({
  restaurants,
  zones,
  students,
  orders,
}: {
  restaurants: DemoOption[];
  zones: DemoOption[];
  students: DemoOption[];
  orders: DemoOrderRow[];
}) {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(students[0]?.id ?? "");
  const [method, setMethod] = useState<string>(PAYMENT_METHOD.ONLINE_100);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (
    key: string,
    fn: () => Promise<{ status: string; message: string }>,
  ): Promise<void> => {
    setBusy(key);
    const result = await fn();
    if (result.status === "error") toast.error(result.message);
    else toast.success(result.message);
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-bone">Simulation panel</h1>
          <Badge tone="warning">Development only</Badge>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          Every button drives the real state machine — the same guarded transitions, refunds and
          audit entries the consoles use. Open the student view in one tab and the vendor board
          in another, and watch a tap in one move the other.
        </p>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <PanelLink href="/c/nit-patna" label="Student app" />
          <PanelLink href="/vendor/orders" label="Vendor board" />
          <PanelLink href="/admin/orders" label="Admin radar" />
          <PanelLink href="/signin" label="Switch account" />
        </div>
      </header>

      {/* ── Create ───────────────────────────────────────────────── */}
      <Card className="mb-5 p-4">
        <h2 className="font-display text-sm font-semibold text-bone">Place an order</h2>
        <p className="mt-1 text-xs text-muted">
          Builds a cart from what the kitchen actually has, prices it server-side, and captures
          through the stub gateway.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="demo-restaurant">Restaurant</Label>
            <Select
              id="demo-restaurant"
              value={restaurantId}
              onChange={(event) => setRestaurantId(event.target.value)}
            >
              {restaurants.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="demo-zone">Gate</Label>
            <Select
              id="demo-zone"
              value={zoneId}
              onChange={(event) => setZoneId(event.target.value)}
            >
              {zones.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="demo-student">Student</Label>
            <Select
              id="demo-student"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              {students.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="demo-method">Payment</Label>
            <Select
              id="demo-method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              <option value={PAYMENT_METHOD.ONLINE_100}>Pay in full online</option>
              <option value={PAYMENT_METHOD.HYBRID_COD}>10% token, rest in cash</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={busy !== null}
            onClick={() =>
              void run("create", () =>
                createDemoOrder({ restaurantId, zoneId, customerId, method }),
              )
            }
          >
            {busy === "create" ? <Loader2 className="animate-spin" /> : <PlayCircle />}
            Place order
          </Button>

          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void run("sweep", runDemoSweeps)}
          >
            {busy === "sweep" ? <Loader2 className="animate-spin" /> : <Clock />}
            Run all timers
          </Button>

          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void run("reset", resetDemoOrders)}
          >
            {busy === "reset" ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Clear demo orders
          </Button>
        </div>
      </Card>

      {/* ── Drive ────────────────────────────────────────────────── */}
      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageCheck}
            title="No demo orders yet"
            description="Place one above. It appears on the vendor board immediately, with a three-minute countdown running."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <DemoOrderCard
              key={order.orderId}
              order={order}
              busy={busy}
              onRun={run}
            />
          ))}
        </div>
      )}

      <Toaster />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DemoOrderCard({
  order,
  busy,
  onRun,
}: {
  order: DemoOrderRow;
  busy: string | null;
  onRun: (key: string, fn: () => Promise<{ status: string; message: string }>) => Promise<void>;
}) {
  const isCod = order.method === PAYMENT_METHOD.HYBRID_COD;
  const steps = nextSteps(order.status);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-wider text-faint">{order.orderNumber}</p>
          <p className="mt-0.5 font-display text-sm font-semibold text-bone">
            {order.restaurantName} → {order.customerName}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3 text-faint" />
              {order.zoneName}
            </span>
            <span>{isCod ? "Cash at the gate" : "Prepaid"}</span>
            <Money paise={order.grandTotalPaise} />
            {isCod && order.cashDueOnDeliveryPaise > 0 ? (
              <span className="text-mint">
                <Money paise={order.cashDueOnDeliveryPaise} /> in cash
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {order.gateCode ? (
            <span className="rounded-lg border border-saffron/30 bg-saffron-wash px-2 py-1 font-mono text-sm font-bold tracking-[0.15em] text-saffron">
              {order.gateCode}
            </span>
          ) : null}
          <StatusBadge status={order.status} />
        </div>
      </div>

      {order.hasOpenStockout ? (
        <p className="mt-3 rounded-lg border border-amber/30 bg-amber-wash px-2.5 py-2 text-xs text-amber">
          Waiting on the student to choose what to do about the missing item. Open their order
          screen to see the blocking three-choice screen.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((step) => (
          <Button
            key={step.to}
            size="sm"
            variant={step.tone}
            disabled={busy !== null}
            onClick={() =>
              void onRun(`${order.orderId}-${step.to}`, () =>
                driveDemoOrder({
                  orderId: order.orderId,
                  to: step.to,
                  ...(step.to === ORDER_STATUS.ACCEPTED ? { prepMinutes: 20 } : {}),
                  ...(step.needsReason ? { reason: step.reason } : {}),
                }),
              )
            }
          >
            {busy === `${order.orderId}-${step.to}` ? (
              <Loader2 className="animate-spin" />
            ) : (
              <step.icon />
            )}
            {step.label}
          </Button>
        ))}

        {/* ── Edge cases ─────────────────────────────────────────── */}
        {(order.status === ORDER_STATUS.ACCEPTED || order.status === ORDER_STATUS.PREPARING) &&
        !order.hasOpenStockout ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() =>
              void onRun(`${order.orderId}-stockout`, () =>
                raiseDemoStockout({ orderId: order.orderId }),
              )
            }
          >
            {busy === `${order.orderId}-stockout` ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Shuffle />
            )}
            F6 · an item runs out
          </Button>
        ) : null}

        {order.status === ORDER_STATUS.OUT_FOR_DELIVERY ||
        order.status === ORDER_STATUS.AT_GATE ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() =>
              void onRun(`${order.orderId}-reroute`, () =>
                rerouteDemoOrder({ orderId: order.orderId }),
              )
            }
          >
            {busy === `${order.orderId}-reroute` ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RotateCcw />
            )}
            F11 · gate shuts mid-flight
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() =>
            void onRun(`${order.orderId}-age`, () =>
              ageDemoOrder({ orderId: order.orderId, minutes: 20 }),
            )
          }
        >
          {busy === `${order.orderId}-age` ? <Loader2 className="animate-spin" /> : <Clock />}
          Age it 20 min
        </Button>

        <Button asChild size="sm" variant="ghost">
          <Link href={`/orders/${order.orderId}`}>
            <ExternalLink />
            Student view
          </Link>
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

interface Step {
  to: OrderStatus;
  label: string;
  icon: typeof ArrowRight;
  tone: "primary" | "secondary" | "danger" | "success" | "ghost";
  needsReason?: boolean;
  reason?: string;
}

/**
 * The buttons available from each state, mirroring the FSM.
 *
 * Illegal pairings are still refused by `assertTransition` on the server —
 * this only decides what is worth rendering, so a mistake here produces a
 * disabled-looking button rather than a corrupt order.
 */
function nextSteps(status: OrderStatus): Step[] {
  switch (status) {
    case ORDER_STATUS.PLACED:
      return [
        { to: ORDER_STATUS.ACCEPTED, label: "Accept · 20 min", icon: ChefHat, tone: "primary" },
        {
          to: ORDER_STATUS.REJECTED_BY_VENDOR,
          label: "F5 · reject",
          icon: XCircle,
          tone: "danger",
          needsReason: true,
          reason: "Kitchen is closing early tonight",
        },
        {
          to: ORDER_STATUS.EXPIRED_NO_ACK,
          label: "F4 · never answered",
          icon: Clock,
          tone: "ghost",
        },
      ];
    case ORDER_STATUS.ACCEPTED:
      return [
        { to: ORDER_STATUS.PREPARING, label: "Start cooking", icon: ChefHat, tone: "primary" },
      ];
    case ORDER_STATUS.PREPARING:
      return [{ to: ORDER_STATUS.READY, label: "Mark packed", icon: PackageCheck, tone: "primary" }];
    case ORDER_STATUS.READY:
      return [
        { to: ORDER_STATUS.OUT_FOR_DELIVERY, label: "Rider leaves", icon: Truck, tone: "primary" },
      ];
    case ORDER_STATUS.OUT_FOR_DELIVERY:
      return [{ to: ORDER_STATUS.AT_GATE, label: "Rider at gate", icon: MapPin, tone: "primary" }];
    case ORDER_STATUS.AT_GATE:
      return [
        { to: ORDER_STATUS.DELIVERED, label: "Student confirms", icon: ArrowRight, tone: "success" },
        {
          to: ORDER_STATUS.DELIVERED_TO_SECURITY,
          label: "F7 · left with security",
          icon: PackageCheck,
          tone: "ghost",
        },
        { to: ORDER_STATUS.NO_SHOW, label: "F8 · no-show", icon: XCircle, tone: "ghost" },
      ];
    default:
      return [];
  }
}

function PanelLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      className={cn("inline-flex items-center gap-1.5 text-saffron hover:underline")}
    >
      {label}
      <ExternalLink className="size-3.5" />
    </Link>
  );
}
