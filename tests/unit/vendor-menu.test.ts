import { describe, expect, it } from "vitest";
import {
  createVendorMenuItem,
  updateVendorMenuItem,
  deleteVendorMenuItem,
  createVendorCategory,
  updateVendorCategory,
  deleteVendorCategory,
} from "@/server/actions/vendor";
import { rupeesToPaise } from "@/lib/money";

describe("Vendor Menu Validation and Calculations", () => {
  it("converts rupees to paise accurately for base price and add-on options", () => {
    expect(rupeesToPaise(15)).toBe(1500);
    expect(rupeesToPaise(0)).toBe(0);
    expect(rupeesToPaise(49.5)).toBe(4950);
  });

  it("rejects createVendorMenuItem when input is invalid or missing required fields", async () => {
    // Missing category
    const res1 = await createVendorMenuItem({
      name: "Cold Coffee",
      priceRupees: 60,
    });
    expect(res1.status).toBe("error");

    // Empty name
    const res2 = await createVendorMenuItem({
      categoryId: "cat_123",
      name: "",
      priceRupees: 60,
    });
    expect(res2.status).toBe("error");

    // Negative price
    const res3 = await createVendorMenuItem({
      categoryId: "cat_123",
      name: "Cold Coffee",
      priceRupees: -10,
    });
    expect(res3.status).toBe("error");
  });

  it("rejects updateVendorMenuItem when itemId or fields are invalid", async () => {
    // Missing itemId
    const res1 = await updateVendorMenuItem({
      categoryId: "cat_123",
      name: "Cold Coffee",
      priceRupees: 70,
    });
    expect(res1.status).toBe("error");

    // Empty name
    const res2 = await updateVendorMenuItem({
      itemId: "item_123",
      categoryId: "cat_123",
      name: "   ",
      priceRupees: 70,
    });
    expect(res2.status).toBe("error");
  });

  it("rejects deleteVendorMenuItem when itemId is missing", async () => {
    const res = await deleteVendorMenuItem({});
    expect(res.status).toBe("error");
  });

  it("rejects createVendorCategory when name is blank", async () => {
    const res = await createVendorCategory({ name: "   " });
    expect(res.status).toBe("error");
  });

  it("rejects updateVendorCategory when categoryId or name is blank", async () => {
    const res1 = await updateVendorCategory({ categoryId: "", name: "Snacks" });
    expect(res1.status).toBe("error");

    const res2 = await updateVendorCategory({ categoryId: "cat_123", name: "" });
    expect(res2.status).toBe("error");
  });

  it("rejects deleteVendorCategory when categoryId is blank", async () => {
    const res = await deleteVendorCategory({ categoryId: "" });
    expect(res.status).toBe("error");
  });
});
