/**
 * Dish Image Media Registry.
 *
 * Provides curated, CDN-backed high-resolution food images for menu items.
 * Uses verified Unsplash CDN URLs that comply with next.config.ts remotePatterns.
 */

export const FOOD_IMAGE_URLS = {
  // Indo-Chinese & Starters
  manchurian_chilli: "https://images.unsplash.com/photo-1606471191009-63994c53433b?auto=format&fit=crop&w=400&q=80",
  paneer_tikka: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=400&q=80",
  pakora: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80",
  crispy_appetizer: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80",
  kabab_tandoor: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=400&q=80",
  chicken_lollipop: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=400&q=80",
  chicken_65: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80",
  tandoori_chicken: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80",
  chicken_leg: "https://images.unsplash.com/photo-1606728035253-49e8a23146de?auto=format&fit=crop&w=400&q=80",
  fish_dish: "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=400&q=80",

  // Noodles & Soups
  veg_noodles: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80",
  chicken_noodles: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=400&q=80",
  tomato_soup: "https://images.unsplash.com/photo-1607528971899-2e89e6c0ec69?auto=format&fit=crop&w=400&q=80",
  veg_soup: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80",
  chicken_soup: "https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=400&q=80",

  // Curries & Gravies
  paneer_curry: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=400&q=80",
  dal_makhani: "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=400&q=80",
  veg_curry: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80",
  chicken_curry: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=400&q=80",
  mutton_curry: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=400&q=80",

  // Biryani & Rice
  veg_biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80",
  chicken_biryani: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=400&q=80",
  plain_rice: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=400&q=80",
  fried_rice: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80",
  pulao: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80",

  // Breads
  tandoori_roti: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80",
  naan: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=400&q=80",
  paratha: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80",

  // Rolls
  veg_roll: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=400&q=80",
  chicken_roll: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80",

  // Salads & Raita
  salad: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80",
  raita: "https://images.unsplash.com/photo-1613946069412-38f7f1ff0b65?auto=format&fit=crop&w=400&q=80",

  // Beverages & Desserts
  mineral_water: "https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=400&q=80",
  cold_drink: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80",
  tea: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=400&q=80",
  hot_coffee: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=400&q=80",
  cold_coffee: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=400&q=80",
  milk_shake: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80",
  fresh_lime_soda: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80",
  lassi: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=400&q=80",
  sweets: "https://images.unsplash.com/photo-1599785209707-a456fc1337bb?auto=format&fit=crop&w=400&q=80",
  ice_cream: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=80",
} as const;

/**
 * Returns a high-resolution, matching photo URL for any food item.
 * If the item already has a non-null imageUrl, it is preserved.
 * Otherwise, resolves the image based on item id, category, name, and dietary type.
 */
