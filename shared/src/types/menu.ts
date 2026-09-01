import type { Paise } from "../money.js";
import type { Id } from "./common.js";

export interface IMenuCategory {
  _id: Id;
  restaurantId: Id;
  name: string;
  sortOrder: number;
}

export interface IAddOn {
  addOnId: string;
  name: string;
  pricePaise: Paise;
  isAvailable: boolean;
}

/**
 * A group of add-ons with selection rules — "Choose 1 sauce", "Up to 3 toppings".
 * The rules are enforced in the UI and again on the server, because a client-supplied
 * selection is untrusted like every other input.
 */
export interface IAddOnGroup {
  groupId: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: IAddOn[];
}

export interface IMenuItem {
  _id: Id;
  restaurantId: Id;
  categoryId: Id;

  name: string;
  description?: string;
  imageUrl?: string;

  pricePaise: Paise;
  isVeg: boolean;

  /**
   * The 86 flag. A BOOLEAN, never a count.
   *
   * True stock counting would mean quantity tracking, decrements, cart reservations,
   * and TTL release on abandonment — enormous machinery for a canteen that cooks to
   * order. The vendor 86s an item and F6 handles whoever was mid-order.
   *
   * An unavailable item is STRUCK THROUGH in the UI, never hidden: a student should
   * see that the dish exists and is out today.
   */
  isAvailable: boolean;

  addOnGroups: IAddOnGroup[];
  sortOrder: number;
}
