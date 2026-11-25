import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "TradeOS",
  description: "TradeOS helps contractors manage projects, estimating, documents, and field operations in one workflow.",
  // Tab / shortcut / install icons come from the master logo package
  // (docs/brand/tradeos-master-logo-package, served from /brand).
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: { title: "TradeOS", description: "Built for what you build.", type: "website", images: [{ url: "/brand/social-share.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "TradeOS", description: "Built for what you build.", images: ["/brand/social-share.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Sets .dark before first paint from the stored preference, so
            switching themes never flashes the wrong one on load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
