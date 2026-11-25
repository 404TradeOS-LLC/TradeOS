import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TradeOS",
    short_name: "TradeOS",
    description: "Built for what you build.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#222426",
    theme_color: "#222426",
    icons: [
      { src: "/brand/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/apple-touch-icon-180.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
