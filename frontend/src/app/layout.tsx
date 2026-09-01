import type { Metadata, Viewport } from "next";
import "./globals.css";

import { CartProvider } from "@/hooks/use-cart";
import { DeliveryProvider } from "@/hooks/use-delivery-context";

export const metadata: Metadata = {
  title: "TREFOOD — campus food delivery",
  description:
    "Order from your campus canteens. Handover at the gate, with a code on the packet.",
};

export const viewport: Viewport = {
  // Mobile-first: this app is designed at 360px and used one-handed.
  width: "device-width",
  initialScale: 1,
  // `maximum-scale` is deliberately NOT set. Blocking zoom breaks the app for anyone
  // who needs larger text, and the gate code is the one thing nobody can afford to
  // misread.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col antialiased">
        <DeliveryProvider>
          <CartProvider>{children}</CartProvider>
        </DeliveryProvider>
      </body>
    </html>
  );
}
