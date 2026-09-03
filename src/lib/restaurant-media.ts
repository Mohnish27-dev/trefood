/**
 * Restaurant image media registry.
 * Maps restaurants to their carousel photos in /public.
 */

export interface RestaurantMediaInfo {
  images: string[];
}

/**
 * Returns the list of photo URLs for a given restaurant's carousel.
 * Matches by slug, name, or database image/banner fields.
 */
export function getRestaurantImages(restaurant: {
  slug: string;
  name: string;
  imageUrl?: string | null;
  bannerUrl?: string | null;
}): string[] {
  const slug = restaurant.slug.toLowerCase();
  const name = restaurant.name.toLowerCase();

  // 1. Chai Sutta Bar (CSB)
  if (
    slug.includes("csb") ||
    slug.includes("chai-sutta") ||
    name.includes("csb") ||
    name.includes("chai sutta")
  ) {
    return ["/csb/burger.jpg", "/csb/chai.jpg", "/csb/sandwich.jpg"];
  }

  // 2. Wrapchik Pizza
  if (
    slug.includes("wrapchik") ||
    slug.includes("wrapchick") ||
    name.includes("wrapchik") ||
    name.includes("wrapchick")
  ) {
    return ["/wrapchick/pizza.jpg", "/wrapchick/fried_rice.jpg"];
  }

  // 3. Zaika Biryani / Zaika Hotels
  if (slug.includes("zaika") || name.includes("zaika")) {
    return ["/zaika/biryani1.jpg", "/zaika/biryani2.jpg"];
  }

  // 4. Custom DB image or banner if provided
  const dbImages = [restaurant.bannerUrl, restaurant.imageUrl].filter(
    (url): url is string => Boolean(url),
  );
  if (dbImages.length > 0) {
    return dbImages;
  }

  // 5. Default fallback: will be updated as user provides photos for other restaurants
  return [];
}
