/**
 * Vrindavan Bhog Pure Vegetarian Restaurant Onboarding & Menu Seeding Script.
 *
 * Menu sections transcribed from official menu photos:
 * 1. Special Thalis (Special Thali, Regular Thali)
 * 2. Starters & Tandoor (Paneer Tikka, Mushroom Tikka, Pakodas, Kebabs)
 * 3. Main Course - Paneer, Mushroom & Kaju (Paneer Butter Masala, Kadahi Paneer, Kaju Masala, etc.)
 * 4. Vegetable Main Course (Mix Veg, Bhindi Masala, Aloo Jeera, Aloo Gobi Matar, etc.)
 * 5. Dal Specials (Dal Fry, Dal Tadka, Dal Makhani, Dal Punjabi)
 * 6. Tandoori Breads & Parathas (Tawa Roti, Tandoori Roti, Naan, Lachha Paratha, etc.)
 * 7. Rice & Dum Biryani (Special Matka Dum Biryani, Jeera Rice, Fried Rice, etc.)
 * 8. South Indian (Idli, Medu Vada, Uttapam, Dosas)
 * 9. Chinese & Fast Food (Chowmein, Manchurian, Rolls, Chilli Potatoes, Momos)
 * 10. Snacks (Chhola Bhatura, Puri Sabzi Raita)
 * 11. Soups (Veg Manchow, Hot & Sour, Sweet Corn, Seven Day's, Tomato, Mushroom)
 * 12. Salads, Raita & Papad (Green Salad, Masala Papad, Mix Raita)
 * 13. Sweets & Desserts (Ghee Gulab Jamun, Rasgulla, Rasmalai, Rabri)
 * 14. Lassi & Refreshers (Special Matka Lassi, Dry Fruit Lassi, Namkeen Chhach)
 *
 * Pricing Rule:
 *   Every item is priced at exactly +Rs 5 over the printed menu price.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --conditions=react-server --import tsx scripts/seed-vrindavan-bhog.ts
 */

import { ROLE } from "@/lib/constants";
import { rupeesToPaise, type Paise } from "@/lib/money";
import { hashPassword } from "@/server/auth/passwords";
import { getMongoClient } from "@/server/db/client";
import * as db from "@/server/db/collections";
import type { AddOnGroup, MenuCategory, MenuItem, Restaurant } from "@/types/restaurant";
import type { User } from "@/types/user";
import { CAMPUS_ID } from "./seed-data";

const RESTAURANT_ID = "rest_vrindavan_bhog_nitp";
const VENDOR_USER_ID = "usr_vrindavan_bhog_vendor";
const VENDOR_EMAIL = "vrindavanbhog.nitp@trefood.in";

const R = rupeesToPaise;

function portionGroup(halfPaise: Paise, fullPaise: Paise, label1 = "Half", label2 = "Full"): AddOnGroup {
  return {
    id: "grp_portion",
    name: "Portion / Quantity",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_portion_half", name: label1, pricePaise: 0, isAvailable: true },
      { id: "opt_portion_full", name: label2, pricePaise: fullPaise - halfPaise, isAvailable: true },
    ],
  };
}

