import type { Metadata, Viewport } from "next";
import { Geist, Oswald } from "next/font/google";

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
    "Mobile outreach board and setlist for the Artcell Edmonton concert team. Claim contacts, mark them done, and leave results from your phone.",
  applicationName: "Artcell Edmonton",
  appleWebApp: {
    capable: true,
    title: "Artcell Edmonton",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2a1c12",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
