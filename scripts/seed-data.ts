/**
 * NIT Patna seed data.
 *
 * This is not filler. It is the demo script: these gates, curfew times and
 * menus are what a restaurant owner sees in the pitch, so every one of them
 * has to be plausible to somebody who walks that campus daily.
 *
 * MASTER_PROMPT_PRD.md Part 8.4 asks for the ACTUAL gates, curfew times and
 * coordinates — "walk the campus and record them; this data is the product".
 * Everything marked VERIFY ON CAMPUS below is a researched placeholder.
 * Correcting them is a data edit, not a code change.
 *
 * Ids are deterministic and readable, so re-running the seed is idempotent
 * and a Mongo dump is legible at 2 AM.
 */

import { DEFAULTS, ROLE, ZONE_TYPE } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";
import type { Campus, DeliveryZone } from "@/types/campus";
import type { MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";

const R = rupeesToPaise;
const HM = (h: number, m = 0): number => h * 60 + m;

export const CAMPUS_ID = "campus_nitp";

/* ══════════════════════════════════════════════════════════════════════
   Delivery zones — GATES, not addresses.
   Handover happens at a gate because outside riders cannot enter hostels
   or academic blocks. VERIFY ON CAMPUS: names, coordinates, curfew times.
   ══════════════════════════════════════════════════════════════════════ */

export const ZONES: DeliveryZone[] = [
  {
    id: "zone_main_gate",
    name: "Main Campus Gate",
    zoneType: ZONE_TYPE.MAIN_GATE,
    curfewMinutes: null, // 24x7 — the fallback every other zone points at
    opensMinutes: 0,
    lat: 25.6206, // VERIFY ON CAMPUS
    lng: 85.1721,
    instructions: "Wait at the security post to the right of the main barrier.",
    isActive: true,
    isFallback: true,
  },
  {
    id: "zone_ganga_boys",
    name: "Ganga Boys Hostel Gate",
    zoneType: ZONE_TYPE.HOSTEL_BOYS,
    curfewMinutes: HM(22), // 22:00 — VERIFY ON CAMPUS
    opensMinutes: HM(6),
    lat: 25.6218,
    lng: 85.1736,
    instructions: "Hand over at the warden cabin window. Do not enter the block.",
    isActive: true,
    isFallback: false,
  },
  {
    id: "zone_kaveri_girls",
    name: "Kaveri Girls Hostel Gate",
    zoneType: ZONE_TYPE.HOSTEL_GIRLS,
    curfewMinutes: HM(21, 30), // 21:30 — the earliest curfew on campus
    opensMinutes: HM(6),
    lat: 25.6195,
    lng: 85.1748,
    instructions: "Guard cabin only. Female security staff will call the student out.",
    isActive: true,
    isFallback: false,
  },
  {
    id: "zone_brahmaputra_boys",
    name: "Brahmaputra Boys Hostel Gate",
    zoneType: ZONE_TYPE.HOSTEL_BOYS,
    curfewMinutes: HM(22),
    opensMinutes: HM(6),
    lat: 25.6229,
    lng: 85.1712,
    instructions: "Left of the cycle stand, under the light.",
    isActive: true,
    isFallback: false,
  },
  {
    id: "zone_academic",
    name: "Academic Block Gate",
    zoneType: ZONE_TYPE.ACADEMIC,
    curfewMinutes: HM(19), // 19:00 — shuts before the late-night window opens
    opensMinutes: HM(8),
    lat: 25.6201,
    lng: 85.1729,
    instructions: "Reception desk at the CSE block entrance.",
    isActive: true,
    isFallback: false,
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Campus
   ══════════════════════════════════════════════════════════════════════ */

export const CAMPUS: Campus = {
  _id: CAMPUS_ID,
  slug: "nit-patna",
  name: "NIT Patna",
  city: "Patna",
  timezone: "Asia/Kolkata",
  center: { lat: 25.6206, lng: 85.1721 },
  geofence: {
    type: "Polygon",
    coordinates: [
      [
        // A rough rectangle around the campus. The admin geofence editor
        // replaces this with a traced boundary. VERIFY ON CAMPUS.
        [85.1698, 25.6182],
        [85.1762, 25.6182],
        [85.1762, 25.6242],
        [85.1698, 25.6242],
        [85.1698, 25.6182],
      ],
    ],
  },
  zones: ZONES,
  settings: {
    deliveryFeePaise: R(15), // PRD Part 8.3 — set the real fee before launch
    commissionBps: DEFAULTS.commissionBps,
    gatewayFeeBps: DEFAULTS.gatewayFeeBps, // A3 — VERIFY AGAINST YOUR RAZORPAY PLAN
    codHandlingFeePaise: DEFAULTS.codHandlingFeePaise,
    couponFundedBy: "PLATFORM",
    roundingMode: "CEIL",
    transitMinutes: 8, // PRD Part 8.3 — walk it and time it
    vendorAckSeconds: DEFAULTS.vendorAckSeconds,
    vendorAutoExpireSeconds: DEFAULTS.vendorAutoExpireSeconds,
    gateGraceSeconds: DEFAULTS.gateGraceSeconds,
    curfewBufferMinutes: DEFAULTS.curfewBufferMinutes,
    stockoutResolutionSeconds: DEFAULTS.stockoutResolutionSeconds,
    disputeWindowMinutes: DEFAULTS.disputeWindowMinutes,
    codEnabled: true,
  },
  isActive: true,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-01T00:00:00Z"),
};

/* ══════════════════════════════════════════════════════════════════════
   Restaurants
   ══════════════════════════════════════════════════════════════════════ */

const ALL_ZONES = ZONES.map((z) => z.id);

function restaurant(
  partial: Pick<
    Restaurant,
    | "_id"
    | "slug"
    | "name"
    | "cuisines"
    | "phone"
    | "description"
    | "packagingFeePaise"
    | "minOrderPaise"
    | "prepMinutes"
    | "servedZoneIds"
    | "opensMinutes"
    | "closesMinutes"
    | "isOpen"
  > &
    Partial<Restaurant>,
): Restaurant {
  return {
    campusId: CAMPUS_ID,
    imageUrl: null,
    bannerUrl: null,
    foodGstBps: 0, // A2 — canteens below the 20L registration threshold
    commissionBpsOverride: null,
    isApproved: true,
    rating: null,
    ratingCount: 0,
    kyc: {
      status: "APPROVED",
      ownerName: "Owner",
      ownerPhone: partial.phone,
      gstin: null,
      fssai: null,
      reviewedAt: new Date("2026-08-05T00:00:00Z"),
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: partial.name,
      accountNumber: "000000000000",
      ifsc: "SBIN0000000",
      upiId: null,
    },
    expiryCountToday: 0,
    autoClosedAt: null,
    createdAt: new Date("2026-08-05T00:00:00Z"),
    updatedAt: new Date("2026-08-05T00:00:00Z"),
    ...partial,
  };
}

export const RESTAURANTS: Restaurant[] = [
  restaurant({
    _id: "rest_nit_canteen",
    slug: "nit-canteen",
    name: "NIT Canteen",
    cuisines: ["North Indian", "Chinese"],
    phone: "+919430000001",
    description:
      "The main campus canteen. Thalis, noodles and everything in between, cooked to order since 1986.",
    packagingFeePaise: R(10),
    minOrderPaise: R(50),
    prepMinutes: 15,
    servedZoneIds: ALL_ZONES,
    opensMinutes: HM(7),
    closesMinutes: HM(23, 30),
    isOpen: true,
    rating: 4.4,
    ratingCount: 312,
  }),
  restaurant({
    _id: "rest_tandoori_nights",
    slug: "tandoori-nights",
    name: "Tandoori Nights",
    cuisines: ["North Indian", "Mughlai"],
    phone: "+919430000002",
    description: "Clay-oven rotis, rich gravies and biryani. Heavier plates, longer prep.",
    packagingFeePaise: R(15),
    minOrderPaise: R(120),
    prepMinutes: 22,
    // Deliberately does NOT serve the academic block — a demo of the
    // zone-filtering that defines the student list.
    servedZoneIds: ["zone_main_gate", "zone_ganga_boys", "zone_brahmaputra_boys", "zone_kaveri_girls"],
    opensMinutes: HM(11),
    closesMinutes: HM(23),
    isOpen: true,
    rating: 4.6,
    ratingCount: 188,
  }),
  restaurant({
    _id: "rest_wrap_roll",
    slug: "wrap-and-roll-junction",
    name: "Wrap & Roll Junction",
    cuisines: ["Rolls", "Fast Food"],
    phone: "+919430000003",
    description: "Egg rolls, paneer rolls and fries. The late-night default.",
    packagingFeePaise: R(8),
    minOrderPaise: R(40),
    prepMinutes: 12,
    servedZoneIds: ["zone_main_gate", "zone_ganga_boys", "zone_brahmaputra_boys", "zone_kaveri_girls"],
    opensMinutes: HM(16),
    closesMinutes: HM(2), // crosses midnight — the 22:30-02:30 cluster
    isOpen: true,
    rating: 4.2,
    ratingCount: 407,
  }),
  restaurant({
    _id: "rest_amul_parlour",
    slug: "amul-parlour-and-bakes",
    name: "Amul Parlour & Bakes",
    cuisines: ["Beverages", "Desserts", "Bakery"],
    phone: "+919430000004",
    description: "Shakes, cold coffee, pastries and puffs. Closes early.",
    packagingFeePaise: R(5),
    minOrderPaise: R(30),
    prepMinutes: 8,
    servedZoneIds: ["zone_main_gate", "zone_academic", "zone_ganga_boys"],
    opensMinutes: HM(9),
    closesMinutes: HM(20),
    // Closed right now, so the student list has something to grey out at the
    // bottom — closed restaurants are shown, never hidden.
    isOpen: false,
    rating: 4.0,
    ratingCount: 96,
  }),
];

/* ══════════════════════════════════════════════════════════════════════
   Menus
   ══════════════════════════════════════════════════════════════════════ */

export const CATEGORIES: MenuCategory[] = [
  { _id: "cat_nc_thali", restaurantId: "rest_nit_canteen", name: "Thalis & Rice", sortOrder: 1 },
  { _id: "cat_nc_chinese", restaurantId: "rest_nit_canteen", name: "Chinese", sortOrder: 2 },
  { _id: "cat_nc_snacks", restaurantId: "rest_nit_canteen", name: "Snacks", sortOrder: 3 },
  { _id: "cat_nc_drinks", restaurantId: "rest_nit_canteen", name: "Beverages", sortOrder: 4 },

  { _id: "cat_tn_breads", restaurantId: "rest_tandoori_nights", name: "Tandoor & Breads", sortOrder: 1 },
  { _id: "cat_tn_curries", restaurantId: "rest_tandoori_nights", name: "Curries", sortOrder: 2 },
  { _id: "cat_tn_biryani", restaurantId: "rest_tandoori_nights", name: "Biryani", sortOrder: 3 },

  { _id: "cat_wr_rolls", restaurantId: "rest_wrap_roll", name: "Rolls", sortOrder: 1 },
  { _id: "cat_wr_sides", restaurantId: "rest_wrap_roll", name: "Sides", sortOrder: 2 },

  { _id: "cat_ap_shakes", restaurantId: "rest_amul_parlour", name: "Shakes & Coffee", sortOrder: 1 },
  { _id: "cat_ap_bakes", restaurantId: "rest_amul_parlour", name: "Bakes", sortOrder: 2 },
];

/* --- Reusable add-on groups ---------------------------------------- */

const SPICE_LEVEL = {
  id: "grp_spice",
  name: "Spice level",
  minSelect: 1, // required choice
  maxSelect: 1,
  options: [
    { id: "opt_mild", name: "Mild", pricePaise: 0, isAvailable: true },
    { id: "opt_medium", name: "Medium", pricePaise: 0, isAvailable: true },
    { id: "opt_hot", name: "Extra hot", pricePaise: 0, isAvailable: true },
  ],
};

const ROLL_EXTRAS = {
  id: "grp_roll_extras",
  name: "Add extras",
  minSelect: 0, // optional
  maxSelect: 3,
  options: [
    { id: "opt_cheese", name: "Cheese slice", pricePaise: R(20), isAvailable: true },
    { id: "opt_egg", name: "Extra egg", pricePaise: R(15), isAvailable: true },
    { id: "opt_mayo", name: "Extra mayo", pricePaise: R(10), isAvailable: true },
    { id: "opt_onion", name: "Extra onion", pricePaise: 0, isAvailable: true },
  ],
};

const THALI_SIZE = {
  id: "grp_thali_size",
  name: "Portion",
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: "opt_half", name: "Half", pricePaise: 0, isAvailable: true },
    { id: "opt_full", name: "Full", pricePaise: R(30), isAvailable: true },
  ],
};

function item(
  partial: Pick<
    MenuItem,
    "_id" | "restaurantId" | "categoryId" | "name" | "description" | "isVeg" | "pricePaise" | "sortOrder"
  > &
    Partial<MenuItem>,
): MenuItem {
  return {
    imageUrl: null,
    isAvailable: true,
    addOnGroups: [],
    isPopular: false,
    ...partial,
  };
}

export const MENU_ITEMS: MenuItem[] = [
  /* ── NIT Canteen ────────────────────────────────────────────────── */
  item({
    _id: "item_nc_veg_thali",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_thali",
    name: "Veg Thali",
    description: "Dal, seasonal sabzi, rice, four rotis, salad and papad.",
    isVeg: true,
    pricePaise: R(90),
    sortOrder: 1,
    isPopular: true,
    addOnGroups: [THALI_SIZE],
  }),
  item({
    _id: "item_nc_chicken_thali",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_thali",
    name: "Chicken Thali",
    description: "Chicken curry, dal, rice, four rotis and salad.",
    isVeg: false,
    pricePaise: R(150),
    sortOrder: 2,
    isPopular: true,
    addOnGroups: [THALI_SIZE, SPICE_LEVEL],
  }),
  item({
    _id: "item_nc_rajma_chawal",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_thali",
    name: "Rajma Chawal",
    description: "Slow-cooked kidney beans over steamed rice.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 3,
  }),
  item({
    _id: "item_nc_jeera_rice",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_thali",
    name: "Jeera Rice",
    description: "Cumin-tempered basmati.",
    isVeg: true,
    pricePaise: R(60),
    sortOrder: 4,
  }),
  item({
    _id: "item_nc_veg_noodles",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_chinese",
    name: "Veg Hakka Noodles",
    description: "Wok-tossed with cabbage, carrot and spring onion.",
    isVeg: true,
    pricePaise: R(70),
    sortOrder: 1,
    isPopular: true,
    addOnGroups: [SPICE_LEVEL],
  }),
  item({
    _id: "item_nc_chilli_paneer",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_chinese",
    name: "Chilli Paneer",
    description: "Dry, with capsicum and onion.",
    isVeg: true,
    pricePaise: R(110),
    sortOrder: 2,
    addOnGroups: [SPICE_LEVEL],
    // Seeded as 86-ed, so the menu demonstrates the strike-through state
    // on first load. Unavailable items are shown, never hidden.
    isAvailable: false,
  }),
  item({
    _id: "item_nc_chicken_fried_rice",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_chinese",
    name: "Chicken Fried Rice",
    description: "Egg, shredded chicken and spring onion.",
    isVeg: false,
    pricePaise: R(120),
    sortOrder: 3,
    addOnGroups: [SPICE_LEVEL],
  }),
  item({
    _id: "item_nc_manchurian",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_chinese",
    name: "Veg Manchurian Gravy",
    description: "Fried vegetable balls in a soy-garlic gravy.",
    isVeg: true,
    pricePaise: R(95),
    sortOrder: 4,
  }),
  item({
    _id: "item_nc_samosa",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_snacks",
    name: "Samosa (2 pc)",
    description: "With tamarind and mint chutney.",
    isVeg: true,
    pricePaise: R(30),
    sortOrder: 1,
  }),
  item({
    _id: "item_nc_maggi",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_snacks",
    name: "Masala Maggi",
    description: "The 1 AM staple.",
    isVeg: true,
    pricePaise: R(45),
    sortOrder: 2,
    isPopular: true,
    addOnGroups: [
      {
        id: "grp_maggi_extras",
        name: "Add extras",
        minSelect: 0,
        maxSelect: 2,
        options: [
          { id: "opt_maggi_cheese", name: "Cheese", pricePaise: R(20), isAvailable: true },
          { id: "opt_maggi_egg", name: "Egg", pricePaise: R(15), isAvailable: true },
        ],
      },
    ],
  }),
  item({
    _id: "item_nc_bread_omelette",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_snacks",
    name: "Bread Omelette",
    description: "Two eggs, four slices, green chilli.",
    isVeg: false,
    pricePaise: R(50),
    sortOrder: 3,
  }),
  item({
    _id: "item_nc_chai",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_drinks",
    name: "Masala Chai",
    description: "Cutting glass.",
    isVeg: true,
    pricePaise: R(15),
    sortOrder: 1,
  }),
  item({
    _id: "item_nc_lassi",
    restaurantId: "rest_nit_canteen",
    categoryId: "cat_nc_drinks",
    name: "Sweet Lassi",
    description: "Thick, chilled, 300 ml.",
    isVeg: true,
    pricePaise: R(40),
    sortOrder: 2,
  }),

  /* ── Tandoori Nights ────────────────────────────────────────────── */
  item({
    _id: "item_tn_butter_naan",
    restaurantId: "rest_tandoori_nights",
    categoryId: "cat_tn_breads",
    name: "Butter Naan",
    description: "Clay oven, brushed with butter.",
    isVeg: true,
    pricePaise: R(35),
    sortOrder: 1,
  }),
  item({
    _id: "item_tn_tandoori_roti",
    restaurantId: "rest_tandoori_nights",
    categoryId: "cat_tn_breads",
    name: "Tandoori Roti",
    description: "Whole wheat.",
    isVeg: true,
    pricePaise: R(18),
    sortOrder: 2,
  }),
  item({
    _id: "item_tn_chicken_tikka",
    restaurantId: "rest_tandoori_nights",
    categoryId: "cat_tn_breads",
    name: "Chicken Tikka (6 pc)",
    description: "Yoghurt and chilli marinade, charred in the tandoor.",
    isVeg: false,
    pricePaise: R(220),
    sortOrder: 3,
    isPopular: true,
    addOnGroups: [SPICE_LEVEL],
  }),
  item({
    _id: "item_tn_paneer_tikka",
    restaurantId: "rest_tandoori_nights",
    categoryId: "cat_tn_breads",
    name: "Paneer Tikka (8 pc)",
    description: "With capsicum and onion.",
    isVeg: true,
    pricePaise: R(190),
    sortOrder: 4,
    addOnGroups: [SPICE_LEVEL],
  }),
  item({
    _id: "item_tn_butter_chicken",
    restaurantId: "rest_tandoori_nights",
    categoryId: "cat_tn_curries",
    name: "Butter Chicken",
    description: "Tomato and cream gravy, boneless.",
    isVeg: false,
    pricePaise: R(240),
    sortOrder: 1,
    isPopular: true,
    addOnGroups: [SPICE_LEVEL],
  }),
  item({
    _id: "item_tn_dal_makhani",
    restaurantId: "rest_tandoori_nights",
    categoryId: "cat_tn_curries",
    name: "Dal Makhani",
    description: "Overnight black lentils.",
    isVeg: true,
    pricePaise: R(150),
    sortOrder: 2,
  }),
  item({
    _id: "item_tn_shahi_paneer",
    restaurantId: "rest_tandoori_nights",
    categoryId: "cat_tn_curries",
    name: "Shahi Paneer",
    description: "Cashew and cream gravy.",
    isVeg: true,
    pricePaise: R(180),
    sortOrder: 3,
  }),
  item({
    _id: "item_tn_chicken_biryani",
    restaurantId: "rest_tandoori_nights",
    categoryId: "cat_tn_biryani",
    name: "Chicken Biryani",
    description: "Dum-cooked, with raita and salan.",
    isVeg: false,
    pricePaise: R(200),
    sortOrder: 1,
    isPopular: true,
    addOnGroups: [SPICE_LEVEL],
  }),
  item({
    _id: "item_tn_veg_biryani",
    restaurantId: "rest_tandoori_nights",
    categoryId: "cat_tn_biryani",
    name: "Veg Biryani",
    description: "With raita.",
    isVeg: true,
    pricePaise: R(160),
    sortOrder: 2,
  }),

  /* ── Wrap & Roll Junction ───────────────────────────────────────── */
  item({
    _id: "item_wr_egg_roll",
    restaurantId: "rest_wrap_roll",
    categoryId: "cat_wr_rolls",
    name: "Egg Roll",
    description: "Double egg, onion, green chutney.",
    isVeg: false,
    pricePaise: R(60),
    sortOrder: 1,
    isPopular: true,
    addOnGroups: [ROLL_EXTRAS],
  }),
  item({
    _id: "item_wr_chicken_roll",
    restaurantId: "rest_wrap_roll",
    categoryId: "cat_wr_rolls",
    name: "Chicken Roll",
    description: "Shredded chicken, onion, mayo.",
    isVeg: false,
    pricePaise: R(90),
    sortOrder: 2,
    isPopular: true,
    addOnGroups: [ROLL_EXTRAS],
  }),
  item({
    _id: "item_wr_paneer_roll",
    restaurantId: "rest_wrap_roll",
    categoryId: "cat_wr_rolls",
    name: "Paneer Roll",
    description: "Tandoori paneer, onion, mint mayo.",
    isVeg: true,
    pricePaise: R(85),
    sortOrder: 3,
    addOnGroups: [ROLL_EXTRAS],
  }),
  item({
    _id: "item_wr_aloo_roll",
    restaurantId: "rest_wrap_roll",
    categoryId: "cat_wr_rolls",
    name: "Aloo Roll",
    description: "Spiced potato, the cheapest thing on campus after midnight.",
    isVeg: true,
    pricePaise: R(45),
    sortOrder: 4,
    addOnGroups: [ROLL_EXTRAS],
  }),
  item({
    _id: "item_wr_fries",
    restaurantId: "rest_wrap_roll",
    categoryId: "cat_wr_sides",
    name: "Masala Fries",
    description: "Chaat masala and lime.",
    isVeg: true,
    pricePaise: R(70),
    sortOrder: 1,
  }),
  item({
    _id: "item_wr_chicken_momo",
    restaurantId: "rest_wrap_roll",
    categoryId: "cat_wr_sides",
    name: "Chicken Momo (8 pc)",
    description: "Steamed, with red chutney.",
    isVeg: false,
    pricePaise: R(100),
    sortOrder: 2,
  }),
  item({
    _id: "item_wr_coke",
    restaurantId: "rest_wrap_roll",
    categoryId: "cat_wr_sides",
    name: "Cold Drink (300 ml)",
    description: "Chilled.",
    isVeg: true,
    pricePaise: R(25),
    sortOrder: 3,
  }),

  /* ── Amul Parlour & Bakes ───────────────────────────────────────── */
  item({
    _id: "item_ap_cold_coffee",
    restaurantId: "rest_amul_parlour",
    categoryId: "cat_ap_shakes",
    name: "Cold Coffee",
    description: "Blended, with ice cream.",
    isVeg: true,
    pricePaise: R(70),
    sortOrder: 1,
    isPopular: true,
  }),
  item({
    _id: "item_ap_choco_shake",
    restaurantId: "rest_amul_parlour",
    categoryId: "cat_ap_shakes",
    name: "Chocolate Shake",
    description: "Thick, 350 ml.",
    isVeg: true,
    pricePaise: R(80),
    sortOrder: 2,
  }),
  item({
    _id: "item_ap_mango_shake",
    restaurantId: "rest_amul_parlour",
    categoryId: "cat_ap_shakes",
    name: "Mango Shake",
    description: "Seasonal.",
    isVeg: true,
    pricePaise: R(75),
    sortOrder: 3,
    isAvailable: false, // out of season — another strike-through demo
  }),
  item({
    _id: "item_ap_veg_puff",
    restaurantId: "rest_amul_parlour",
    categoryId: "cat_ap_bakes",
    name: "Veg Puff",
    description: "Flaky, spiced potato filling.",
    isVeg: true,
    pricePaise: R(25),
    sortOrder: 1,
  }),
  item({
    _id: "item_ap_choco_pastry",
    restaurantId: "rest_amul_parlour",
    categoryId: "cat_ap_bakes",
    name: "Chocolate Pastry",
    description: "Single slice.",
    isVeg: true,
    pricePaise: R(60),
    sortOrder: 2,
  }),
  item({
    _id: "item_ap_bun_maska",
    restaurantId: "rest_amul_parlour",
    categoryId: "cat_ap_bakes",
    name: "Bun Maska",
    description: "With a generous slab of butter.",
    isVeg: true,
    pricePaise: R(30),
    sortOrder: 3,
  }),
];

/* ══════════════════════════════════════════════════════════════════════
   Demo accounts
   ══════════════════════════════════════════════════════════════════════ */

function user(partial: Pick<User, "_id" | "role" | "name" | "email"> & Partial<User>): User {
  return {
    authId: null, // filled in by Supabase at Phase 8
    phone: null,
    campusId: CAMPUS_ID,
    restaurantId: null,
    codBlocked: false,
    codBlockedReason: null,
    strikes: 0,
    createdAt: new Date("2026-08-10T00:00:00Z"),
    updatedAt: new Date("2026-08-10T00:00:00Z"),
    ...partial,
  };
}

export const USERS: User[] = [
  user({
    _id: "user_vendor_canteen",
    role: ROLE.VENDOR_OWNER,
    name: "Suresh Prasad",
    email: "owner@nitcanteen.in",
    phone: "+919430000001",
    restaurantId: "rest_nit_canteen",
  }),
  user({
    _id: "user_vendor_tandoori",
    role: ROLE.VENDOR_OWNER,
    name: "Imran Ali",
    email: "owner@tandoorinights.in",
    phone: "+919430000002",
    restaurantId: "rest_tandoori_nights",
  }),
  user({
    _id: "user_vendor_wrap",
    role: ROLE.VENDOR_OWNER,
    name: "Deepak Yadav",
    email: "owner@wraproll.in",
    phone: "+919430000003",
    restaurantId: "rest_wrap_roll",
  }),
  user({
    _id: "user_vendor_amul",
    role: ROLE.VENDOR_OWNER,
    name: "Nisha Gupta",
    email: "owner@amulparlour.in",
    phone: "+919430000004",
    restaurantId: "rest_amul_parlour",
  }),
  user({
    _id: "user_admin",
    role: ROLE.SUPER_ADMIN,
    name: "TREFOOD Ops",
    email: "ops@trefood.in",
    phone: "+919000000000",
    campusId: null,
  }),
];
