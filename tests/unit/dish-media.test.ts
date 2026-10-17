import { describe, expect, it } from "vitest";
import { getDishImage, FOOD_IMAGE_URLS } from "@/lib/dish-media";

describe("Dish Media & Food Image Resolution", () => {
  it("preserves explicitly defined imageUrl on the item", () => {
    const customUrl = "https://images.unsplash.com/custom-photo";
    const result = getDishImage({
      name: "Paneer Tikka",
      isVeg: true,
      imageUrl: customUrl,
    });
    expect(result).toBe(customUrl);
  });

  it("resolves Royal Bihar specific items to curated food images", () => {
    // Paneer Tikka
    const paneerTikka = getDishImage({
      id: "rb_paneer_tikka",
      name: "Paneer Tikka",
      categoryId: "cat_rb_veg_starters",
      isVeg: true,
    });
    expect(paneerTikka).toBe(FOOD_IMAGE_URLS.paneer_tikka);

    // Dal Makhani
    const dalMakhani = getDishImage({
      id: "rb_dal_makhani",
      name: "Dal Makhani",
      categoryId: "cat_rb_veg_main",
      isVeg: true,
    });
    expect(dalMakhani).toBe(FOOD_IMAGE_URLS.dal_makhani);

    // Chicken Biryani
    const chickenBiryani = getDishImage({
      id: "rb_chicken_masala_biryani",
      name: "Chicken Masala Biryani",
      categoryId: "cat_rb_biryani",
      isVeg: false,
    });
    expect(chickenBiryani).toBe(FOOD_IMAGE_URLS.chicken_biryani);

    // Tandoori Roti
    const roti = getDishImage({
      id: "rb_tandoori_roti",
      name: "Tandoori Roti",
      categoryId: "cat_rb_breads",
      isVeg: true,
    });
    expect(roti).toBe(FOOD_IMAGE_URLS.tandoori_roti);

    // Special Lassi
    const lassi = getDishImage({
      id: "rb_special_lassi",
      name: "Special Lassi",
      categoryId: "cat_rb_beverages",
      isVeg: true,
    });
    expect(lassi).toBe(FOOD_IMAGE_URLS.lassi);
  });

  it("resolves generic dishes by keyword and dietary type", () => {
    const biryani = getDishImage({ name: "Hyderabadi Dum Biryani", isVeg: false });
    expect(biryani).toBe(FOOD_IMAGE_URLS.chicken_biryani);

    const paneer = getDishImage({ name: "Kadhai Paneer Special", isVeg: true });
    expect(paneer).toBe(FOOD_IMAGE_URLS.paneer_curry);

    const noodles = getDishImage({ name: "Hakka Noodles", isVeg: true });
    expect(noodles).toBe(FOOD_IMAGE_URLS.veg_noodles);
  });

  it("ensures all food image URLs use https and point to images.unsplash.com", () => {
    for (const [_key, url] of Object.entries(FOOD_IMAGE_URLS)) {
      expect(url.startsWith("https://images.unsplash.com/")).toBe(true);
      expect(url).toContain("auto=format");
    }
  });
});
