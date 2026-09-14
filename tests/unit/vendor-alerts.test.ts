import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORDER_STATUS } from "@/lib/constants";
import type { Order } from "@/types/order";

/**
 * The new-order alert driver.
 *
 * This is the piece that makes "a vendor never misses an order" true when
 * nobody's app is open: it releases the held order itself rather than waiting
 * for someone to poll, and it keeps buzzing while the order goes unanswered.
 * Mocked at the service boundary so the timing rules are testable without a
 * database and without waiting four real minutes.
 */

const getOrder = vi.fn<(id: string) => Promise<Order | null>>();
const releasePendingOrders = vi.fn<() => Promise<void>>();
const notifyVendorNewOrder = vi.fn<
  (params: { order: Order; secondsToAccept: number; reminder?: number }) => Promise<void>
>();
const getCampusById = vi.fn();

vi.mock("@/server/services/orders", () => ({
  getOrder: (id: string) => getOrder(id),
  releasePendingOrders: () => releasePendingOrders(),
}));
vi.mock("@/server/services/push", () => ({
  notifyVendorNewOrder: (params: Parameters<typeof notifyVendorNewOrder>[0]) =>
    notifyVendorNewOrder(params),
}));
vi.mock("@/server/services/catalog", () => ({
  getCampusById: (id: string) => getCampusById(id),
}));

const { driveNewOrderAlerts } = await import("@/server/services/vendor-alerts");

const PLACED_AT = new Date("2026-09-14T18:00:00.000Z");

function order(overrides: Partial<Order> = {}): Order {
  return {
    _id: "order-1",
    campusId: "campus-1",
    status: ORDER_STATUS.PENDING_CONFIRMATION,
    cancelUntil: new Date(PLACED_AT.getTime() - 15_000),
    timestamps: { placedAt: null },
    ...overrides,
  } as unknown as Order;
}

/** Runs the driver with time collapsed: every sleep resolves immediately. */
function run(): Promise<void> {
  return driveNewOrderAlerts("order-1", () => Promise.resolve());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(PLACED_AT);
  getCampusById.mockResolvedValue({ settings: { vendorAutoExpireSeconds: 240 } });
  releasePendingOrders.mockResolvedValue(undefined);
  notifyVendorNewOrder.mockResolvedValue(undefined);
});

describe("driveNewOrderAlerts", () => {
  it("releases the held order itself, so a closed app cannot strand it", async () => {
    getOrder.mockResolvedValueOnce(order()).mockResolvedValue(
      order({ status: ORDER_STATUS.ACCEPTED }),
    );

    await run();

    expect(releasePendingOrders).toHaveBeenCalledTimes(1);
  });

  it("buzzes once a minute while the order sits unanswered, and stops before it expires", async () => {
    const placed = order({
      status: ORDER_STATUS.PLACED,
      timestamps: { placedAt: PLACED_AT } as Order["timestamps"],
    });
    getOrder.mockResolvedValueOnce(order()).mockResolvedValue(placed);

    await run();

    // 4-minute window: reminders at 1, 2 and 3 minutes. A fourth would land on
    // an order that has already auto-cancelled.
    expect(notifyVendorNewOrder).toHaveBeenCalledTimes(3);
    expect(notifyVendorNewOrder.mock.calls.map(([params]) => params.reminder)).toEqual([1, 2, 3]);
  });

  it("goes quiet the moment the vendor accepts", async () => {
    const placed = order({
      status: ORDER_STATUS.PLACED,
      timestamps: { placedAt: PLACED_AT } as Order["timestamps"],
    });
    getOrder
      .mockResolvedValueOnce(order())
      // First reminder round: still waiting, then accepted before it fires.
      .mockResolvedValueOnce(placed)
      .mockResolvedValue(order({ status: ORDER_STATUS.ACCEPTED }));

    await run();

    expect(notifyVendorNewOrder).not.toHaveBeenCalled();
  });

  it("does nothing for an order the student cancelled inside the hold", async () => {
    getOrder.mockResolvedValue(order({ status: ORDER_STATUS.CANCELLED_BY_STUDENT }));

    await run();

    expect(releasePendingOrders).not.toHaveBeenCalled();
    expect(notifyVendorNewOrder).not.toHaveBeenCalled();
  });

  it("never lets an alert failure escape into the checkout request", async () => {
    getOrder.mockRejectedValue(new Error("mongo is down"));

    await expect(run()).resolves.toBeUndefined();
  });
});
