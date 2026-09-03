import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";

import { OfflineBanner, ServiceWorkerRegistrar } from "@/components/shared/pwa";
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

export const metadata: Metadata = {
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
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
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
      </head>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <OfflineBanner />
          {children}
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
