import { describe, expect, it } from "vitest";
import {
  VENDOR_STRINGS,
  type VendorLanguage,
  type VendorStringKey,
} from "@/lib/i18n/vendor-dictionary";

describe("Vendor Bilingual Dictionary", () => {
  const keys = Object.keys(VENDOR_STRINGS) as VendorStringKey[];

  it("contains all essential keys with non-empty en and hi strings", () => {
    expect(keys.length).toBeGreaterThan(40);

    for (const key of keys) {
      const entry = VENDOR_STRINGS[key];
      expect(entry, `Key "${key}" should have an entry`).toBeDefined();
      expect(typeof entry.en, `Key "${key}" should have a string for "en"`).toBe("string");
      expect(typeof entry.hi, `Key "${key}" should have a string for "hi"`).toBe("string");
      expect(entry.en.trim().length, `Key "${key}" has empty "en" string`).toBeGreaterThan(0);
      expect(entry.hi.trim().length, `Key "${key}" has empty "hi" string`).toBeGreaterThan(0);
    }
  });

  it("provides everyday, conversational Hindi terms without archaic vocabulary", () => {
    // Check navigation items
    expect(VENDOR_STRINGS.navOrders.hi).toBe("ऑर्डर");
    expect(VENDOR_STRINGS.navMenu.hi).toBe("मेन्यू");
    expect(VENDOR_STRINGS.navEarnings.hi).toBe("कमाई");
    expect(VENDOR_STRINGS.navSettings.hi).toBe("सेटिंग्स");

    // Check board columns
    expect(VENDOR_STRINGS.colNewOrders.hi).toBe("नए ऑर्डर");
    expect(VENDOR_STRINGS.colPreparing.hi).toBe("बन रहा है");
    expect(VENDOR_STRINGS.colOnTheWay.hi).toBe("रास्ते में है");

    // Check card actions
    expect(VENDOR_STRINGS.accept.hi).toBe("स्वीकार करें");
    expect(VENDOR_STRINGS.reject.hi).toBe("मना करें");
    expect(VENDOR_STRINGS.callCustomer.hi).toBe("छात्र को कॉल करें");
  });

  it("has matching keys structure for both languages", () => {
    const languages: VendorLanguage[] = ["en", "hi"];
    for (const lang of languages) {
      for (const key of keys) {
        expect(VENDOR_STRINGS[key][lang]).toBeDefined();
      }
    }
  });

  it("localizes page titles and descriptions", () => {
    expect(VENDOR_STRINGS.menuPageTitle.hi).toBe("मेन्यू");
    expect(VENDOR_STRINGS.earningsPageTitle.hi).toBe("कमाई");
    expect(VENDOR_STRINGS.settingsPageTitle.hi).toBe("सेटिंग्स");
  });

  it("localizes ledger notes and types accurately into conversational Hindi", async () => {
    const { localizeLedgerNote, localizeLedgerType, formatCampusDateLocalized } = await import(
      "@/lib/i18n/vendor-dictionary"
    );

    // Ledger note localization
    expect(
      localizeLedgerNote("Gateway fee not returned on refund of TRF-NITP-0008", "hi"),
    ).toBe("ऑर्डर TRF-NITP-0008 के रिफंड पर गेटवे शुल्क कटौती");

    expect(
      localizeLedgerNote("Gateway fee not returned on refund of TRF-NITP-0008", "en"),
    ).toBe("Gateway fee not returned on refund of TRF-NITP-0008");

    expect(
      localizeLedgerNote("Cold Coffee was unavailable and removed (F6)", "hi"),
    ).toBe("Cold Coffee उपलब्ध नहीं था, इसलिए ऑर्डर से हटाया गया (86)");

    // Ledger type tag localization
    expect(localizeLedgerType("REFUND_GATEWAY_RECOVERY", "hi")).toBe("रिफंड गेटवे शुल्क वसूली");
    expect(localizeLedgerType("DISPUTE_DEBIT", "hi")).toBe("विवाद कटौती");
    expect(localizeLedgerType("REFUND_GATEWAY_RECOVERY", "en")).toBe("refund gateway recovery");

    // Localized campus date
    const formattedHi = formatCampusDateLocalized("2026-09-02", "hi");
    expect(formattedHi).toContain("2026");
  });
});
