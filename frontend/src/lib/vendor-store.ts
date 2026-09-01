import {
  buildOrderFixture,
  type IOrder,
  type OrderStatus,
} from "@trefood/shared";

/**
 * A mutable in-memory order board for Phase 3.
 *
 * The vendor console is a console for *doing* things — accept, mark ready, dispatch —
 * so a read-only fixture would demonstrate nothing. This store lets cards actually
 * move between columns, which is what the Phase 3 exit gate asks for.
 *
 * It is deliberately not a state library. The board polls, exactly as it will against
 * the real API, so the data flow being exercised now is the data flow that ships.
 *
 * DELETE THIS FILE IN PHASE 10, when `backend/src/services/order-state.ts` owns
 * transitions and the board polls `/vendor/orders/poll`.
 */

let counter = 0;

function seed(): IOrder[] {
  const board = [
    buildOrderFixture("PLACED"),
    buildOrderFixture("PREPARING"),
    buildOrderFixture("READY"),
    buildOrderFixture("OUT_FOR_DELIVERY", "HYBRID_COD"),
  ];
  // Distinct ids: buildOrderFixture keys on status, and the board can hold two
  // orders in the same state.
  return board.map((order) => ({ ...order, _id: `board-${(counter += 1)}` }));
}

let orders: IOrder[] = seed();

/** Simulates the 5-second poll. Returns a copy so callers cannot mutate the store. */
export function pollVendorOrders(): Promise<IOrder[]> {
  return new Promise((resolve) => setTimeout(() => resolve([...orders]), 80));
}

export function getVendorOrder(orderId: string): Promise<IOrder | null> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(orders.find((order) => order._id === orderId) ?? null), 40),
  );
}

/**
 * Moves an order to a new status.
 *
 * Phase 10 replaces this with a call to the guarded FSM, which validates legality,
 * checks the actor's right to fire the transition, and writes an audit entry —
 * atomically. Nothing here is authoritative; it exists so the board can be driven.
 */
export function applyTransition(
  orderId: string,
  to: OrderStatus,
  patch: Partial<IOrder> = {},
): Promise<void> {
  return new Promise((resolve) => {
    orders = orders.map((order) =>
      order._id === orderId
        ? {
            ...order,
            ...patch,
            status: to,
            timestamps: {
              ...order.timestamps,
              ...stampFor(to),
              ...(patch.timestamps ?? {}),
            },
          }
        : order,
    );
    setTimeout(resolve, 40);
  });
}

function stampFor(status: OrderStatus): Partial<IOrder["timestamps"]> {
  const now = new Date().toISOString();
  switch (status) {
    case "ACCEPTED":
    case "PREPARING":
      return { acceptedAt: now };
    case "READY":
      return { readyAt: now };
    case "OUT_FOR_DELIVERY":
      return { dispatchedAt: now };
    case "AT_GATE":
      return { atGateAt: now };
    case "DELIVERED":
    case "DELIVERED_TO_SECURITY":
      return { deliveredAt: now };
    default:
      return {};
  }
}

/** Marks an item unavailable across the whole board, as a real 86 would. */
export function eightySixItem(itemId: string): Promise<void> {
  return new Promise((resolve) => {
    // Phase 7 flips `menuItems.isAvailable`; here we only need the board to react.
    void itemId;
    setTimeout(resolve, 40);
  });
}

/**
 * Drops a brand-new PLACED order onto the board.
 *
 * The Phase 3 exit gate requires watching an order land and the alarm start. Without
 * a way to trigger that, the whole three-way defence is unverifiable.
 */
export function simulateIncomingOrder(): Promise<IOrder> {
  return new Promise((resolve) => {
    const order: IOrder = {
      ...buildOrderFixture("PLACED"),
      _id: `board-${(counter += 1)}`,
      timestamps: {
        ...buildOrderFixture("PLACED").timestamps,
        createdAt: new Date().toISOString(),
        placedAt: new Date().toISOString(),
      },
    };
    orders = [order, ...orders];
    setTimeout(() => resolve(order), 40);
  });
}
