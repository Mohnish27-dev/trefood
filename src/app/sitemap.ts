import type { MetadataRoute } from "next";

const BASE_URL = "https://www.trefood.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Active campus restaurant routes at NIT Patna
  const restaurants = [
    "csb",
    "kolkata-biryani",
    "raj-darbar",
    "royal-bihar",
    "sone-zone",
    "vrindavan-bhog",
    "wrapchik",
    "zaika-biryani",
    "prince-juice",
    "mokila",
  ];

  const restaurantUrls: MetadataRoute.Sitemap = restaurants.map((slug) => ({
    url: `${BASE_URL}/c/nit-patna/r/${slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 1.0,
      images: [`${BASE_URL}/og-image.png`],
    },
    {
      url: `${BASE_URL}/c/nit-patna`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    ...restaurantUrls,
  ];
}
