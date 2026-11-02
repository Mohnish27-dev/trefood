import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTOR, ORDER_STATUS } from "@/lib/constants";

const mocks = vi.hoisted(() => ({
  requireVendor: vi.fn(),
  getOrder: vi.fn(),
  transitionOrder: vi.fn(),
  notifyOrderEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ requireVendor: mocks.requireVendor }));
vi.mock("@/server/services/orders", () => ({
  getOrder: mocks.getOrder,
  transitionOrder: mocks.transitionOrder,
  isHiddenFromVendor: (order: { status: string }) => order.status === "PENDING_CONFIRMATION",
}));
vi.mock("@/server/services/push", () => ({ notifyOrderEvent: mocks.notifyOrderEvent }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { acceptOrder } from "@/server/actions/vendor";

const placed = { _id: "order_1", restaurantId: "rest_1", status: ORDER_STATUS.PLACED, prepMinutes: null, restaurantSnapshot: { name: "Kitchen" } };
const cooking = { ...placed, status: ORDER_STATUS.PREPARING, prepMinutes: 15 };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireVendor.mockResolvedValue({ restaurantId: "rest_1", user: { _id: "vendor_1" } });
  mocks.getOrder.mockResolvedValue(placed);
  mocks.transitionOrder.mockResolvedValue({ ok: true, order: cooking });
});

describe("vendor order acceptance recovery", () => {
  it.each([5, 15, 20, 30, 60])("accepts a valid %i minute time and moves the order to preparing", async (prepMinutes) => {
    mocks.transitionOrder.mockResolvedValue({ ok: true, order: { ...cooking, prepMinutes } });
    expect((await acceptOrder({ orderId: placed._id, prepMinutes })).status).toBe("ok");
    expect(mocks.transitionOrder).toHaveBeenNthCalledWith(1, expect.objectContaining({
      to: ORDER_STATUS.ACCEPTED, prepMinutes, actor: ACTOR.VENDOR, requireRestaurantId: "rest_1", actorId: "vendor_1",
    }));
    expect(mocks.transitionOrder).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: ORDER_STATUS.PREPARING, requireRestaurantId: "rest_1" }));
  });

  it.each([4, 61, 15.5, "15", NaN])("refuses invalid preparation time %s before writing", async (prepMinutes) => {
    expect((await acceptOrder({ orderId: placed._id, prepMinutes })).status).toBe("error");
    expect(mocks.transitionOrder).not.toHaveBeenCalled();
  });

  it("refuses an order owned by another restaurant", async () => {
    mocks.getOrder.mockResolvedValue({ ...placed, restaurantId: "rest_other" });
    expect((await acceptOrder({ orderId: placed._id, prepMinutes: 15 })).status).toBe("error");
    expect(mocks.transitionOrder).not.toHaveBeenCalled();
  });

  it("does not accept an order in the student's cancellation window", async () => {
    mocks.getOrder.mockResolvedValue({ ...placed, status: ORDER_STATUS.PENDING_CONFIRMATION });
    expect((await acceptOrder({ orderId: placed._id, prepMinutes: 15 })).status).toBe("error");
    expect(mocks.transitionOrder).not.toHaveBeenCalled();
  });

  it("resumes a partial acceptance without changing the committed preparation time", async () => {
    mocks.getOrder.mockResolvedValue({ ...placed, status: ORDER_STATUS.ACCEPTED, prepMinutes: 15 });
    const result = await acceptOrder({ orderId: placed._id, prepMinutes: 30 });
    expect(result).toEqual({ status: "ok", message: "Accepted — 15 min" });
    expect(mocks.transitionOrder).toHaveBeenCalledTimes(1);
    expect(mocks.transitionOrder).toHaveBeenCalledWith(expect.objectContaining({ to: ORDER_STATUS.PREPARING }));
    expect(mocks.transitionOrder.mock.calls[0]?.[0]).not.toHaveProperty("prepMinutes");
  });

  it("handles a lost success response without accepting or notifying twice", async () => {
    mocks.getOrder.mockResolvedValue(cooking);
    expect((await acceptOrder({ orderId: placed._id, prepMinutes: 30 })).status).toBe("ok");
    expect(mocks.transitionOrder).not.toHaveBeenCalled();
    expect(mocks.notifyOrderEvent).not.toHaveBeenCalled();
  });

  it("does not fail a committed acceptance when notifications fail", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mocks.notifyOrderEvent.mockRejectedValue(new Error("Subscription lookup failed"));
      expect((await acceptOrder({ orderId: placed._id, prepMinutes: 15 })).status).toBe("ok");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/vendor/orders");
    } finally {
      log.mockRestore();
    }
  });

  it("keeps an expired or raced order as an error", async () => {
    mocks.transitionOrder.mockResolvedValue({ ok: false, message: "Order already expired" });
    expect(await acceptOrder({ orderId: placed._id, prepMinutes: 15 })).toEqual({ status: "error", message: "Order already expired" });
    expect(mocks.transitionOrder).toHaveBeenCalledTimes(1);
  });
});