export function getDishImage(item: {
  id?: string;
  name: string;
  categoryId?: string;
  isVeg?: boolean;
  imageUrl?: string | null;
}): string | null {
  if (item.imageUrl) {
    return item.imageUrl;
  }

  const id = item.id ?? "";
  const categoryId = item.categoryId ?? "";
  const n = item.name.toLowerCase();

  // 1. Direct item ID overrides for Royal Bihar Restaurant
  if (id === "rb_dal_makhani") return FOOD_IMAGE_URLS.dal_makhani;
  if (id === "rb_tomato_soup") return FOOD_IMAGE_URLS.tomato_soup;
  if (id === "rb_mineral_water") return FOOD_IMAGE_URLS.mineral_water;
  if (id === "rb_ice_cream") return FOOD_IMAGE_URLS.ice_cream;
  if (id === "rb_gulab_jamun" || id === "rb_rasgulla") return FOOD_IMAGE_URLS.sweets;
  if (id === "rb_special_lassi") return FOOD_IMAGE_URLS.lassi;
  if (id === "rb_fresh_lime_soda") return FOOD_IMAGE_URLS.fresh_lime_soda;
  if (id === "rb_cold_coffee") return FOOD_IMAGE_URLS.cold_coffee;
  if (id === "rb_coffee") return FOOD_IMAGE_URLS.hot_coffee;
  if (id === "rb_tea" || id === "rb_masala_tea") return FOOD_IMAGE_URLS.tea;
  if (id === "rb_milk_shake") return FOOD_IMAGE_URLS.milk_shake;
  if (id === "rb_cold_drink" || id === "rb_masala_cold_drink") return FOOD_IMAGE_URLS.cold_drink;

  // 2. Category matching
  if (categoryId === "cat_rb_soups" || n.includes("soup")) {
    if (n.includes("tomato")) return FOOD_IMAGE_URLS.tomato_soup;
    return n.includes("chicken") ? FOOD_IMAGE_URLS.chicken_soup : FOOD_IMAGE_URLS.veg_soup;
  }

  if (categoryId === "cat_rb_chowmein" || n.includes("chowmein") || n.includes("noodles")) {
    return (n.includes("chicken") || n.includes("egg"))
      ? FOOD_IMAGE_URLS.chicken_noodles
      : FOOD_IMAGE_URLS.veg_noodles;
  }

  if (categoryId === "cat_rb_biryani" || n.includes("biryani")) {
    return (n.includes("chicken") || n.includes("egg") || n.includes("mutton") || n.includes("hyderabadi"))
      ? FOOD_IMAGE_URLS.chicken_biryani
      : FOOD_IMAGE_URLS.veg_biryani;
  }

  if (categoryId === "cat_rb_rice" || n.includes("rice") || n.includes("pulao")) {
    if (n.includes("fried rice")) return FOOD_IMAGE_URLS.fried_rice;
    if (n.includes("pulao")) return FOOD_IMAGE_URLS.pulao;
    return FOOD_IMAGE_URLS.plain_rice;
  }

  if (categoryId === "cat_rb_breads" || n.includes("roti") || n.includes("naan") || n.includes("paratha") || n.includes("kulcha")) {
    if (n.includes("naan") || n.includes("kulcha")) return FOOD_IMAGE_URLS.naan;
    if (n.includes("paratha")) return FOOD_IMAGE_URLS.paratha;
    return FOOD_IMAGE_URLS.tandoori_roti;
  }

  if (categoryId === "cat_rb_rolls" || n.includes("roll")) {
    return (n.includes("chicken") || n.includes("egg"))
      ? FOOD_IMAGE_URLS.chicken_roll
      : FOOD_IMAGE_URLS.veg_roll;
  }

  if (categoryId === "cat_rb_salads" || n.includes("salad") || n.includes("papad")) {
    if (n.includes("papad")) return FOOD_IMAGE_URLS.pakora;
    return FOOD_IMAGE_URLS.salad;
  }

  if (categoryId === "cat_rb_raita" || n.includes("raita") || n.includes("curd")) {
    return FOOD_IMAGE_URLS.raita;
  }

  if (categoryId === "cat_rb_beverages" || n.includes("shake") || n.includes("lassi") || n.includes("water") || n.includes("coffee") || n.includes("tea")) {
    if (n.includes("water")) return FOOD_IMAGE_URLS.mineral_water;
    if (n.includes("lassi")) return FOOD_IMAGE_URLS.lassi;
    if (n.includes("coffee")) return n.includes("cold") ? FOOD_IMAGE_URLS.cold_coffee : FOOD_IMAGE_URLS.hot_coffee;
    if (n.includes("tea") || n.includes("chai")) return FOOD_IMAGE_URLS.tea;
    if (n.includes("shake")) return FOOD_IMAGE_URLS.milk_shake;
    if (n.includes("lime") || n.includes("soda")) return FOOD_IMAGE_URLS.fresh_lime_soda;
    return FOOD_IMAGE_URLS.cold_drink;
  }

  if (categoryId === "cat_rb_desserts" || n.includes("jamun") || n.includes("rasgulla") || n.includes("ice cream")) {
    if (n.includes("ice cream")) return FOOD_IMAGE_URLS.ice_cream;
    return FOOD_IMAGE_URLS.sweets;
  }

  if (categoryId === "cat_rb_nonveg_main") {
    if (n.includes("mutton")) return FOOD_IMAGE_URLS.mutton_curry;
    if (n.includes("fish")) return FOOD_IMAGE_URLS.fish_dish;
    if (n.includes("egg")) return FOOD_IMAGE_URLS.veg_curry;
    return FOOD_IMAGE_URLS.chicken_curry;
  }

  if (categoryId === "cat_rb_veg_main") {
    if (n.includes("paneer")) return FOOD_IMAGE_URLS.paneer_curry;
    if (n.includes("dal makhani")) return FOOD_IMAGE_URLS.dal_makhani;
    return FOOD_IMAGE_URLS.veg_curry;
  }

  if (categoryId === "cat_rb_nonveg_starters") {
    if (n.includes("lollipop")) return FOOD_IMAGE_URLS.chicken_lollipop;
    if (n.includes("65")) return FOOD_IMAGE_URLS.chicken_65;
    if (n.includes("fish")) return FOOD_IMAGE_URLS.fish_dish;
    if (n.includes("leg") || n.includes("drumstick")) return FOOD_IMAGE_URLS.chicken_leg;
    if (n.includes("tandoori")) return FOOD_IMAGE_URLS.tandoori_chicken;
    if (n.includes("manchurian") || n.includes("chilli")) return FOOD_IMAGE_URLS.manchurian_chilli;
    if (n.includes("pakora") || n.includes("omlet") || n.includes("omelette")) return FOOD_IMAGE_URLS.pakora;
    return FOOD_IMAGE_URLS.kabab_tandoor;
  }

  if (categoryId === "cat_rb_veg_starters") {
    if (n.includes("paneer tikka")) return FOOD_IMAGE_URLS.paneer_tikka;
    if (n.includes("manchurian") || n.includes("chilli")) return FOOD_IMAGE_URLS.manchurian_chilli;
    if (n.includes("pakora")) return FOOD_IMAGE_URLS.pakora;
    if (n.includes("kabab")) return FOOD_IMAGE_URLS.kabab_tandoor;
    return FOOD_IMAGE_URLS.crispy_appetizer;
  }

  // 3. General keyword fallback
  if (n.includes("biryani")) return FOOD_IMAGE_URLS.chicken_biryani;
  if (n.includes("chicken")) return FOOD_IMAGE_URLS.chicken_curry;
  if (n.includes("paneer")) return FOOD_IMAGE_URLS.paneer_curry;
  if (n.includes("mutton")) return FOOD_IMAGE_URLS.mutton_curry;
  if (n.includes("fish")) return FOOD_IMAGE_URLS.fish_dish;

  return item.isVeg ? FOOD_IMAGE_URLS.veg_curry : FOOD_IMAGE_URLS.chicken_curry;
}
