import { describe, expect, it } from "vitest";
import { formatINR } from "@/lib/money";
import type { KotOrder } from "@/components/vendor/kot-ticket";

describe("KotOrder data mapping and price breakdown", () => {
  it("structures KotOrder with item prices, unit prices, addOns, and pricing breakdown", () => {
    const sampleOrder: KotOrder = {
      orderNumber: "TRF-NITP-1404",
      placedAtLabel: "15:02",
      customerName: "Nikhil Singh",
      customerPhone: "+918355005926",
      restaurantName: "Chai Sutta Bar (CSB)",
      zoneName: "Boys Hostel",
      zoneInstructions: "Hostel gate security cabin.",
      prepMinutes: 30,
      cashDuePaise: 18400,
      gateCode: "4156",
      description: null,
      items: [
        {
          name: "Schezwan Maggi",
          isVeg: true,
          quantity: 1,
          unitPricePaise: 7500,
          lineTotalPaise: 7500,
          addOns: [],
        },
        {
          name: "Veg Cheese Paneer Burger",
          isVeg: true,
          quantity: 1,
          unitPricePaise: 9900,
          lineTotalPaise: 9900,
          addOns: [{ name: "Extra Cheese", pricePaise: 2000 }],
        },
      ],
      pricing: {
        subtotalPaise: 17400,
        packagingFeePaise: 0,
        deliveryFeePaise: 1000,
        discountPaise: 0,
        grandTotalPaise: 18400,
      },
    };

    expect(sampleOrder.items[0]?.unitPricePaise).toBe(7500);
    expect(sampleOrder.items[0]?.lineTotalPaise).toBe(7500);
    expect(formatINR(sampleOrder.items[0]?.lineTotalPaise ?? 0)).toBe("₹75");
    expect(formatINR(sampleOrder.items[1]?.lineTotalPaise ?? 0)).toBe("₹99");

    // AddOn price check
    const addOn = sampleOrder.items[1]?.addOns[0];
    expect(typeof addOn === "object" && addOn !== null && "pricePaise" in addOn).toBe(true);
    if (typeof addOn === "object" && addOn !== null) {
      expect(addOn.pricePaise).toBe(2000);
      expect(formatINR(addOn.pricePaise ?? 0)).toBe("₹20");
    }

    // Pricing breakdown check
    expect(sampleOrder.pricing).toBeDefined();
    expect(sampleOrder.pricing?.subtotalPaise).toBe(17400);
    expect(formatINR(sampleOrder.pricing?.subtotalPaise ?? 0)).toBe("₹174");
    expect(sampleOrder.pricing?.deliveryFeePaise).toBe(1000);
    expect(formatINR(sampleOrder.pricing?.deliveryFeePaise ?? 0)).toBe("₹10");
    expect(formatINR(sampleOrder.cashDuePaise)).toBe("₹184");
  });

  it("handles quantity greater than 1 with unit price display", () => {
    const item = {
      name: "Cold Coffee",
      isVeg: true,
      quantity: 3,
      unitPricePaise: 6000,
      lineTotalPaise: 18000,
      addOns: [],
    };

    expect(item.quantity).toBe(3);
    expect(formatINR(item.unitPricePaise)).toBe("₹60");
    expect(formatINR(item.lineTotalPaise)).toBe("₹180");
  });

  it("handles stockout adjustments when cash due is less than grand total", () => {
    const pricing = {
      subtotalPaise: 20000,
      packagingFeePaise: 1000,
      deliveryFeePaise: 1500,
      discountPaise: 0,
      grandTotalPaise: 22500,
    };
    const cashDuePaise = 15000; // An item was cancelled / stockout
    const adjustmentPaise = pricing.grandTotalPaise - cashDuePaise;

    expect(adjustmentPaise).toBe(7500);
    expect(formatINR(adjustmentPaise)).toBe("₹75");
  });

  it("maintains backwards compatibility with string addOns and missing pricing", () => {
    const legacyOrder: KotOrder = {
      orderNumber: "TRF-NITP-1001",
      placedAtLabel: "12:00",
      customerName: "Student",
      customerPhone: "+919999999999",
      restaurantName: "Canteen",
      zoneName: "Gate 1",
      zoneInstructions: "Wait outside",
      prepMinutes: 15,
      cashDuePaise: 5000,
      gateCode: "1234",
      items: [
        {
          name: "Samosa",
          isVeg: true,
          quantity: 2,
          addOns: ["Extra Chutney"],
        },
      ],
    };

    expect(legacyOrder.items[0]?.addOns).toEqual(["Extra Chutney"]);
    expect(legacyOrder.pricing).toBeUndefined();
    expect(legacyOrder.items[0]?.lineTotalPaise).toBeUndefined();
  });
});
