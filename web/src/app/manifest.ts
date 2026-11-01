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
      { src: "/icon", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
