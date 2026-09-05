import type { Metadata, Viewport } from "next";
import { Geist, Oswald } from "next/font/google";

import { PwaBoot } from "@/components/pwa-boot";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Artcell Edmonton Show",
  description:
    "Mobile outreach board for the Artcell Edmonton concert team. Claim contacts, mark them done, and share promo photos and PDFs from your phone.",
  applicationName: "Artcell Edmonton",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Artcell",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2a1c12",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <PwaBoot />
      </body>
    </html>
  );
}
