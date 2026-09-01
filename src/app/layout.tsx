import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";

import { OfflineBanner, ServiceWorkerRegistrar } from "@/components/shared/pwa";
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
  // iOS ignores the manifest's icon list entirely and reads the apple entry.
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0D12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Deliberately not user-scalable:false — pinch-zoom is an accessibility
  // affordance, and the gate screen is read by people squinting at 1 AM.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <OfflineBanner />
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
