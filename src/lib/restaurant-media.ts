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
  carouselImages?: string[] | null;
}): string[] {
  // 1. If custom carousel images array is provided on the restaurant object
  if (restaurant.carouselImages && restaurant.carouselImages.length > 0) {
    return restaurant.carouselImages;
  }

  const slug = restaurant.slug.toLowerCase();
  const name = restaurant.name.toLowerCase();

  // 1. Chai Sutta Bar (CSB)
  if (
    slug.includes("csb") ||
    slug.includes("chai-sutta") ||
    name.includes("csb") ||
    name.includes("chai sutta")
  ) {
    return [
      "/csb/burger.jpg",
      "/csb/sandwich.jpg",
      "/csb/pizza.jpg",
      "/csb/pasta.jpg",
      "/csb/momo.jpg",
      "/csb/maggi.jpg",
    ];
  }

  // 2. Wrapchik Pizza
  if (
    slug.includes("wrapchik") ||
    slug.includes("wrapchick") ||
    name.includes("wrapchik") ||
    name.includes("wrapchick")
  ) {
    return [
      "/wrapchick/pizza.jpg",
      "/wrapchick/fried_rice.jpg",
      "/wrapchick/erik-mclean-UBtRdqWUbzc-unsplash.jpg",
      "/wrapchick/pixzolo-photography-8YBHgP0WrEo-unsplash.jpg",
      "/wrapchick/pixzolo-photography-BiWb1Y8wpZk-unsplash.jpg",
      "/wrapchick/rusu-ciprian-UpyfnDr6SPk-unsplash.jpg",
    ];
  }

  // 3. Zaika Biryani
  if (slug.includes("zaika") || name.includes("zaika")) {
    return ["/zaika/biryani1.jpg", "/zaika/biryani2.jpg"];
  }

  // 4. Kolkata Biryani, Fast Food & Pizza House
  if (
    slug.includes("kolkata") ||
    name.includes("kolkata")
  ) {
    return [
      "/kolkata_biyani/biryani.jpg",
      "/kolkata_biyani/chowmein.jpg",
      "/kolkata_biyani/paneerDoPyaza.jpg",
      "/kolkata_biyani/paneerChilli.jpg",
      "/kolkata_biyani/burger.jpg",
    ];
  }

  // 5. Raj Darbar
  if (
    slug.includes("raj-darbar") ||
    slug.includes("rajdarbar") ||
    name.includes("raj darbar") ||
    name.includes("rajdarbar")
  ) {
    return [
      "/rajDarbar/shreyak-singh-0j4bisyPo3M-unsplash.jpg",
      "/rajDarbar/debora-cardenas-BIj5FAFQ_rk-unsplash.jpg",
      "/rajDarbar/giorgio-trovato-fczCr7MdE7U-unsplash.jpg",
      "/rajDarbar/kalindu-waranga-VtNLbOAeO68-unsplash.jpg",
      "/rajDarbar/nataliya-melnychuk-KyFEImlFKQY-unsplash.jpg",
      "/rajDarbar/oriol-portell-bL6VgDDsS8M-unsplash.jpg",
      "/rajDarbar/shelley-pauls-I58f47LRQYM-unsplash.jpg",
    ];
  }

  // 6. The Royal Bihar Restaurant
  if (
    slug.includes("royal-bihar") ||
    slug.includes("royalbihar") ||
    name.includes("royal bihar") ||
    name.includes("royalbihar")
  ) {
    return [
      "/royalBihar/aboodi-vesakaran-x6W7MyNS17k-unsplash.jpg",
      "/royalBihar/perspective-studio-zRZxs9tDha0-unsplash.jpg",
      "/royalBihar/julia-kicova-Qct8v6wdyRs-unsplash.jpg",
      "/royalBihar/kalindu-waranga-h51fYRG2p30-unsplash.jpg",
      "/royalBihar/kalyani-akella-gml9g1kRQcM-unsplash.jpg",
      "/royalBihar/kalyani-akella-mDXDRdqtnYI-unsplash.jpg",
    ];
  }

  // 7. Sone Zone Cafe
  if (
    slug.includes("sone-zone") ||
    slug.includes("sonezone") ||
    name.includes("sone zone") ||
    name.includes("sonezone")
  ) {
    return [
      "/soneZone/chad-montano-gE28aTnlqJA-unsplash.jpg",
      "/soneZone/abhishek-hajare-SPeWOme775E-unsplash.jpg",
      "/soneZone/aleksandra-tanasiienko-0y6eMd8vevA-unsplash.jpg",
      "/soneZone/david-foodphototasty-E94j3rMcxlw-unsplash.jpg",
      "/soneZone/kelvin-t-AcA8moIiD3g-unsplash.jpg",
      "/soneZone/victor-rutka-4FujjkcI40g-unsplash.jpg",
    ];
  }

  // 8. Custom DB image or banner if provided
  const dbImages = [restaurant.bannerUrl, restaurant.imageUrl].filter(
    (url): url is string => Boolean(url),
  );
  if (dbImages.length > 0) {
    return dbImages;
  }

  // Fallback if no matching photos are found
  return [];
}
