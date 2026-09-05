import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/vendor/",
          "/account/",
          "/cart/",
          "/checkout/",
          "/orders/",
          "/api/",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: [
          "/admin/",
          "/vendor/",
          "/account/",
          "/cart/",
          "/checkout/",
          "/orders/",
          "/api/",
        ],
      },
      {
        userAgent: "Googlebot-Image",
        allow: ["/", "/icons/", "/logo.png", "/og-image.png", "/favicon.ico", "/favicon.png"],
      },
    ],
    sitemap: "https://www.trefood.in/sitemap.xml",
    host: "https://www.trefood.in",
  };
}
