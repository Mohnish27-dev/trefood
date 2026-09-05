import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";

import {
  InstallPrompt,
  OfflineBanner,
  ServiceWorkerRegistrar,
  pwaInitScript,
} from "@/components/shared/pwa";
import { ThemeProvider, themeInitScript } from "@/components/shared/theme-provider";
import "./globals.css";

/* Display: distinctive, high-personality grotesque for headings and the brand.
   Body:    Inter, because it is the most legible UI face at 360px.
   Mono:    JetBrains Mono for gate codes, order numbers and money columns -
            unambiguous digits and true tabular figures. */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-code",
  display: "swap",
});

const siteUrl = "https://www.trefood.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TREFOOD — Campus food, delivered to your gate",
    template: "%s · TREFOOD",
  },
  description:
    "Hyperlocal food delivery built for Indian college campuses. Order from your campus canteens, collect at your hostel gate.",
  applicationName: "TREFOOD",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TREFOOD",
  },
  icons: {
    icon: [
      { url: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "TREFOOD",
    title: "TREFOOD — Campus food, delivered to your gate",
    description:
      "Hyperlocal food delivery built for Indian college campuses. Order from your campus canteens, collect at your hostel gate.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TREFOOD — Campus food, delivered to your gate",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TREFOOD — Campus food, delivered to your gate",
    description:
      "Hyperlocal food delivery built for Indian college campuses. Order from your campus canteens, collect at your hostel gate.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "TREFOOD",
      alternateName: ["TreFood", "trefood.in"],
      description:
        "Hyperlocal campus food delivery built for Indian college campuses. Order from campus canteens and collect at your hostel gate.",
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "TREFOOD",
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
      image: `${siteUrl}/og-image.png`,
      description: "Hyperlocal food delivery built for Indian college campuses.",
    },
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0D12" },
    { media: "(prefers-color-scheme: light)", color: "#F8F9FC" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  // Deliberately not user-scalable:false — pinch-zoom is an accessibility
  // affordance, and the gate screen is read by people squinting at 1 AM.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${inter.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: pwaInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <OfflineBanner />
          {children}
          <InstallPrompt />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