function butterOptionGroup(plainPaise: Paise, butterPaise: Paise): AddOnGroup {
  return {
    id: "grp_butter",
    name: "Butter Option",
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: "opt_plain", name: "Plain", pricePaise: 0, isAvailable: true },
      { id: "opt_butter", name: "Butter", pricePaise: butterPaise - plainPaise, isAvailable: true },
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Categories
   ══════════════════════════════════════════════════════════════════════ */

const CATEGORIES: { id: string; name: string; sortOrder: number }[] = [
  { id: "cat_vb_thali", name: "Special Thalis", sortOrder: 1 },
  { id: "cat_vb_starters", name: "Starters & Tandoor", sortOrder: 2 },
  { id: "cat_vb_main_course", name: "Main Course (Paneer & Mushroom)", sortOrder: 3 },
  { id: "cat_vb_veg_curries", name: "Vegetable Main Course", sortOrder: 4 },
  { id: "cat_vb_dal", name: "Dal Specials", sortOrder: 5 },
  { id: "cat_vb_breads", name: "Tandoori Breads & Parathas", sortOrder: 6 },
  { id: "cat_vb_rice", name: "Rice & Dum Biryani", sortOrder: 7 },
  { id: "cat_vb_south_indian", name: "South Indian", sortOrder: 8 },
  { id: "cat_vb_chinese", name: "Chinese & Fast Food", sortOrder: 9 },
  { id: "cat_vb_snacks", name: "Snacks", sortOrder: 10 },
  { id: "cat_vb_soups", name: "Soups", sortOrder: 11 },
  { id: "cat_vb_salads", name: "Salads, Raita & Papad", sortOrder: 12 },
  { id: "cat_vb_desserts", name: "Sweets & Desserts", sortOrder: 13 },
  { id: "cat_vb_beverages", name: "Lassi & Refreshers", sortOrder: 14 },
];

/* ══════════════════════════════════════════════════════════════════════
   Menu Items Definition (Prices are +Rs 5 over menu)
   ══════════════════════════════════════════════════════════════════════ */

interface ItemDef {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  isVeg: boolean;
  pricePaise: Paise;
  isPopular?: boolean;
  addOnGroups?: AddOnGroup[];
  sortOrder: number;
}

const ITEMS: ItemDef[] = [
  // ── 1. SPECIAL THALIS ────────────────────────────────────────────────
  {
    id: "vb_special_thali",
    categoryId: "cat_vb_thali",
    name: "Vrindavan Bhog Special Thali",
    description:
      "Tawa Roti, Puri, Jeera Rice, Dal, Paneer Sabji, Mix Veg, Green Vegetables, Snacks with Green & Red Chutney, Dahi Bhalla or Raita, Sweets, Buttermilk, Salad & Papad.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "vb_regular_thali",
    categoryId: "cat_vb_thali",
    name: "Regular Thali",
    description:
      "5 Tawa Rotis, Rice, Dal, Paneer Sabji, Green Vegetable or Dry Bhujiya, Buttermilk, Pickle, Salad & Chutney.",
    isVeg: true,
    pricePaise: R(154), // Menu 149 + 5
    isPopular: true,
    sortOrder: 2,
  },

  // ── 2. STARTERS & TANDOOR ────────────────────────────────────────────
  {
    id: "vb_crispy_chilly_baby_corn",
    categoryId: "cat_vb_starters",
    name: "Special Crispy Chilly Baby Corn",
    description: "Golden crisp fried baby corn tossed with capsicum, onion and sweet-spicy chili sauce.",
    isVeg: true,
    pricePaise: R(254), // Menu 249 + 5
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "vb_paneer_tikka",
    categoryId: "cat_vb_starters",
    name: "Paneer Tikka",
    description: "Fresh cottage cheese cubes marinated in spiced hung curd and char-grilled in tandoor.",
    isVeg: true,
    pricePaise: R(260), // Menu 255 + 5
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "vb_mushroom_tikka",
    categoryId: "cat_vb_starters",
    name: "Mushroom Tikka",
    description: "Whole button mushrooms marinated in aromatic tandoori masala and roasted golden.",
    isVeg: true,
    pricePaise: R(225), // Menu 220 + 5
    sortOrder: 3,
  },
  {
    id: "vb_mushroom_stuffed_tikka",
    categoryId: "cat_vb_starters",
    name: "Mushroom Stuffed Tikka",
    description: "Juicy mushrooms stuffed with seasoned paneer, herbs and spices, grilled to perfection.",
    isVeg: true,
    pricePaise: R(255), // Menu 250 + 5
    sortOrder: 4,
  },
  {
    id: "vb_paneer_pakoda",
    categoryId: "cat_vb_starters",
    name: "Paneer Pakoda",
    description: "Thick cottage cheese slices dipped in spiced gram flour batter and fried crisp.",
    isVeg: true,
    pricePaise: R(204), // Menu 199 + 5
    sortOrder: 5,
  },
  {
    id: "vb_veg_pakoda",
    categoryId: "cat_vb_starters",
    name: "Veg Pakoda",
    description: "Assorted seasonal vegetable fritters served hot with mint and tamarind chutneys.",
    isVeg: true,
    pricePaise: R(144), // Menu 139 + 5
    sortOrder: 6,
  },
  {
    id: "vb_paneer_seekh_kabab",
    categoryId: "cat_vb_starters",
    name: "Paneer Seekh Kabab",
    description: "Minced cottage cheese blended with roasted cumin, coriander and herbs, roasted on skewers.",
    isVeg: true,
    pricePaise: R(254), // Menu 249 + 5
    sortOrder: 7,
  },
  {
    id: "vb_paneer_malai_seekh_kabab",
    categoryId: "cat_vb_starters",
    name: "Paneer Malai Seekh Kabab",
    description: "Velvety smooth cottage cheese seekh kebabs enriched with fresh cream and cashew paste.",
    isVeg: true,
    pricePaise: R(275), // Menu 270 + 5
    sortOrder: 8,
  },
  {
    id: "vb_paneer_malai_tikka",
    categoryId: "cat_vb_starters",
    name: "Paneer Malai Tikka",
    description: "Melt-in-mouth paneer cubes soaked in rich clotted cream, cheese and mild spices.",
    isVeg: true,
    pricePaise: R(280), // Menu 275 + 5
    isPopular: true,
    sortOrder: 9,
  },
  {
    id: "vb_hara_bhara_kabab",
    categoryId: "cat_vb_starters",
    name: "Hara Bhara Kabab",
    description: "Healthy and crisp pan-fried green patties made from spinach, green peas and potatoes.",
    isVeg: true,
    pricePaise: R(204), // Menu 199 + 5
    sortOrder: 10,
  },

  // ── 3. MAIN COURSE (PANEER, MUSHROOM & KAJU) ─────────────────────────
  {
    id: "vb_paneer_chatkara",
    categoryId: "cat_vb_main_course",
    name: "Vrindavan Bhog Special Paneer Chatkara",
    description: "Chef's signature spicy and tangy paneer curry cooked with secret house spices.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "vb_kadahi_paneer",
    categoryId: "cat_vb_main_course",
    name: "Kadahi Paneer",
    description: "Paneer cubes tossed with fresh bell peppers, onions and freshly ground kadai masala.",
    isVeg: true,
    pricePaise: R(155), // Half 150+5, Full 290+5
    addOnGroups: [portionGroup(R(155), R(295))],
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "vb_paneer_handi",
    categoryId: "cat_vb_main_course",
    name: "Paneer Handi",
    description: "Slow-cooked cottage cheese in a rich, aromatic tomato-onion gravy prepared in a clay pot.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    sortOrder: 3,
  },
  {
    id: "vb_paneer_bhurji",
    categoryId: "cat_vb_main_course",
    name: "Paneer Bhurji",
    description: "Scrambled cottage cheese cooked with chopped onions, tomatoes, green chilies and spices.",
    isVeg: true,
    pricePaise: R(244), // Menu 239 + 5
    sortOrder: 4,
  },
  {
    id: "vb_paneer_masala",
    categoryId: "cat_vb_main_course",
    name: "Paneer Masala",
    description: "Paneer chunks simmered in a mildly spiced, flavorful onion-tomato gravy.",
    isVeg: true,
    pricePaise: R(145), // Half 140+5, Full 260+5
    addOnGroups: [portionGroup(R(145), R(265))],
    sortOrder: 5,
  },
  {
    id: "vb_paneer_butter_masala",
    categoryId: "cat_vb_main_course",
    name: "Paneer Butter Masala",
    description: "All-time favorite creamy, velvety tomato and butter gravy with soft paneer.",
    isVeg: true,
    pricePaise: R(155), // Half 150+5, Full 290+5
    addOnGroups: [portionGroup(R(155), R(295))],
    isPopular: true,
    sortOrder: 6,
  },
  {
    id: "vb_matar_paneer",
    categoryId: "cat_vb_main_course",
    name: "Matar Paneer",
    description: "Classic homestyle combination of tender green peas and cottage cheese in spiced gravy.",
    isVeg: true,
    pricePaise: R(125), // Half 120+5, Full 230+5
    addOnGroups: [portionGroup(R(125), R(235))],
    sortOrder: 7,
  },
  {
    id: "vb_paneer_do_pyaza",
    categoryId: "cat_vb_main_course",
    name: "Paneer Do Pyaza",
    description: "Paneer cooked with double the onions — diced and sautéed in a rich, robust gravy.",
    isVeg: true,
    pricePaise: R(154), // Half 149+5, Full 275+5
    addOnGroups: [portionGroup(R(154), R(280))],
    sortOrder: 8,
  },
  {
    id: "vb_paneer_punjabi",
    categoryId: "cat_vb_main_course",
    name: "Paneer Punjabi",
    description: "Hearty, spiced Punjabi style curry made with tender paneer and aromatic herbs.",
    isVeg: true,
    pricePaise: R(280), // Menu 275 + 5
    sortOrder: 9,
  },
  {
    id: "vb_paneer_angara",
    categoryId: "cat_vb_main_course",
    name: "Special Paneer Angara",
    description: "Smoky, fiery paneer curry infused with charcoal smoke and vibrant red gravy.",
    isVeg: true,
    pricePaise: R(354), // Menu 349 + 5
    isPopular: true,
    sortOrder: 10,
  },
  {
    id: "vb_paneer_lababdar",
    categoryId: "cat_vb_main_course",
    name: "Paneer Lababdar",
    description: "Luscious Mughlai paneer preparation in a rich, cheesy, cashew and tomato gravy.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    sortOrder: 11,
  },
  {
    id: "vb_shahi_paneer_yellow",
    categoryId: "cat_vb_main_course",
    name: "Shahi Paneer (Yellow Gravy)",
    description: "Royal cottage cheese curry simmered in fragrant saffron-tinted yellow cashew gravy.",
    isVeg: true,
    pricePaise: R(260), // Menu 255 + 5
    sortOrder: 12,
  },
  {
    id: "vb_shahi_paneer_white",
    categoryId: "cat_vb_main_course",
    name: "Shahi Paneer (White Gravy)",
    description: "Mild, sweet and rich Mughlai delicacy cooked in velvety white cashew-cream gravy.",
    isVeg: true,
    pricePaise: R(305), // Menu 300 + 5
    sortOrder: 13,
  },
  {
    id: "vb_paneer_tikka_masala",
    categoryId: "cat_vb_main_course",
    name: "Paneer Tikka Masala",
    description: "Char-grilled marinated paneer tikka pieces dunked in a spicy, flavorful tandoori masala gravy.",
    isVeg: true,
    pricePaise: R(325), // Menu 320 + 5
    sortOrder: 14,
  },
  {
    id: "vb_paneer_tikka_butter_masala",
    categoryId: "cat_vb_main_course",
    name: "Paneer Tikka Butter Masala",
    description: "Tandoor roasted paneer tikka cooked in rich buttery, makhani gravy.",
    isVeg: true,
    pricePaise: R(325), // Menu 320 + 5
    isPopular: true,
    sortOrder: 15,
  },
  {
    id: "vb_paneer_mushroom_masala",
    categoryId: "cat_vb_main_course",
    name: "Paneer Mushroom Masala",
    description: "Delectable blend of fresh cottage cheese and button mushrooms in robust onion-tomato gravy.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    sortOrder: 16,
  },
  {
    id: "vb_mushroom_babycorn_masala",
    categoryId: "cat_vb_main_course",
    name: "Mushroom Baby Corn Masala",
    description: "Crunchy baby corn and succulent mushrooms tossed together in a rich aromatic gravy.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    sortOrder: 17,
  },
  {
    id: "vb_mushroom_butter_masala",
    categoryId: "cat_vb_main_course",
    name: "Mushroom Butter Masala",
    description: "Fresh button mushrooms simmered in a silky, creamy makhani butter gravy.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    sortOrder: 18,
  },
  {
    id: "vb_kaju_masala",
    categoryId: "cat_vb_main_course",
    name: "Kaju Masala",
    description: "Whole roasted cashew nuts prepared in a rich, creamy and royal Mughlai gravy.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    isPopular: true,
    sortOrder: 19,
  },
  {
    id: "vb_palak_paneer",
    categoryId: "cat_vb_main_course",
    name: "Palak Paneer",
    description: "Nutritious and vibrant spinach puree cooked with garlic, mild spices and soft cottage cheese.",
    isVeg: true,
    pricePaise: R(235), // Menu 230 + 5
    sortOrder: 20,
  },
  {
    id: "vb_malai_kofta",
    categoryId: "cat_vb_main_course",
    name: "Malai Kofta",
    description: "Melt-in-mouth cottage cheese and potato dumplings in a velvety rich Mughlai gravy.",
    isVeg: true,
    pricePaise: R(280), // Menu 275 + 5
    sortOrder: 21,
  },
  {
    id: "vb_mushroom_masala",
    categoryId: "cat_vb_main_course",
    name: "Mushroom Masala",
    description: "Plump button mushrooms cooked in a thick, semi-dry spiced onion-tomato masala.",
    isVeg: true,
    pricePaise: R(145), // Half 140+5, Full 260+5
    addOnGroups: [portionGroup(R(145), R(265))],
    sortOrder: 22,
  },
  {
    id: "vb_mushroom_do_pyaza",
    categoryId: "cat_vb_main_course",
    name: "Mushroom Do Pyaza",
    description: "Juicy mushrooms sautéed with caramelized onions and roasted spices.",
    isVeg: true,
    pricePaise: R(154), // Half 149+5, Full 285+5
    addOnGroups: [portionGroup(R(154), R(290))],
    sortOrder: 23,
  },
  {
    id: "vb_mushroom_kadahi",
    categoryId: "cat_vb_main_course",
    name: "Mushroom Kadahi",
    description: "Fresh mushrooms cooked with bell peppers and freshly crushed coriander-fennel spices.",
    isVeg: true,
    pricePaise: R(285), // Menu 280 + 5
    sortOrder: 24,
  },
  {
    id: "vb_mushroom_handi",
    categoryId: "cat_vb_main_course",
    name: "Mushroom Handi",
    description: "Claypot simmered button mushrooms in a deeply aromatic, layered North Indian curry.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    sortOrder: 25,
  },

  // ── 4. VEGETABLE MAIN COURSE ─────────────────────────────────────────
  {
    id: "vb_mix_veg",
    categoryId: "cat_vb_veg_curries",
    name: "Mix Veg",
    description: "Assorted seasonal garden vegetables tossed in home-style onion-tomato gravy.",
    isVeg: true,
    pricePaise: R(125), // Half 120+5, Full 220+5
    addOnGroups: [portionGroup(R(125), R(225))],
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "vb_bhindi_masala",
    categoryId: "cat_vb_veg_curries",
    name: "Bhindi Masala",
    description: "Crispy pan-fried ladyfingers tossed with onions, tomatoes and roasted ground spices.",
    isVeg: true,
    pricePaise: R(180), // Menu 175 + 5
    sortOrder: 2,
  },
  {
    id: "vb_aloo_jeera",
    categoryId: "cat_vb_veg_curries",
    name: "Aloo Jeera",
    description: "Potatoes tempered with fragrant roasted cumin seeds, green chilies and fresh coriander.",
    isVeg: true,
    pricePaise: R(130), // Menu 125 + 5
    sortOrder: 3,
  },
  {
    id: "vb_aloo_parwal",
    categoryId: "cat_vb_veg_curries",
    name: "Aloo Parwal",
    description: "Traditional Bihari specialty of potatoes and pointed gourd cooked in savory masala.",
    isVeg: true,
    pricePaise: R(144), // Menu 139 + 5
    sortOrder: 4,
  },
  {
    id: "vb_aloo_gobi_matar",
    categoryId: "cat_vb_veg_curries",
    name: "Aloo Gobi Matar",
    description: "Classic North Indian homestyle trio of potatoes, cauliflower florets and green peas.",
    isVeg: true,
    pricePaise: R(180), // Menu 175 + 5
    sortOrder: 5,
  },
  {
    id: "vb_aloo_gobi_masala",
    categoryId: "cat_vb_veg_curries",
    name: "Aloo Gobi Masala",
    description: "Potatoes and cauliflower florets simmered in thick, flavorful spiced masala.",
    isVeg: true,
    pricePaise: R(154), // Menu 149 + 5
    sortOrder: 6,
  },
  {
    id: "vb_palak_aloo",
    categoryId: "cat_vb_veg_curries",
    name: "Palak Aloo",
    description: "Tender potato chunks cooked with garlic-tempered fresh spinach puree.",
    isVeg: true,
    pricePaise: R(144), // Menu 139 + 5
    sortOrder: 7,
  },

  // ── 5. DAL SPECIALS ──────────────────────────────────────────────────
  {
    id: "vb_dal_fry",
    categoryId: "cat_vb_dal",
    name: "Dal Fry",
    description: "Yellow lentils cooked and tempered with onions, tomatoes, garlic and green chilies.",
    isVeg: true,
    pricePaise: R(75), // Half 70+5, Full 130+5
    addOnGroups: [portionGroup(R(75), R(135))],
    sortOrder: 1,
  },
  {
    id: "vb_dal_fry_tadka",
    categoryId: "cat_vb_dal",
    name: "Dal Fry Tadka",
    description: "Yellow dal finished with an aromatic double tadka of pure desi ghee, cumin and dry red chili.",
    isVeg: true,
    pricePaise: R(90), // Half 85+5, Full 150+5
    addOnGroups: [portionGroup(R(90), R(155))],
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "vb_dal_makhani",
    categoryId: "cat_vb_dal",
    name: "Dal Makhani",
    description: "Slow-cooked whole black lentils and kidney beans simmered overnight with cream and butter.",
    isVeg: true,
    pricePaise: R(185), // Menu 180 + 5
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "vb_dal_punjabi",
    categoryId: "cat_vb_dal",
    name: "Dal Punjabi",
    description: "Rich Punjabi style spiced mixed lentils cooked with traditional herbs and ghee.",
    isVeg: true,
    pricePaise: R(155), // Menu 150 + 5
    sortOrder: 4,
  },

  // ── 6. TANDOORI BREADS & PARATHAS ────────────────────────────────────
  {
    id: "vb_tawa_roti",
    categoryId: "cat_vb_breads",
    name: "Tawa Roti (1 Piece)",
    description: "Homestyle freshly puffed whole wheat flatbread made on tawa.",
    isVeg: true,
    pricePaise: R(20), // Plain 15+5, Butter 20+5
    addOnGroups: [butterOptionGroup(R(20), R(25))],
    sortOrder: 1,
  },
  {
    id: "vb_tandoori_roti",
    categoryId: "cat_vb_breads",
    name: "Tandoori Roti (1 Piece)",
    description: "Crispy and soft whole wheat bread baked fresh in clay tandoor.",
    isVeg: true,
    pricePaise: R(25), // Plain 20+5, Butter 25+5
    addOnGroups: [butterOptionGroup(R(25), R(30))],
    sortOrder: 2,
  },
  {
    id: "vb_naan",
    categoryId: "cat_vb_breads",
    name: "Naan (1 Piece)",
    description: "Traditional soft and chewy leavened flatbread baked in tandoor.",
    isVeg: true,
    pricePaise: R(55), // Plain 50+5, Butter 60+5
    addOnGroups: [butterOptionGroup(R(55), R(65))],
    sortOrder: 3,
  },
  {
    id: "vb_garlic_naan",
    categoryId: "cat_vb_breads",
    name: "Garlic Butter Naan (1 Piece)",
    description: "Clay-oven baked naan infused with minced garlic and brushed with fresh butter.",
    isVeg: true,
    pricePaise: R(80), // Menu 75 + 5
    isPopular: true,
    sortOrder: 4,
  },
  {
    id: "vb_missi_roti",
    categoryId: "cat_vb_breads",
    name: "Missi Roti (1 Piece)",
    description: "Nutritious flatbread made from seasoned gram flour and whole wheat with ajwain.",
    isVeg: true,
    pricePaise: R(45), // Menu 40 + 5
    sortOrder: 5,
  },
  {
    id: "vb_stuffed_naan",
    categoryId: "cat_vb_breads",
    name: "Stuffed Naan (1 Piece)",
    description: "Tandoori naan stuffed with seasoned mashed potatoes and spices.",
    isVeg: true,
    pricePaise: R(85), // Menu 80 + 5
    sortOrder: 6,
  },
  {
    id: "vb_lachha_paratha",
    categoryId: "cat_vb_breads",
    name: "Lachha Paratha (1 Piece)",
    description: "Flaky multi-layered crispy tandoori paratha roasted with ghee.",
    isVeg: true,
    pricePaise: R(45), // Menu 40 + 5
    isPopular: true,
    sortOrder: 7,
  },
  {
    id: "vb_stuffed_paratha",
    categoryId: "cat_vb_breads",
    name: "Stuffed Paratha (1 Piece)",
    description: "Tandoor-baked paratha stuffed with delicious seasonal spiced fillings.",
    isVeg: true,
    pricePaise: R(75), // Menu 70 + 5
    sortOrder: 8,
  },
  {
    id: "vb_aloo_paratha",
    categoryId: "cat_vb_breads",
    name: "Aloo Paratha (1 Piece)",
    description: "Whole wheat paratha filled with savory spiced potato filling.",
    isVeg: true,
    pricePaise: R(45), // Menu 40 + 5
    sortOrder: 9,
  },
  {
    id: "vb_kashmiri_naan",
    categoryId: "cat_vb_breads",
    name: "Kashmiri Naan (1 Piece)",
    description: "Royal sweet tandoori naan stuffed with dried fruits, nuts and cherries.",
    isVeg: true,
    pricePaise: R(154), // Menu 149 + 5
    sortOrder: 10,
  },

  // ── 7. RICE & DUM BIRYANI ────────────────────────────────────────────
  {
    id: "vb_matka_dum_biryani",
    categoryId: "cat_vb_rice",
    name: "Special Matka Dum Biryani",
    description: "Fragrant basmati rice layered with vegetables, paneer and spices, sealed and cooked in clay pot.",
    isVeg: true,
    pricePaise: R(155), // Half 150+5, Full 249+5
    addOnGroups: [portionGroup(R(155), R(254))],
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "vb_plain_rice",
    categoryId: "cat_vb_rice",
    name: "Plain Rice",
    description: "Fluffy, perfectly steamed premium basmati rice.",
    isVeg: true,
    pricePaise: R(65), // Half 60+5, Full 110+5
    addOnGroups: [portionGroup(R(65), R(115))],
    sortOrder: 2,
  },
  {
    id: "vb_jeera_rice",
    categoryId: "cat_vb_rice",
    name: "Jeera Rice",
    description: "Aromatic basmati rice tempered with golden roasted cumin seeds and desi ghee.",
    isVeg: true,
    pricePaise: R(85), // Half 80+5, Full 130+5
    addOnGroups: [portionGroup(R(85), R(135))],
    sortOrder: 3,
  },
  {
    id: "vb_veg_fried_rice",
    categoryId: "cat_vb_rice",
    name: "Veg Fried Rice",
    description: "Wok-tossed basmati rice with finely chopped garden vegetables and light soy seasoning.",
    isVeg: true,
    pricePaise: R(90), // Half 85+5, Full 150+5
    addOnGroups: [portionGroup(R(90), R(155))],
    sortOrder: 4,
  },
  {
    id: "vb_mix_fried_rice",
    categoryId: "cat_vb_rice",
    name: "Mix Fried Rice",
    description: "Deluxe fried rice tossed with paneer, mushroom, baby corn and crisp veggies.",
    isVeg: true,
    pricePaise: R(185), // Menu 180 + 5
    sortOrder: 5,
  },
  {
    id: "vb_schezwan_fried_rice",
    categoryId: "cat_vb_rice",
    name: "Schezwan Fried Rice",
    description: "Spicy and fiery fried rice stir-fried with house Schezwan sauce and vegetables.",
    isVeg: true,
    pricePaise: R(155), // Menu 150 + 5
    sortOrder: 6,
  },

  // ── 8. SOUTH INDIAN ──────────────────────────────────────────────────
  {
    id: "vb_idli_4pcs",
    categoryId: "cat_vb_south_indian",
    name: "Idli (4 Pieces)",
    description: "Steamed fluffy rice-lentil cakes served with piping hot vegetable sambar and coconut chutney.",
    isVeg: true,
    pricePaise: R(85), // Menu 80 + 5
    sortOrder: 1,
  },
  {
    id: "vb_bada_2pcs",
    categoryId: "cat_vb_south_indian",
    name: "Bada / Medu Vada (2 Pieces)",
    description: "Crispy, golden medu vada fried to perfection, served with sambar and coconut chutney.",
    isVeg: true,
    pricePaise: R(65), // Menu 60 + 5
    sortOrder: 2,
  },
  {
    id: "vb_uttapam",
    categoryId: "cat_vb_south_indian",
    name: "Uttapam",
    description: "Thick savory rice pancake griddled with chopped tomatoes, onions and fresh coriander.",
    isVeg: true,
    pricePaise: R(115), // Menu 110 + 5
    sortOrder: 3,
  },
  {
    id: "vb_masala_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Masala Dosa",
    description: "Classic crisp golden crepe filled with savoury spiced mustard potato mash.",
    isVeg: true,
    pricePaise: R(125), // Menu 120 + 5
    isPopular: true,
    sortOrder: 4,
  },
  {
    id: "vb_plain_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Plain Dosa",
    description: "Golden crisp paper-thin dosa served with sambar and fresh coconut chutney.",
    isVeg: true,
    pricePaise: R(75), // Menu 70 + 5
    sortOrder: 5,
  },
  {
    id: "vb_mysore_masala_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Mysore Masala Dosa",
    description: "Crispy dosa layered with spicy Mysore red garlic chutney and filled with potato masala.",
    isVeg: true,
    pricePaise: R(135), // Menu 130 + 5
    sortOrder: 6,
  },
  {
    id: "vb_mysore_plain_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Mysore Plain Dosa",
    description: "Crisp crepe smeared with tangy, spicy Mysore red chutney, served with sambar.",
    isVeg: true,
    pricePaise: R(85), // Menu 80 + 5
    sortOrder: 7,
  },
  {
    id: "vb_paneer_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Paneer Dosa",
    description: "Crispy dosa loaded with spiced grated cottage cheese filling.",
    isVeg: true,
    pricePaise: R(175), // Menu 170 + 5
    isPopular: true,
    sortOrder: 8,
  },
  {
    id: "vb_butter_masala_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Butter Masala Dosa",
    description: "Dosa roasted generously in butter with a rich spiced potato masala filling.",
    isVeg: true,
    pricePaise: R(145), // Menu 140 + 5
    sortOrder: 9,
  },
  {
    id: "vb_cheese_paneer_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Cheese Paneer Dosa",
    description: "Indulgent crisp dosa packed with shredded mozzarella cheese and spiced paneer.",
    isVeg: true,
    pricePaise: R(204), // Menu 199 + 5
    sortOrder: 10,
  },
  {
    id: "vb_rava_masala_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Rava Masala Dosa",
    description: "Crispy golden semolina crepe topped with onion, green chili and filled with potato masala.",
    isVeg: true,
    pricePaise: R(125), // Menu 120 + 5
    sortOrder: 11,
  },
  {
    id: "vb_rava_paneer_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Rava Paneer Dosa",
    description: "Crispy semolina dosa filled with savoury grated paneer.",
    isVeg: true,
    pricePaise: R(155), // Menu 150 + 5
    sortOrder: 12,
  },
  {
    id: "vb_onion_masala_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Onion Masala Dosa",
    description: "Crisp dosa topped with roasted onions and filled with traditional potato masala.",
    isVeg: true,
    pricePaise: R(135), // Menu 130 + 5
    sortOrder: 13,
  },
  {
    id: "vb_onion_plain_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Onion Plain Dosa",
    description: "Crispy golden dosa topped with finely chopped sweet sautéed onions.",
    isVeg: true,
    pricePaise: R(85), // Menu 80 + 5
    sortOrder: 14,
  },
  {
    id: "vb_family_masala_dosa",
    categoryId: "cat_vb_south_indian",
    name: "Family Masala Dosa",
    description: "Giant family-sized crispy masala dosa served with bowls of hot sambar and chutneys.",
    isVeg: true,
    pricePaise: R(304), // Menu 299 + 5
    isPopular: true,
    sortOrder: 15,
  },

  // ── 9. CHINESE & FAST FOOD ───────────────────────────────────────────
  {
    id: "vb_veg_chowmein",
    categoryId: "cat_vb_chinese",
    name: "Veg Chowmein",
    description: "Classic stir-fried noodles tossed with cabbage, carrots, capsicum and dark soya sauce.",
    isVeg: true,
    pricePaise: R(65), // Half 60+5, Full 100+5
    addOnGroups: [portionGroup(R(65), R(105))],
    sortOrder: 1,
  },
  {
    id: "vb_paneer_chowmein",
    categoryId: "cat_vb_chinese",
    name: "Paneer Chowmein",
    description: "Stir-fried noodles loaded with fresh sautéed paneer cubes and crunchy vegetables.",
    isVeg: true,
    pricePaise: R(105), // Half 100+5, Full 180+5
    addOnGroups: [portionGroup(R(105), R(185))],
    sortOrder: 2,
  },
  {
    id: "vb_mix_chowmein",
    categoryId: "cat_vb_chinese",
    name: "Mix Chowmein",
    description: "Deluxe wok-tossed noodles with paneer, mushroom, baby corn and fresh vegetables.",
    isVeg: true,
    pricePaise: R(115), // Half 110+5, Full 190+5
    addOnGroups: [portionGroup(R(115), R(195))],
    sortOrder: 3,
  },
  {
    id: "vb_mushroom_chowmein",
    categoryId: "cat_vb_chinese",
    name: "Mushroom Chowmein",
    description: "Stir-fried noodles with sliced button mushrooms and oriental seasonings.",
    isVeg: true,
    pricePaise: R(95), // Half 90+5, Full 170+5
    addOnGroups: [portionGroup(R(95), R(175))],
    sortOrder: 4,
  },
  {
    id: "vb_veg_manchurian_dry",
    categoryId: "cat_vb_chinese",
    name: "Veg Manchurian Dry",
    description: "Crispy fried vegetable balls tossed in dry chili, garlic, ginger and soya sauce.",
    isVeg: true,
    pricePaise: R(65), // Half 60+5, Full 110+5
    addOnGroups: [portionGroup(R(65), R(115))],
    sortOrder: 5,
  },
  {
    id: "vb_veg_manchurian_gravy",
    categoryId: "cat_vb_chinese",
    name: "Veg Manchurian Gravy",
    description: "Vegetable dumplings cooked in a rich, savory dark Indo-Chinese Manchurian gravy.",
    isVeg: true,
    pricePaise: R(75), // Half 70+5, Full 120+5
    addOnGroups: [portionGroup(R(75), R(125))],
    sortOrder: 6,
  },
  {
    id: "vb_veg_spring_roll",
    categoryId: "cat_vb_chinese",
    name: "Veg Spring Roll",
    description: "Crispy thin pastry sheets rolled with seasoned shredded cabbage and carrots.",
    isVeg: true,
    pricePaise: R(115), // Menu 110 + 5
    sortOrder: 7,
  },
  {
    id: "vb_potato_chilli",
    categoryId: "cat_vb_chinese",
    name: "Potato Chilli",
    description: "Crisp potato wedges tossed with onions, bell peppers and spicy chili garlic sauce.",
    isVeg: true,
    pricePaise: R(125), // Menu 120 + 5
    sortOrder: 8,
  },
  {
    id: "vb_honey_potato_chilli",
    categoryId: "cat_vb_chinese",
    name: "Honey Potato Chilli",
    description: "Crispy fried potato fingers glazed with sweet honey and spicy chili sauce, sprinkled with sesame.",
    isVeg: true,
    pricePaise: R(165), // Menu 160 + 5
    isPopular: true,
    sortOrder: 9,
  },
  {
    id: "vb_french_fry",
    categoryId: "cat_vb_chinese",
    name: "French Fries",
    description: "Classic salted golden crispy deep-fried potato fries.",
    isVeg: true,
    pricePaise: R(105), // Menu 100 + 5
    sortOrder: 10,
  },
  {
    id: "vb_paneer_chilli_dry",
    categoryId: "cat_vb_chinese",
    name: "Paneer Chilli Dry",
    description: "Battered paneer cubes wok-tossed with green chilies, onions and capsicum.",
    isVeg: true,
    pricePaise: R(130), // Half 125+5, Full 240+5
    addOnGroups: [portionGroup(R(130), R(245))],
    isPopular: true,
    sortOrder: 11,
  },
  {
    id: "vb_paneer_chilli_gravy",
    categoryId: "cat_vb_chinese",
    name: "Paneer Chilli Gravy",
    description: "Paneer cubes simmered in spicy and tangy Indo-Chinese gravy.",
    isVeg: true,
    pricePaise: R(135), // Half 130+5, Full 250+5
    addOnGroups: [portionGroup(R(135), R(255))],
    sortOrder: 12,
  },
  {
    id: "vb_mushroom_chilli_dry",
    categoryId: "cat_vb_chinese",
    name: "Mushroom Chilli Dry",
    description: "Crispy fried button mushrooms tossed with chili garlic sauce, capsicum and onions.",
    isVeg: true,
    pricePaise: R(130), // Half 125+5, Full 240+5
    addOnGroups: [portionGroup(R(130), R(245))],
    sortOrder: 13,
  },
  {
    id: "vb_mushroom_chilli_gravy",
    categoryId: "cat_vb_chinese",
    name: "Mushroom Chilli Gravy",
    description: "Juicy mushrooms in savory, aromatic Indo-Chinese dark gravy.",
    isVeg: true,
    pricePaise: R(135), // Half 130+5, Full 250+5
    addOnGroups: [portionGroup(R(135), R(255))],
    sortOrder: 14,
  },
  {
    id: "vb_crispy_chilli_baby_corn_chinese",
    categoryId: "cat_vb_chinese",
    name: "Crispy Chilli Baby Corn",
    description: "Batter-fried baby corn wok-tossed with fiery green chilies and dark soya.",
    isVeg: true,
    pricePaise: R(254), // Menu 249 + 5
    sortOrder: 15,
  },
  {
    id: "vb_paneer_steam_momo",
    categoryId: "cat_vb_chinese",
    name: "Paneer Steam Momos",
    description: "Steamed Himalayan dumplings packed with seasoned paneer, served with spicy chutney.",
    isVeg: true,
    pricePaise: R(115), // Menu 110 + 5
    sortOrder: 16,
  },
  {
    id: "vb_paneer_fry_momo",
    categoryId: "cat_vb_chinese",
    name: "Paneer Fry Momos",
    description: "Crispy fried dumplings stuffed with spiced paneer, served with fiery red momo dip.",
    isVeg: true,
    pricePaise: R(125), // Menu 120 + 5
    sortOrder: 17,
  },

  // ── 10. SNACKS ───────────────────────────────────────────────────────
  {
    id: "vb_chhola_bhatura",
    categoryId: "cat_vb_snacks",
    name: "Chhola Bhatura",
    description: "Two fluffy golden bhature served with spiced Punjabi chole, pickle and sliced onions.",
    isVeg: true,
    pricePaise: R(104), // Menu 99 + 5
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "vb_extra_bhatura",
    categoryId: "cat_vb_snacks",
    name: "Extra Bhatura",
    description: "Single piece of freshly puffed hot bhatura.",
    isVeg: true,
    pricePaise: R(45), // Menu 40 + 5
    sortOrder: 2,
  },
  {
    id: "vb_puri_sabzi_raita",
    categoryId: "cat_vb_snacks",
    name: "Puri Sabzi Raita",
    description: "Crisp fried puris served with traditional spiced aloo bhaji and cool curd raita.",
    isVeg: true,
    pricePaise: R(65), // Menu 60 + 5
    sortOrder: 3,
  },

  // ── 11. SOUPS ────────────────────────────────────────────────────────
  {
    id: "vb_veg_manchow_soup",
    categoryId: "cat_vb_soups",
    name: "Veg Manchow Soup",
    description: "Classic Indo-Chinese vegetable soup served with crunchy fried noodles.",
    isVeg: true,
    pricePaise: R(144), // Menu 139 + 5
    sortOrder: 1,
  },
  {
    id: "vb_hot_and_sour_soup",
    categoryId: "cat_vb_soups",
    name: "Hot & Sour Soup",
    description: "Zesty and tangy soup packed with fresh minced vegetables and chili garlic.",
    isVeg: true,
    pricePaise: R(144), // Menu 139 + 5
    sortOrder: 2,
  },
  {
    id: "vb_sweet_corn_soup",
    categoryId: "cat_vb_soups",
    name: "Sweet Corn Soup",
    description: "Comforting and creamy soup loaded with golden sweet corn kernels.",
    isVeg: true,
    pricePaise: R(144), // Menu 139 + 5
    sortOrder: 3,
  },
  {
    id: "vb_seven_days_soup",
    categoryId: "cat_vb_soups",
    name: "Seven Day's Soup",
    description: "Chef's signature healthy nutritious seven-vegetable broth.",
    isVeg: true,
    pricePaise: R(155), // Menu 150 + 5
    sortOrder: 4,
  },
  {
    id: "vb_tomato_soup",
    categoryId: "cat_vb_soups",
    name: "Tomato Soup",
    description: "Rich, creamy and tangy ripe tomato soup with butter and croutons.",
    isVeg: true,
    pricePaise: R(144), // Menu 139 + 5
    sortOrder: 5,
  },
  {
    id: "vb_mushroom_soup",
    categoryId: "cat_vb_soups",
    name: "Mushroom Soup",
    description: "Warm, earthy and velvety soup prepared with fresh button mushrooms.",
    isVeg: true,
    pricePaise: R(144), // Menu 139 + 5
    sortOrder: 6,
  },

  // ── 12. SALADS, RAITA & PAPAD ────────────────────────────────────────
  {
    id: "vb_green_salad",
    categoryId: "cat_vb_salads",
    name: "Green Salad",
    description: "Fresh sliced cucumbers, tomatoes, carrots, onions and green chilies with lemon.",
    isVeg: true,
    pricePaise: R(65), // Menu 60 + 5
    sortOrder: 1,
  },
  {
    id: "vb_plain_papad",
    categoryId: "cat_vb_salads",
    name: "Plain Papad",
    description: "Crispy roasted or fried lentil wafer.",
    isVeg: true,
    pricePaise: R(20), // Menu 15 + 5
    sortOrder: 2,
  },
  {
    id: "vb_masala_papad",
    categoryId: "cat_vb_salads",
    name: "Masala Papad",
    description: "Crispy papad topped with spicy tangy mixture of chopped onions, tomatoes and chaat masala.",
    isVeg: true,
    pricePaise: R(65), // Menu 60 + 5
    sortOrder: 3,
  },
  {
    id: "vb_mix_raita",
    categoryId: "cat_vb_salads",
    name: "Mix Raita",
    description: "Chilled whisked yogurt blended with chopped vegetables, roasted cumin and black salt.",
    isVeg: true,
    pricePaise: R(65), // Menu 60 + 5
    sortOrder: 4,
  },

  // ── 13. SWEETS & DESSERTS ────────────────────────────────────────────
  {
    id: "vb_gulab_jamun",
    categoryId: "cat_vb_desserts",
    name: "Ghee Ka Garam Gulab Jamun",
    description: "Soft, spongy milk-solid dumplings deep-fried in pure desi ghee and soaked in warm cardamom sugar syrup.",
    isVeg: true,
    pricePaise: R(35), // Menu 30 + 5
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "vb_rasgulla",
    categoryId: "cat_vb_desserts",
    name: "Rasgulla (1 Pc)",
    description: "Classic spongy cottage cheese balls soaked in chilled aromatic sugar syrup.",
    isVeg: true,
    pricePaise: R(20), // Menu 15 + 5
    sortOrder: 2,
  },
  {
    id: "vb_rasmalai",
    categoryId: "cat_vb_desserts",
    name: "Rasmalai (1 Pc)",
    description: "Delicate flattened chenna patties soaked in thick, saffron-cardamom flavored sweet milk with pistachios.",
    isVeg: true,
    pricePaise: R(35), // Menu 30 + 5
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "vb_rabri",
    categoryId: "cat_vb_desserts",
    name: "Rabri (100 gm)",
    description: "Traditional slow-reduced thick creamy sweetened milk layered with malai and dry fruits.",
    isVeg: true,
    pricePaise: R(65), // Menu 60 + 5
    isPopular: true,
    sortOrder: 4,
  },

  // ── 14. LASSI & REFRESHERS ───────────────────────────────────────────
  {
    id: "vb_matka_lassi",
    categoryId: "cat_vb_beverages",
    name: "Special Matka Lassi",
    description: "Thick sweet Punjabi yogurt lassi served in traditional earthen kulhad topped with rich malai.",
    isVeg: true,
    pricePaise: R(65), // Menu 60 + 5
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "vb_dry_fruit_lassi",
    categoryId: "cat_vb_beverages",
    name: "Dry Fruit Lassi",
    description: "Creamy rich sweet lassi generously garnished with chopped almonds, cashews and pistachios.",
    isVeg: true,
    pricePaise: R(85), // Menu 80 + 5
    sortOrder: 2,
  },
  {
    id: "vb_namkeen_chhach",
    categoryId: "cat_vb_beverages",
    name: "Namkeen Chhach",
    description: "Cool, refreshing buttermilk tempered with roasted cumin, mint and rock salt.",
    isVeg: true,
    pricePaise: R(30), // Menu 25 + 5
    sortOrder: 3,
  },
];

/* ══════════════════════════════════════════════════════════════════════
   Seeding Execution
   ══════════════════════════════════════════════════════════════════════ */

export async function seedVrindavanBhog(): Promise<void> {
  console.log("=== Onboarding Vrindavan Bhog ===");

  const campusesCollection = await db.campuses();
  const campus = await campusesCollection.findOne({ _id: CAMPUS_ID });
  if (!campus) {
    throw new Error(`Campus "${CAMPUS_ID}" not found. Run "npm run seed" first.`);
  }

  const now = new Date();
  const servedZoneIds = campus.zones.map((z) => z.id);

  // 1. Upsert Restaurant
  const restaurant: Restaurant = {
    _id: RESTAURANT_ID,
    campusId: CAMPUS_ID,
    slug: "vrindavan-bhog",
    name: "Vrindavan Bhog",
    cuisines: ["Pure Vegetarian", "North Indian", "South Indian", "Chinese", "Thali"],
    phone: "9113723910",
    description:
      "Vrindavan Bhog Pure Vegetarian Restaurant - Special Thalis, Paneer & Mushroom delicacies, South Indian dosas, Soups and Indo-Chinese fast food.",
    imageUrl: null,
    bannerUrl: null,
    packagingFeePaise: R(10),
    minOrderPaise: R(50),
    prepMinutes: 20,
    foodGstBps: 0,
    commissionBpsOverride: null,
    servedZoneIds,
    opensMinutes: 0, // 24x7 service
    closesMinutes: 1439,
    isOpen: true,
    isApproved: true,
    rating: 4.8,
    ratingCount: 35,
    kyc: {
      status: "APPROVED",
      ownerName: "Vrindavan Bhog Manager",
      ownerPhone: "9113723910",
      gstin: null,
      fssai: null,
      reviewedAt: now,
      reviewedBy: "user_admin",
      rejectionReason: null,
    },
    payout: {
      accountName: "Vrindavan Bhog Pure Veg",
      accountNumber: "911372391000",
      ifsc: "SBIN0001234",
      upiId: "vrindavanbhog@upi",
    },
    expiryCountToday: 0,
    autoClosedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const restaurantsCollection = await db.restaurants();
  await restaurantsCollection.replaceOne({ _id: RESTAURANT_ID }, restaurant, { upsert: true });
  console.log(`[x] Restaurant "${restaurant.name}" created/updated.`);

  // 2. Upsert Vendor Account
  const usersCollection = await db.users();
  const vendorUser: User = {
    _id: VENDOR_USER_ID,
    authId: null,
    role: ROLE.VENDOR_OWNER,
    name: "Vrindavan Bhog Manager",
    email: VENDOR_EMAIL,
    phone: "9113723910",
    passwordHash: hashPassword("VrindavanBhog@2026"),
    campusId: CAMPUS_ID,
    restaurantId: RESTAURANT_ID,
    codBlocked: false,
    codBlockedReason: null,
    strikes: 0,
    createdAt: now,
    updatedAt: now,
  };

  await usersCollection.replaceOne({ _id: VENDOR_USER_ID }, vendorUser, { upsert: true });
  console.log(`[x] Vendor User "${VENDOR_EMAIL}" created/updated.`);

  // 3. Upsert Categories
  const categoriesCollection = await db.menuCategories();
  await categoriesCollection.deleteMany({ restaurantId: RESTAURANT_ID });

  const categoryDocs: MenuCategory[] = CATEGORIES.map((cat) => ({
    _id: cat.id,
    restaurantId: RESTAURANT_ID,
    name: cat.name,
    sortOrder: cat.sortOrder,
  }));

  await categoriesCollection.insertMany(categoryDocs);
  console.log(`[x] ${categoryDocs.length} menu categories seeded.`);

  // 4. Upsert Menu Items
  const itemsCollection = await db.menuItems();
  await itemsCollection.deleteMany({ restaurantId: RESTAURANT_ID });

  const itemDocs: MenuItem[] = ITEMS.map((item) => ({
    _id: item.id,
    restaurantId: RESTAURANT_ID,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    isVeg: item.isVeg,
    pricePaise: item.pricePaise,
    imageUrl: null,
    isAvailable: true,
    isPopular: item.isPopular ?? false,
    addOnGroups: item.addOnGroups ?? [],
    sortOrder: item.sortOrder,
  }));

  await itemsCollection.insertMany(itemDocs);
  console.log(`[x] ${itemDocs.length} menu items seeded (+Rs 5 over menu price applied).`);

  console.log("\n=== Vrindavan Bhog Ready! ===");
  console.log(`  - Student URL: /c/${campus.slug}/r/${restaurant.slug}`);
  console.log(`  - Admin Menu URL: /admin/vendors/${RESTAURANT_ID}/menu`);
  console.log(`  - Vendor Login: ${VENDOR_EMAIL} / VrindavanBhog@2026`);
}

async function main() {
  try {
    await seedVrindavanBhog();
  } finally {
    const client = await getMongoClient();
    await client.close();
  }
}

if (require.main === module || process.argv[1]?.includes("seed-vrindavan-bhog")) {
  main().catch((err) => {
    console.error("Failed to seed Vrindavan Bhog:", err);
    process.exit(1);
  });
}
