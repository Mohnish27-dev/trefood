import { describe, expect, it } from "vitest";
import { menuItemImageUrlSchema } from "@/server/actions/vendor";

describe("Vendor Menu Image Validation", () => {
  it("accepts valid root-relative image paths", () => {
    const res1 = menuItemImageUrlSchema.safeParse("/api/menu-images/65f1234567890abcdef12345");
    expect(res1.success).toBe(true);
    expect(res1.data).toBe("/api/menu-images/65f1234567890abcdef12345");

    const res2 = menuItemImageUrlSchema.safeParse("/menu/vrindavanBhog/vb_dal_fry.jpg");
    expect(res2.success).toBe(true);
    expect(res2.data).toBe("/menu/vrindavanBhog/vb_dal_fry.jpg");
  });

  it("accepts valid external web URLs", () => {
    const res1 = menuItemImageUrlSchema.safeParse("https://images.unsplash.com/photo-1546069901-ba9599a7e63c");
    expect(res1.success).toBe(true);
    expect(res1.data).toBe("https://images.unsplash.com/photo-1546069901-ba9599a7e63c");

    const res2 = menuItemImageUrlSchema.safeParse("http://localhost:3000/api/menu-images/img_123");
    expect(res2.success).toBe(true);
    expect(res2.data).toBe("http://localhost:3000/api/menu-images/img_123");
  });

  it("accepts data URLs", () => {
    const res = menuItemImageUrlSchema.safeParse("data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA");
    expect(res.success).toBe(true);
  });

  it("transforms empty strings or whitespace to null", () => {
    const res1 = menuItemImageUrlSchema.safeParse("");
    expect(res1.success).toBe(true);
    expect(res1.data).toBeNull();

    const res2 = menuItemImageUrlSchema.safeParse("   ");
    expect(res2.success).toBe(true);
    expect(res2.data).toBeNull();
  });

  it("accepts null and undefined", () => {
    const resNull = menuItemImageUrlSchema.safeParse(null);
    expect(resNull.success).toBe(true);
    expect(resNull.data).toBeNull();

    const resUndefined = menuItemImageUrlSchema.safeParse(undefined);
    expect(resUndefined.success).toBe(true);
    expect(resUndefined.data).toBeUndefined();
  });

  it("rejects invalid image URLs", () => {
    const res = menuItemImageUrlSchema.safeParse("not-a-valid-url");
    expect(res.success).toBe(false);
  });
});
