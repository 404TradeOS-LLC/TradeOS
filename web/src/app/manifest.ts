import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TradeOS",
    short_name: "TradeOS",
    description: "Built for what you build.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#202225",
    theme_color: "#202225",
    icons: [
      { src: "/pwa/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
